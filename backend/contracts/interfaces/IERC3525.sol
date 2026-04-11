// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IERC3525 — Semi-Fungible Token Standard
 * @dev   See https://eips.ethereum.org/EIPS/eip-3525
 *
 *        Scalar model: <ID, SLOT, VALUE>
 *          • ID    — unique token identifier   (inherited from ERC-721)
 *          • SLOT  — fungibility class / group (e.g. corporate buyer)
 *          • VALUE — fungible amount per token  (e.g. USDC-equivalent)
 */
interface IERC3525 {
    // ═══════════════════════ Events ═══════════════════════

    /// @notice Emitted when `_value` is transferred between tokens.
    event TransferValue(
        uint256 indexed _fromTokenId,
        uint256 indexed _toTokenId,
        uint256 _value
    );

    /// @notice Emitted when value-spending approval is set for an operator.
    event ApprovalValue(
        uint256 indexed _tokenId,
        address indexed _operator,
        uint256 _value
    );

    /// @notice Emitted when a token's slot assignment changes.
    event SlotChanged(
        uint256 indexed _tokenId,
        uint256 indexed _oldSlot,
        uint256 indexed _newSlot
    );

    // ═══════════════════════ Views ════════════════════════

    /// @notice Number of decimals the VALUE uses (e.g. 6 for USDC).
    function valueDecimals() external view returns (uint8);

    /// @notice Get the VALUE held by `_tokenId`.
    function valueOf(uint256 _tokenId) external view returns (uint256);

    /// @notice Get the SLOT assigned to `_tokenId`.
    function slotOf(uint256 _tokenId) external view returns (uint256);

    /// @notice Get the remaining value allowance for `_operator` on `_tokenId`.
    function allowance(
        uint256 _tokenId,
        address _operator
    ) external view returns (uint256);

    // ═══════════════════════ Mutations ════════════════════

    /// @notice Approve `_operator` to spend up to `_value` from `_tokenId`.
    function approve(
        uint256 _tokenId,
        address _operator,
        uint256 _value
    ) external payable;

    /// @notice Transfer `_value` from one token to another **in the same SLOT**.
    function transferFrom(
        uint256 _fromTokenId,
        uint256 _toTokenId,
        uint256 _value
    ) external payable;

    /// @notice Transfer `_value` from `_fromTokenId` to address `_to`.
    ///         A new token is minted for the recipient and its ID is returned.
    function transferFrom(
        uint256 _fromTokenId,
        address _to,
        uint256 _value
    ) external payable returns (uint256);
}
