import { ethers } from "ethers";
import dotenv from "dotenv";
dotenv.config();

const provider = new ethers.JsonRpcProvider(process.env.BASE_SEPOLIA_RPC_URL);
const deployer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);

const abi = ["function setSubscriptionId(uint64 _subscriptionId) external"];
const contract = new ethers.Contract(process.env.GST_VERIFIER_ADDRESS, abi, deployer);

console.log("Updating subscriptionId to 630 on ChainlinkGSTVerifier...");
const tx = await contract.setSubscriptionId(630n);
await tx.wait();
console.log("Done. Tx:", tx.hash);
