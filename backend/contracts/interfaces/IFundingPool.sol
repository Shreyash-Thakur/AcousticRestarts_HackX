// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title  IFundingPool
 * @notice Interface for the fractional native-ETH funding pool that finances
 *         ERC-3525 invoice tokens.
 */
interface IFundingPool {
    // ═══════════════════════ Structs ══════════════════════

    struct FundingInfo {
        uint256 tokenId; // InvoToken ID being funded
        uint256 targetAmount; // Total ETH needed (= invoice VALUE in wei)
        uint256 fundedAmount; // ETH raised so far
        bool fullyFunded; // True once fundedAmount == targetAmount
        bool settled; // True once buyer pays fiat → yields unlocked
        bool defaulted; // True if invoice defaulted
    }

    // ═══════════════════════ Events ═══════════════════════

    event FundingOpened(uint256 indexed tokenId, uint256 targetAmount);

    event InvestmentMade(
        uint256 indexed tokenId,
        address indexed investor,
        uint256 amount
    );

    event InvoiceFullyFunded(
        uint256 indexed tokenId,
        uint256 netToSme,
        uint256 platformFee
    );

    event InvoiceSettled(uint256 indexed tokenId, uint256 totalYield);

    event InvoiceDefaulted(uint256 indexed tokenId);

    event InvestorWithdrawal(
        uint256 indexed tokenId,
        address indexed investor,
        uint256 amount
    );

    event PositionTransferred(
        uint256 indexed tokenId,
        address indexed from,
        address indexed to,
        uint256 amount
    );

    // ═══════════════════════ Functions ════════════════════

    /// @notice Open a funding round for a verified invoice token.
    function openFunding(uint256 tokenId) external;

    /// @notice Invest ETH into an invoice. Send ETH as msg.value.
    function invest(uint256 tokenId) external payable;

    /// @notice Called by admin/webhook when buyer settles in fiat.
    ///         Send repayment as msg.value (must >= targetAmount).
    function settleInvoice(uint256 tokenId) external payable;

    /// @notice Mark an invoice as defaulted.
    function markDefaulted(uint256 tokenId) external;

    /// @notice Investor claims principal + yield after settlement.
    function claimReturns(uint256 tokenId) external;

    /// @notice Transfer your investment position to another address.
    function transferInvestment(
        uint256 tokenId,
        address to,
        uint256 amount
    ) external;

    /// @notice Get funding info for a token.
    function getFundingInfo(
        uint256 tokenId
    ) external view returns (FundingInfo memory);
}
