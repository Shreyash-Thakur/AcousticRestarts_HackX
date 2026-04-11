// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "../interfaces/IERC3525.sol";

/**
 * @title  InvoToken
 * @notice ERC-3525 Semi-Fungible Token for tokenised SME invoices.
 *
 *         Scalar model  <ID, SLOT, VALUE>
 *         ─────────────────────────────────
 *         SLOT  = Corporate buyer / risk-category hash
 *         ID    = Unique invoice token
 *         VALUE = Fractionalisable USDC-equivalent amount (6 decimals)
 *
 *         ● Minting is gated by MINTER_ROLE (assigned to ChainlinkGSTVerifier).
 *         ● Each IRN can only be tokenised once (anti-double-tokenisation).
 *         ● Value can be split across investors via transferFrom(id→address).
 */
contract InvoToken is ERC721, AccessControl, ReentrancyGuard, IERC3525 {
    // ═══════════════════════════════════════════════════════════════
    //  Constants & Roles
    // ═══════════════════════════════════════════════════════════════

    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    uint8 private constant VALUE_DECIMALS = 6; // matches USDC

    // ═══════════════════════════════════════════════════════════════
    //  ERC-3525 Storage
    // ═══════════════════════════════════════════════════════════════

    mapping(uint256 tokenId => uint256) private _slots;
    mapping(uint256 tokenId => uint256) private _values;
    mapping(uint256 tokenId => mapping(address operator => uint256))
        private _valueAllowances;

    uint256 private _tokenIdCounter;

    // ═══════════════════════════════════════════════════════════════
    //  Invoice Storage
    // ═══════════════════════════════════════════════════════════════

    enum InvoiceStatus {
        Verified, // IRN verified, token minted
        Funded, // Fully funded by investors via FundingPool
        Settled, // Buyer paid fiat → stablecoin yields unlocked
        Defaulted // Past due, not settled
    }

    struct Invoice {
        string irn; // GST Invoice Reference Number
        address smeWallet; // SME's smart-account address
        uint256 fiatAmount; // Original invoice value (6 decimals)
        uint256 dueDate; // Unix timestamp
        InvoiceStatus status;
    }

    mapping(uint256 tokenId => Invoice) private _invoices;
    mapping(bytes32 irnHash => bool) private _irnUsed;

    // ═══════════════════════════════════════════════════════════════
    //  Invoice Events
    // ═══════════════════════════════════════════════════════════════

    event InvoiceMinted(
        uint256 indexed tokenId,
        uint256 indexed slot,
        string irn,
        address indexed sme,
        uint256 amount,
        uint256 dueDate
    );

    event InvoiceStatusChanged(
        uint256 indexed tokenId,
        InvoiceStatus newStatus
    );

    // ═══════════════════════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════════════════════

    constructor(address _admin) ERC721("InvoFlow Invoice Token", "INVO") {
        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(MINTER_ROLE, _admin);
    }

    // ═══════════════════════════════════════════════════════════════
    //  ERC-3525 — Read
    // ═══════════════════════════════════════════════════════════════

    /// @inheritdoc IERC3525
    function valueDecimals() external pure returns (uint8) {
        return VALUE_DECIMALS;
    }

    /// @inheritdoc IERC3525
    function valueOf(uint256 tokenId) external view returns (uint256) {
        _requireOwned(tokenId);
        return _values[tokenId];
    }

    /// @inheritdoc IERC3525
    function slotOf(uint256 tokenId) external view returns (uint256) {
        _requireOwned(tokenId);
        return _slots[tokenId];
    }

    /// @inheritdoc IERC3525
    function allowance(
        uint256 tokenId,
        address operator
    ) external view returns (uint256) {
        return _valueAllowances[tokenId][operator];
    }

    // ═══════════════════════════════════════════════════════════════
    //  ERC-3525 — Value Approval
    // ═══════════════════════════════════════════════════════════════

    /// @inheritdoc IERC3525
    function approve(
        uint256 tokenId,
        address operator,
        uint256 value
    ) external payable {
        address owner = ownerOf(tokenId);
        require(
            msg.sender == owner || isApprovedForAll(owner, msg.sender),
            "InvoToken: caller not owner/approved"
        );
        _valueAllowances[tokenId][operator] = value;
        emit ApprovalValue(tokenId, operator, value);
    }

    // ═══════════════════════════════════════════════════════════════
    //  ERC-3525 — Value Transfers
    // ═══════════════════════════════════════════════════════════════

    /// @inheritdoc IERC3525
    /// @notice Transfer `value` between two existing tokens in the same slot.
    function transferFrom(
        uint256 fromTokenId,
        uint256 toTokenId,
        uint256 value
    ) external payable nonReentrant {
        _requireOwned(fromTokenId);
        _requireOwned(toTokenId);
        require(
            _slots[fromTokenId] == _slots[toTokenId],
            "InvoToken: slot mismatch"
        );

        _spendValueAllowance(fromTokenId, msg.sender, value);
        _transferValue(fromTokenId, toTokenId, value);
    }

    /// @inheritdoc IERC3525
    /// @notice Transfer `value` from a token to an address — mints a new
    ///         token for the recipient in the same slot.
    function transferFrom(
        uint256 fromTokenId,
        address to,
        uint256 value
    ) external payable nonReentrant returns (uint256 newTokenId) {
        _requireOwned(fromTokenId);
        require(to != address(0), "InvoToken: zero address");

        _spendValueAllowance(fromTokenId, msg.sender, value);

        newTokenId = _mintToken(to, _slots[fromTokenId], 0);
        _transferValue(fromTokenId, newTokenId, value);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Invoice Minting  (MINTER_ROLE only)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Mint a new invoice token after GST IRN verification.
     * @param to       SME's smart-account wallet
     * @param slot     Buyer category (e.g. uint256(keccak256(buyerPAN)))
     * @param irn      Verified Invoice Reference Number
     * @param amount   Invoice fiat value (6 decimals, USDC-equivalent)
     * @param dueDate  Payment due date (unix timestamp)
     * @return tokenId Newly minted token ID
     */
    function mintInvoice(
        address to,
        uint256 slot,
        string calldata irn,
        uint256 amount,
        uint256 dueDate
    ) external onlyRole(MINTER_ROLE) returns (uint256 tokenId) {
        bytes32 irnHash = keccak256(abi.encodePacked(irn));

        require(!_irnUsed[irnHash], "InvoToken: IRN already tokenized");
        require(amount > 0, "InvoToken: zero amount");
        require(dueDate > block.timestamp, "InvoToken: past due date");

        // Mark IRN as used — prevents double-tokenisation
        _irnUsed[irnHash] = true;

        // Mint ERC-3525 token with <ID, SLOT, VALUE>
        tokenId = _mintToken(to, slot, amount);

        // Store invoice metadata
        _invoices[tokenId] = Invoice({
            irn: irn,
            smeWallet: to,
            fiatAmount: amount,
            dueDate: dueDate,
            status: InvoiceStatus.Verified
        });

        emit InvoiceMinted(tokenId, slot, irn, to, amount, dueDate);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Invoice Queries & Status
    // ═══════════════════════════════════════════════════════════════

    /// @notice Full invoice metadata for a token.
    function getInvoice(
        uint256 tokenId
    ) external view returns (Invoice memory) {
        _requireOwned(tokenId);
        return _invoices[tokenId];
    }

    /// @notice Check whether an IRN has already been tokenised.
    function isIrnTokenized(string calldata irn) external view returns (bool) {
        return _irnUsed[keccak256(abi.encodePacked(irn))];
    }

    /// @notice Update invoice status (admin or FundingPool).
    function setInvoiceStatus(
        uint256 tokenId,
        InvoiceStatus newStatus
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _requireOwned(tokenId);
        _invoices[tokenId].status = newStatus;
        emit InvoiceStatusChanged(tokenId, newStatus);
    }

    /// @notice Total number of tokens ever minted.
    function totalSupply() external view returns (uint256) {
        return _tokenIdCounter;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Internal Helpers
    // ═══════════════════════════════════════════════════════════════

    function _mintToken(
        address to,
        uint256 slot,
        uint256 value
    ) internal returns (uint256 tokenId) {
        tokenId = ++_tokenIdCounter;
        _safeMint(to, tokenId);
        _slots[tokenId] = slot;
        _values[tokenId] = value;
    }

    function _transferValue(uint256 from, uint256 to, uint256 value) internal {
        require(_values[from] >= value, "InvoToken: insufficient value");
        unchecked {
            _values[from] -= value;
        }
        _values[to] += value;
        emit TransferValue(from, to, value);
    }

    function _spendValueAllowance(
        uint256 tokenId,
        address spender,
        uint256 value
    ) internal {
        address owner = ownerOf(tokenId);
        // Owner and full-operators skip the allowance check
        if (spender != owner && !isApprovedForAll(owner, spender)) {
            uint256 current = _valueAllowances[tokenId][spender];
            require(current >= value, "InvoToken: value allowance exceeded");
            unchecked {
                _valueAllowances[tokenId][spender] = current - value;
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  ERC-165 Override
    // ═══════════════════════════════════════════════════════════════

    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return
            interfaceId == type(IERC3525).interfaceId ||
            super.supportsInterface(interfaceId);
    }
}
