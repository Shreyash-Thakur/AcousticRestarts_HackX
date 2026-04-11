import { verifyIRN, verifyGSTIN } from "../services/gst.service.js";
import { ethers } from "ethers";

const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL || "";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const GST_VERIFIER_ADDRESS = process.env.GST_VERIFIER_ADDRESS || "";

const gstVerifierAbi = [
  "function requestVerification(string irn, address sme, uint256 slot, uint256 amount, uint256 dueDate) external returns (bytes32)",
  "function pendingIrns(bytes32) view returns (bool)",
  "function requests(bytes32) view returns (string irn, address sme, uint256 slot, uint256 amount, uint256 dueDate, bool pending)",
];

/**
 * POST /api/verify-irn
 * Body: { irn }
 * Direct backend verification via Decentro Business Verification API.
 */
export async function verifyIRNEndpoint(req, res) {
  try {
    const { irn } = req.body;

    if (!irn || typeof irn !== "string" || irn.trim().length === 0) {
      return res.status(400).json({ message: "irn is required" });
    }

    const result = await verifyIRN(irn.trim());

    return res.json({
      irn: irn.trim(),
      valid: result.valid,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    console.error("verifyIRN error:", error);
    return res.status(500).json({ message: "IRN verification failed" });
  }
}

/**
 * GET /api/verify-gstin/:gstin
 * Verify a GSTIN (taxpayer ID) via Decentro Business Verification API.
 */
export async function verifyGSTINEndpoint(req, res) {
  try {
    const { gstin } = req.params;

    if (!gstin || gstin.length !== 15) {
      return res.status(400).json({ message: "Valid 15-character GSTIN is required" });
    }

    const result = await verifyGSTIN(gstin);

    return res.json({
      gstin,
      valid: result.valid,
      data: result.data,
      error: result.error,
    });
  } catch (error) {
    console.error("verifyGSTIN error:", error);
    return res.status(500).json({ message: "GSTIN verification failed" });
  }
}

/**
 * POST /api/request-gst-verification
 * Body: { irn, smeWallet, slot, amount, dueDate }
 * Triggers on-chain Chainlink Functions GST verification + auto-mint.
 */
export async function requestGSTVerification(req, res) {
  try {
    const { irn, smeWallet, slot, amount, dueDate } = req.body;

    if (!irn || !smeWallet || slot == null || !amount || !dueDate) {
      return res.status(400).json({
        message: "irn, smeWallet, slot, amount, dueDate are required",
      });
    }

    if (!RPC_URL || !DEPLOYER_KEY || !GST_VERIFIER_ADDRESS) {
      return res.status(503).json({
        message: "Blockchain config not available for on-chain verification",
      });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
    const gstVerifier = new ethers.Contract(GST_VERIFIER_ADDRESS, gstVerifierAbi, wallet);

    // Convert amount to USDC-equivalent (6 decimals)
    const amountWei = ethers.parseUnits(String(amount), 6);
    const dueDateTimestamp = Math.floor(new Date(dueDate).getTime() / 1000);

    const tx = await gstVerifier.requestVerification(
      irn.trim(),
      smeWallet,
      BigInt(slot),
      amountWei,
      BigInt(dueDateTimestamp)
    );
    const receipt = await tx.wait();

    // Extract requestId from the event logs
    const requestId = receipt.logs[0]?.topics[1] || receipt.hash;

    return res.json({
      success: true,
      txHash: receipt.hash,
      requestId,
      message: "Chainlink Functions verification requested. Token will be minted on successful callback.",
    });
  } catch (error) {
    console.error("requestGSTVerification error:", error);
    return res.status(500).json({ message: error.message || "On-chain verification request failed" });
  }
}

/**
 * GET /api/gst-status/:irn
 * Check if an IRN has been verified on-chain.
 */
export async function getGSTStatus(req, res) {
  try {
    const { irn } = req.params;

    if (!irn) {
      return res.status(400).json({ message: "irn param is required" });
    }

    if (!RPC_URL || !GST_VERIFIER_ADDRESS) {
      return res.status(503).json({ message: "Blockchain config not available" });
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const gstVerifier = new ethers.Contract(GST_VERIFIER_ADDRESS, gstVerifierAbi, provider);

    // Check if the IRN is currently pending verification
    const irnHash = ethers.keccak256(ethers.toUtf8Bytes(irn));
    const isPending = await gstVerifier.pendingIrns(irnHash);

    return res.json({
      irn,
      pending: isPending,
      message: isPending
        ? "IRN verification is in progress via Chainlink Functions"
        : "No pending verification for this IRN",
    });
  } catch (error) {
    console.error("getGSTStatus error:", error);
    return res.status(500).json({ message: "Failed to check GST status" });
  }
}
