import { createSmartAccountClient } from "@biconomy/account";
import { ethers } from "ethers";

const BUNDLER_URL = process.env.BICONOMY_BUNDLER_URL || "";
const PAYMASTER_URL = process.env.BICONOMY_PAYMASTER_URL || "";
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY || "";
const RPC_URL = process.env.BASE_SEPOLIA_RPC_URL || process.env.RPC_URL || "";

let _smartAccount = null;

/**
 * Get (or lazily create) the Biconomy SmartAccount instance backed by the
 * deployer key.  Uses the Biconomy bundler + paymaster configured in .env.
 */
export const getSmartAccount = async () => {
  if (_smartAccount) return _smartAccount;

  if (!BUNDLER_URL || !DEPLOYER_KEY) {
    throw new Error("Biconomy not configured — set BICONOMY_BUNDLER_URL and DEPLOYER_PRIVATE_KEY");
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const signer = new ethers.Wallet(DEPLOYER_KEY, provider);

  const config = {
    signer,
    bundlerUrl: BUNDLER_URL,
    chainId: 84532, // Base Sepolia
  };

  // Attach paymaster if configured (sponsorship mode)
  if (PAYMASTER_URL) {
    config.paymasterUrl = PAYMASTER_URL;
  }

  _smartAccount = await createSmartAccountClient(config);
  const address = await _smartAccount.getAccountAddress();
  console.log("[Biconomy] Smart account address:", address);

  return _smartAccount;
};

/**
 * Get the counterfactual smart-account address without sending any tx.
 */
export const getSmartAccountAddress = async () => {
  const sa = await getSmartAccount();
  return sa.getAccountAddress();
};

/**
 * Submit a gasless (paymaster-sponsored) transaction through the Biconomy
 * bundler.  The deployer key signs the UserOp; the paymaster covers gas.
 *
 * @param {object} tx - { to, data, value? }
 * @returns {{ userOpHash: string, txHash: string }}
 */
export const sendGaslessTransaction = async ({ to, data, value }) => {
  const smartAccount = await getSmartAccount();

  const transaction = {
    to,
    data: data || "0x",
    value: value ? BigInt(value) : 0n,
  };

  const userOpResponse = await smartAccount.sendTransaction(transaction);
  const { transactionHash } = await userOpResponse.waitForTxHash();

  return {
    userOpHash: userOpResponse.userOpHash,
    txHash: transactionHash,
  };
};

/**
 * Send a batch of transactions in a single UserOp (atomic multi-call).
 * @param {Array<{to: string, data: string, value?: string}>} txns
 */
export const sendGaslessBatch = async (txns) => {
  const smartAccount = await getSmartAccount();

  const transactions = txns.map((t) => ({
    to: t.to,
    data: t.data || "0x",
    value: t.value ? BigInt(t.value) : 0n,
  }));

  const userOpResponse = await smartAccount.sendTransaction(transactions);
  const { transactionHash } = await userOpResponse.waitForTxHash();

  return {
    userOpHash: userOpResponse.userOpHash,
    txHash: transactionHash,
  };
};
