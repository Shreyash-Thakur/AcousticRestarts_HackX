// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import {
    IPaymaster,
    IEntryPoint,
    PackedUserOperation
} from "@openzeppelin/contracts/interfaces/draft-IERC4337.sol";

/**
 * @title  InvoPaymaster
 * @notice ERC-4337 Verifying Paymaster for InvoFlow.
 *
 *         The paymaster sponsors ALL gas for whitelisted SME smart-accounts
 *         so they never need to hold native ETH on the L2.
 *
 *         Sponsorship modes (enforced via paymasterData):
 *         ─────────────────────────────────────────────────
 *         Mode 0  — Open sponsorship (any UserOp from a whitelisted sender)
 *         Mode 1  — Signed sponsorship (backend signs a hash to approve spend)
 *
 *         Funding: The contract owner pre-funds the EntryPoint deposit.
 *         Revenue: The 0.5-1% origination fee from FundingPool subsidises gas.
 */
contract InvoPaymaster is IPaymaster, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ═══════════════════════════════════════════════════════════════
    //  State
    // ═══════════════════════════════════════════════════════════════

    IEntryPoint public immutable entryPoint;

    /// @notice Trusted backend signer that authorises individual UserOps.
    address public verifyingSigner;

    /// @notice Whitelisted SME smart-accounts (Mode 0).
    mapping(address => bool) public whitelistedSenders;

    /// @notice Per-sender cumulative gas sponsored (for analytics / caps).
    mapping(address => uint256) public gasSponsored;

    /// @notice Global on/off switch.
    bool public sponsorshipActive = true;

    /// @notice Max gas the paymaster sponsors per single UserOp (wei).
    uint256 public maxCostPerOp = 0.01 ether;

    // ═══════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════

    event SenderWhitelisted(address indexed sender, bool status);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);
    event SponsorshipToggled(bool active);
    event GasSponsored(address indexed sender, uint256 actualGasCost);
    event Deposited(uint256 amount);
    event Withdrawn(address indexed to, uint256 amount);

    // ═══════════════════════════════════════════════════════════════
    //  Errors
    // ═══════════════════════════════════════════════════════════════

    error NotEntryPoint();
    error SponsorshipPaused();
    error SenderNotWhitelisted();
    error CostTooHigh();
    error InvalidSignature();

    // ═══════════════════════════════════════════════════════════════
    //  Modifiers
    // ═══════════════════════════════════════════════════════════════

    modifier onlyEntryPoint() {
        if (msg.sender != address(entryPoint)) revert NotEntryPoint();
        _;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════════════════════

    constructor(
        address _entryPoint,
        address _owner,
        address _verifyingSigner
    ) Ownable(_owner) {
        require(_entryPoint != address(0), "InvoPaymaster: zero entryPoint");
        require(_verifyingSigner != address(0), "InvoPaymaster: zero signer");
        entryPoint = IEntryPoint(_entryPoint);
        verifyingSigner = _verifyingSigner;
    }

    // ═══════════════════════════════════════════════════════════════
    //  IPaymaster — validatePaymasterUserOp
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Called by the EntryPoint to decide if we sponsor this UserOp.
     * @dev    paymasterData layout:
     *           [0]        — mode (0 = whitelist, 1 = signed)
     *           [1..65]    — ECDSA signature (only for mode 1)
     */
    function validatePaymasterUserOp(
        PackedUserOperation calldata userOp,
        bytes32 /* userOpHash */,
        uint256 maxCost
    )
        external
        view
        override
        onlyEntryPoint
        returns (bytes memory context, uint256 validationData)
    {
        if (!sponsorshipActive) revert SponsorshipPaused();
        if (maxCost > maxCostPerOp) revert CostTooHigh();

        // Decode mode from paymasterData
        // paymasterAndData = paymaster(20) || paymasterVerificationGasLimit(16)
        //                    || paymasterPostOpGasLimit(16) || paymasterData(dynamic)
        // We only care about the paymasterData portion which the EntryPoint
        // strips the first 52 bytes. By the time it reaches us in userOp,
        // we parse from the end.
        bytes calldata pmData = userOp.paymasterAndData;
        uint8 mode = 0;
        if (pmData.length > 52) {
            mode = uint8(pmData[52]);
        }

        if (mode == 0) {
            // ─── Mode 0: Whitelist ───────────────────────
            if (!whitelistedSenders[userOp.sender])
                revert SenderNotWhitelisted();
        } else {
            // ─── Mode 1: Verifying signature ─────────────
            require(pmData.length >= 117, "InvoPaymaster: sig too short"); // 52 + 1 + 64
            bytes memory signature = pmData[53:117];
            bytes32 hash = getHash(userOp, maxCost).toEthSignedMessageHash();
            address recovered = hash.recover(signature);
            if (recovered != verifyingSigner) revert InvalidSignature();
        }

        // Return sender as context so postOp can track gas
        context = abi.encode(userOp.sender);
        validationData = 0; // valid immediately, no time range
    }

    // ═══════════════════════════════════════════════════════════════
    //  IPaymaster — postOp
    // ═══════════════════════════════════════════════════════════════

    function postOp(
        PostOpMode /* mode */,
        bytes calldata context,
        uint256 actualGasCost,
        uint256 /* actualUserOpFeePerGas */
    ) external override onlyEntryPoint {
        address sender = abi.decode(context, (address));
        gasSponsored[sender] += actualGasCost;
        emit GasSponsored(sender, actualGasCost);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Hash Helper
    // ═══════════════════════════════════════════════════════════════

    /// @notice Hash that the backend must sign for Mode 1 sponsorship.
    function getHash(
        PackedUserOperation calldata userOp,
        uint256 maxCost
    ) public view returns (bytes32) {
        return
            keccak256(
                abi.encode(
                    userOp.sender,
                    userOp.nonce,
                    keccak256(userOp.callData),
                    maxCost,
                    block.chainid,
                    address(this)
                )
            );
    }

    // ═══════════════════════════════════════════════════════════════
    //  Admin — Whitelist
    // ═══════════════════════════════════════════════════════════════

    function setWhitelisted(address sender, bool status) external onlyOwner {
        whitelistedSenders[sender] = status;
        emit SenderWhitelisted(sender, status);
    }

    function batchWhitelist(
        address[] calldata senders,
        bool status
    ) external onlyOwner {
        for (uint256 i; i < senders.length; ++i) {
            whitelistedSenders[senders[i]] = status;
            emit SenderWhitelisted(senders[i], status);
        }
    }

    // ═══════════════════════════════════════════════════════════════
    //  Admin — Configuration
    // ═══════════════════════════════════════════════════════════════

    function setSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "InvoPaymaster: zero signer");
        emit SignerUpdated(verifyingSigner, _newSigner);
        verifyingSigner = _newSigner;
    }

    function toggleSponsorship(bool active) external onlyOwner {
        sponsorshipActive = active;
        emit SponsorshipToggled(active);
    }

    function setMaxCostPerOp(uint256 _max) external onlyOwner {
        maxCostPerOp = _max;
    }

    // ═══════════════════════════════════════════════════════════════
    //  Admin — EntryPoint Deposit Management
    // ═══════════════════════════════════════════════════════════════

    /// @notice Fund the paymaster's deposit in the EntryPoint.
    function deposit() external payable onlyOwner {
        entryPoint.depositTo{value: msg.value}(address(this));
        emit Deposited(msg.value);
    }

    /// @notice Withdraw from the EntryPoint deposit.
    function withdrawDeposit(
        address payable to,
        uint256 amount
    ) external onlyOwner {
        entryPoint.withdrawTo(to, amount);
        emit Withdrawn(to, amount);
    }

    /// @notice Check current deposit in the EntryPoint.
    function getDeposit() external view returns (uint256) {
        return entryPoint.balanceOf(address(this));
    }

    /// @notice Stake into the EntryPoint (required for reputation).
    function addStake(uint32 unstakeDelaySec) external payable onlyOwner {
        entryPoint.addStake{value: msg.value}(unstakeDelaySec);
    }

    /// @notice Unlock the stake in the EntryPoint.
    function unlockStake() external onlyOwner {
        entryPoint.unlockStake();
    }

    /// @notice Withdraw unlocked stake from the EntryPoint.
    function withdrawStake(address payable to) external onlyOwner {
        entryPoint.withdrawStake(to);
    }

    /// @notice Allow contract to receive ETH for funding.
    receive() external payable {}
}
