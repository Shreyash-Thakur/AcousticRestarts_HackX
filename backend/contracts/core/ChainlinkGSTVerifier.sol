// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {
    FunctionsClient
} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";
import {
    FunctionsRequest
} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/libraries/FunctionsRequest.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title InvoToken minimal interface used by this verifier.
 */
interface IInvoTokenMint {
    function mintInvoice(
        address to,
        uint256 slot,
        string calldata irn,
        uint256 amount,
        uint256 dueDate
    ) external returns (uint256 tokenId);

    function isIrnTokenized(string calldata irn) external view returns (bool);
}

/**
 * @title  ChainlinkGSTVerifier
 * @notice Uses Chainlink Functions to call an Indian GST IRN verification API
 *         (Sandbox / Decentro) off-chain, then auto-mints an ERC-3525 invoice
 *         token on successful verification.
 *
 *         Flow:
 *         ─────
 *         1. SME calls `requestVerification(irn, sme, slot, amount, dueDate)`
 *         2. Contract sends a Chainlink Functions request to the DON
 *         3. DON executes the JS source → calls GST API → returns "VALID" or error
 *         4. `fulfillRequest` callback mints the InvoToken if valid
 *
 *         Anti-fraud:
 *         • IRN uniqueness is enforced both here (pending map) and in InvoToken.
 *         • Only the Chainlink Router can call `handleOracleFulfillment`.
 */
contract ChainlinkGSTVerifier is FunctionsClient, AccessControl {
    using FunctionsRequest for FunctionsRequest.Request;

    // ═══════════════════════════════════════════════════════════════
    //  Roles
    // ═══════════════════════════════════════════════════════════════

    bytes32 public constant REQUESTER_ROLE = keccak256("REQUESTER_ROLE");

    // ═══════════════════════════════════════════════════════════════
    //  Immutables & Config
    // ═══════════════════════════════════════════════════════════════

    IInvoTokenMint public immutable invoToken;

    /// @notice Chainlink Functions subscription ID.
    uint64 public subscriptionId;

    /// @notice DON ID for the target Chainlink Functions network.
    bytes32 public donId;

    /// @notice Gas limit for the fulfillment callback.
    uint32 public callbackGasLimit = 300_000;

    /**
     * @notice The JavaScript source executed by the DON.
     *         It receives [irn] as args[0] and should return
     *         the bytes-encoded string "VALID" on success.
     *
     *         Example JS (set via setSource):
     *         ```
     *         const irn = args[0];
     *         const res = await Functions.makeHttpRequest({
     *           url: `https://api.sandbox.co.in/gst/verify-irn/${irn}`,
     *           headers: { "x-api-key": secrets.GST_API_KEY }
     *         });
     *         if (res.error || res.data.status !== "VALID")
     *           throw Error("IRN invalid");
     *         return Functions.encodeString("VALID");
     *         ```
     */
    string public jsSource;

    /// @notice Encrypted secrets ref (uploaded to DON-hosted or remote).
    bytes public encryptedSecretsRef;

    // ═══════════════════════════════════════════════════════════════
    //  Request Tracking
    // ═══════════════════════════════════════════════════════════════

    struct VerificationRequest {
        string irn;
        address smeWallet;
        uint256 slot;
        uint256 amount;
        uint256 dueDate;
        bool pending;
    }

    mapping(bytes32 requestId => VerificationRequest) public requests;
    mapping(bytes32 irnHash => bool) public pendingIrns;

    // ═══════════════════════════════════════════════════════════════
    //  Events
    // ═══════════════════════════════════════════════════════════════

    event VerificationRequested(
        bytes32 indexed requestId,
        string irn,
        address indexed sme
    );

    event VerificationFulfilled(
        bytes32 indexed requestId,
        uint256 indexed tokenId,
        string irn,
        bool success
    );

    event VerificationFailed(bytes32 indexed requestId, string irn, bytes err);

    // ═══════════════════════════════════════════════════════════════
    //  Constructor
    // ═══════════════════════════════════════════════════════════════

    constructor(
        address _router,
        address _invoToken,
        address _admin,
        uint64 _subscriptionId,
        bytes32 _donId
    ) FunctionsClient(_router) {
        require(_invoToken != address(0), "GSTVerifier: zero invoToken");

        invoToken = IInvoTokenMint(_invoToken);
        subscriptionId = _subscriptionId;
        donId = _donId;

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(REQUESTER_ROLE, _admin);
    }

    // ═══════════════════════════════════════════════════════════════
    //  1. Request Verification  (REQUESTER_ROLE — backend / SME)
    // ═══════════════════════════════════════════════════════════════

    /**
     * @notice Kick off an IRN verification via Chainlink Functions.
     * @param irn      GST Invoice Reference Number to verify
     * @param sme      SME smart-account wallet address
     * @param slot     Buyer/category slot for the ERC-3525 token
     * @param amount   Invoice fiat value (6 decimals)
     * @param dueDate  Payment due unix timestamp
     * @return requestId  The Chainlink Functions request ID
     */
    function requestVerification(
        string calldata irn,
        address sme,
        uint256 slot,
        uint256 amount,
        uint256 dueDate
    ) external onlyRole(REQUESTER_ROLE) returns (bytes32 requestId) {
        require(bytes(jsSource).length > 0, "GSTVerifier: source not set");
        require(amount > 0, "GSTVerifier: zero amount");
        require(dueDate > block.timestamp, "GSTVerifier: past due date");

        bytes32 irnHash = keccak256(abi.encodePacked(irn));
        require(!pendingIrns[irnHash], "GSTVerifier: IRN already pending");
        require(
            !invoToken.isIrnTokenized(irn),
            "GSTVerifier: IRN already tokenized"
        );

        // Mark as pending
        pendingIrns[irnHash] = true;

        // Build the Chainlink Functions request
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(jsSource);

        if (encryptedSecretsRef.length > 0) {
            req.addSecretsReference(encryptedSecretsRef);
        }

        string[] memory args = new string[](1);
        args[0] = irn;
        req.setArgs(args);

        // Send request to the DON
        requestId = _sendRequest(
            req.encodeCBOR(),
            subscriptionId,
            callbackGasLimit,
            donId
        );

        // Store pending request
        requests[requestId] = VerificationRequest({
            irn: irn,
            smeWallet: sme,
            slot: slot,
            amount: amount,
            dueDate: dueDate,
            pending: true
        });

        emit VerificationRequested(requestId, irn, sme);
    }

    // ═══════════════════════════════════════════════════════════════
    //  2. Fulfill  (called by Chainlink Router only)
    // ═══════════════════════════════════════════════════════════════

    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        VerificationRequest storage req = requests[requestId];
        require(req.pending, "GSTVerifier: unknown request");

        req.pending = false;
        bytes32 irnHash = keccak256(abi.encodePacked(req.irn));
        pendingIrns[irnHash] = false;

        // Check for error from the DON
        if (err.length > 0) {
            emit VerificationFailed(requestId, req.irn, err);
            return;
        }

        // Verify the response is "VALID"
        if (keccak256(response) != keccak256(abi.encodePacked("VALID"))) {
            emit VerificationFailed(
                requestId,
                req.irn,
                abi.encodePacked("IRN not valid")
            );
            return;
        }

        // Mint the ERC-3525 invoice token
        uint256 tokenId = invoToken.mintInvoice(
            req.smeWallet,
            req.slot,
            req.irn,
            req.amount,
            req.dueDate
        );

        emit VerificationFulfilled(requestId, tokenId, req.irn, true);
    }

    // ═══════════════════════════════════════════════════════════════
    //  Admin — Configuration
    // ═══════════════════════════════════════════════════════════════

    function setSource(
        string calldata _source
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(bytes(_source).length > 0, "GSTVerifier: empty source");
        jsSource = _source;
    }

    function setEncryptedSecretsRef(
        bytes calldata _ref
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        encryptedSecretsRef = _ref;
    }

    function setSubscriptionId(
        uint64 _id
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        subscriptionId = _id;
    }

    function setDonId(bytes32 _id) external onlyRole(DEFAULT_ADMIN_ROLE) {
        donId = _id;
    }

    function setCallbackGasLimit(
        uint32 _limit
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        callbackGasLimit = _limit;
    }
}
