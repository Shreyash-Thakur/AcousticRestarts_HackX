// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "../interfaces/IFundingPool.sol";

/**
 * @title InvoToken interface (minimal subset used by this contract)
 */
interface IInvoToken {
    enum InvoiceStatus {
        Verified,
        Funded,
        Settled,
        Defaulted
    }

    struct Invoice {
        string irn;
        address smeWallet;
        uint256 fiatAmount;
        uint256 dueDate;
        InvoiceStatus status;
    }

    function getInvoice(uint256 tokenId) external view returns (Invoice memory);
    function valueOf(uint256 tokenId) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function setInvoiceStatus(
        uint256 tokenId,
        InvoiceStatus newStatus
    ) external;
}

/**
 * @title  FundingPool
 * @notice Fractional USDC funding pool for ERC-3525 invoice tokens.
 *
 *         Flow:
 *         1. Admin opens funding for a verified invoice token
 *         2. Investors deposit USDC (fractional, any amount up to target)
 *         3. When fully funded → deduct platform fee → disburse to SME
 *         4. On fiat settlement (webhook) → yields deposited → investors claim
 *
 *         Revenue: 0.5 – 1.0 % origination fee on fully-funded amount.
 */
contract FundingPool is AccessControl, ReentrancyGuard, IFundingPool {
    using SafeERC20 for IERC20;

    // ═══════════════════════════════════════════════════════════════
    //  Roles
    // ═══════════════════════════════════════════════════════════════

    bytes32 public constant SETTLER_ROLE = keccak256("SETTLER_ROLE");

    // ═══════════════════════════════════════════════════════════════
    //  Immutables & Config
    // ═══════════════════════════════════════════════════════════════

    IInvoToken public immutable invoToken;
    IERC20 public immutable usdc;
    address public feeRecipient;
    uint256 public feeBps; // basis points, e.g. 50 = 0.5%, 100 = 1.0%

    uint256 public constant MAX_FEE_BPS = 100; // hard cap at 1%
    uint256 public constant BPS_DENOM = 10_000;

    // ═══════════════════════════════════════════════════════════════
    //  Funding Storage
    // ═══════════════════════════════════════════════════════════════

    mapping(uint256 tokenId => FundingInfo) private _fundings;

    // investor → tokenId → amount invested
    mapping(address => mapping(uint256 => uint256)) private _investments;

    // tokenId → total repayment deposited on settlement (principal + yield)
    mapping(uint256 => uint256) private _repayments;

    // investor → tokenId → already claimed
    mapping(address => mapping(uint256 => bool)) private _claimed;

    // ═══════════════════════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════════════════════

    constructor(
        address _invoToken,
        address _usdc,
        address _admin,
        address _feeRecipient,
        uint256 _feeBps
    ) {
        require(_invoToken != address(0), "FundingPool: zero invoToken");
        require(_usdc != address(0), "FundingPool: zero usdc");
        require(_feeRecipient != address(0), "FundingPool: zero feeRecipient");
        require(_feeBps <= MAX_FEE_BPS, "FundingPool: fee too high");

        invoToken = IInvoToken(_invoToken);
        usdc = IERC20(_usdc);
        feeRecipient = _feeRecipient;
        feeBps = _feeBps;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(SETTLER_ROLE, _admin);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Admin Setters
    // ═══════════════════════════════════════════════════════════════

    function setFeeRecipient(
        address _new
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_new != address(0), "FundingPool: zero address");
        feeRecipient = _new;
    }

    function setFeeBps(uint256 _new) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_new <= MAX_FEE_BPS, "FundingPool: fee too high");
        feeBps = _new;
    }

    // ═══════════════════════════════════════════════════════════════
    //  1. Open Funding
    // ═══════════════════════════════════════════════════════════════

    /// @inheritdoc IFundingPool
    function openFunding(
        uint256 tokenId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IInvoToken.Invoice memory inv = invoToken.getInvoice(tokenId);
        require(
            inv.status == IInvoToken.InvoiceStatus.Verified,
            "FundingPool: not Verified"
        );

        FundingInfo storage f = _fundings[tokenId];
        require(f.targetAmount == 0, "FundingPool: already opened");

        uint256 target = invoToken.valueOf(tokenId);
        require(target > 0, "FundingPool: zero value");

        f.tokenId = tokenId;
        f.targetAmount = target;

        emit FundingOpened(tokenId, target);
    }

    // ═══════════════════════════════════════════════════════════════
    //  2. Invest
    // ═══════════════════════════════════════════════════════════════

    /// @inheritdoc IFundingPool
    function invest(uint256 tokenId, uint256 amount) external nonReentrant {
        FundingInfo storage f = _fundings[tokenId];
        require(f.targetAmount > 0, "FundingPool: not open");
        require(!f.fullyFunded, "FundingPool: already funded");
        require(amount > 0, "FundingPool: zero amount");

        uint256 remaining = f.targetAmount - f.fundedAmount;
        uint256 actual = amount > remaining ? remaining : amount;

        // Pull USDC from investor
        usdc.safeTransferFrom(msg.sender, address(this), actual);
        f.fundedAmount += actual;
        _investments[msg.sender][tokenId] += actual;

        emit InvestmentMade(tokenId, msg.sender, actual);

        // Check if fully funded
        if (f.fundedAmount == f.targetAmount) {
            f.fullyFunded = true;
            _disbursePrincipal(tokenId, f);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  3. Settlement (webhook / admin triggers)
    // ═══════════════════════════════════════════════════════════════

    /// @inheritdoc IFundingPool
    /// @dev The settler deposits the FULL repayment amount (investor principal + yield).
    ///      When the buyer pays fiat, the webhook service converts it to USDC and
    ///      calls this function. `totalRepayment` >= targetAmount.
    function settleInvoice(
        uint256 tokenId,
        uint256 totalRepayment
    ) external onlyRole(SETTLER_ROLE) nonReentrant {
        FundingInfo storage f = _fundings[tokenId];
        require(f.fullyFunded, "FundingPool: not funded");
        require(!f.settled, "FundingPool: already settled");
        require(!f.defaulted, "FundingPool: defaulted");
        require(
            totalRepayment >= f.targetAmount,
            "FundingPool: repayment below principal"
        );

        // Pull full repayment USDC from settler
        usdc.safeTransferFrom(msg.sender, address(this), totalRepayment);
        _repayments[tokenId] = totalRepayment;
        f.settled = true;

        // Update invoice status on InvoToken
        invoToken.setInvoiceStatus(tokenId, IInvoToken.InvoiceStatus.Settled);

        emit InvoiceSettled(tokenId, totalRepayment);
    }

    /// @inheritdoc IFundingPool
    function markDefaulted(
        uint256 tokenId
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        FundingInfo storage f = _fundings[tokenId];
        require(f.fullyFunded, "FundingPool: not funded");
        require(!f.settled, "FundingPool: already settled");
        require(!f.defaulted, "FundingPool: already defaulted");

        f.defaulted = true;
        invoToken.setInvoiceStatus(tokenId, IInvoToken.InvoiceStatus.Defaulted);

        emit InvoiceDefaulted(tokenId);
    }

    // ═══════════════════════════════════════════════════════════════
    //  4. Investor Claims
    // ═══════════════════════════════════════════════════════════════

    /// @inheritdoc IFundingPool
    function claimReturns(uint256 tokenId) external nonReentrant {
        FundingInfo storage f = _fundings[tokenId];
        require(f.settled, "FundingPool: not settled");

        uint256 invested = _investments[msg.sender][tokenId];
        require(invested > 0, "FundingPool: no investment");
        require(!_claimed[msg.sender][tokenId], "FundingPool: already claimed");

        _claimed[msg.sender][tokenId] = true;

        // Pro-rata share of total repayment (principal + yield)
        uint256 payout = (_repayments[tokenId] * invested) / f.targetAmount;

        usdc.safeTransfer(msg.sender, payout);

        emit InvestorWithdrawal(tokenId, msg.sender, payout);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Views
    // ═══════════════════════════════════════════════════════════════

    /// @inheritdoc IFundingPool
    function getFundingInfo(
        uint256 tokenId
    ) external view returns (FundingInfo memory) {
        return _fundings[tokenId];
    }

    function getInvestment(
        address investor,
        uint256 tokenId
    ) external view returns (uint256) {
        return _investments[investor][tokenId];
    }

    function hasClaimed(
        address investor,
        uint256 tokenId
    ) external view returns (bool) {
        return _claimed[investor][tokenId];
    }

    // ═══════════════════════════════════════════════════════════════
    //  Internal
    // ═══════════════════════════════════════════════════════════════

    /**
     * @dev Deduct platform fee and send net principal to the SME wallet.
     *      Called once, immediately when invoice hits full funding.
     */
    function _disbursePrincipal(
        uint256 tokenId,
        FundingInfo storage f
    ) internal {
        IInvoToken.Invoice memory inv = invoToken.getInvoice(tokenId);

        uint256 fee = (f.targetAmount * feeBps) / BPS_DENOM;
        uint256 net = f.targetAmount - fee;

        // Platform fee
        if (fee > 0) {
            usdc.safeTransfer(feeRecipient, fee);
        }

        // Principal to SME
        usdc.safeTransfer(inv.smeWallet, net);

        // Update invoice status
        invoToken.setInvoiceStatus(tokenId, IInvoToken.InvoiceStatus.Funded);

        emit InvoiceFullyFunded(tokenId, net, fee);
    }
}
