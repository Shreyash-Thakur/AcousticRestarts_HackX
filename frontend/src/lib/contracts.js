import { ethers } from "ethers";

/* ── Deployed contract addresses (Base Sepolia) ── */
export const ADDRESSES = {
  InvoToken:   "0x415C4d4c2c46deB654da711ceAd483979EDF92D6",
  FundingPool: "0x9e3921Eb1f67F5356e46fCbb39CEa576E8F5541a",
};

/* ── Minimal ABIs for frontend interaction ── */
export const ABIS = {
  InvoToken: [
    "function getInvoice(uint256) view returns (tuple(string irn, address sme, uint256 amount, uint256 dueDate, uint8 status))",
    "function valueOf(uint256) view returns (uint256)",
    "function slotOf(uint256) view returns (uint256)",
    "function totalSupply() view returns (uint256)",
    "function ownerOf(uint256) view returns (address)",
    "function balanceOf(address) view returns (uint256)",
    "event InvoiceMinted(uint256 indexed tokenId, uint256 indexed slot, string irn, address sme, uint256 amount, uint256 dueDate)",
  ],
  FundingPool: [
    "function invest(uint256 tokenId) external payable",
    "function claimReturns(uint256 tokenId) external",
    "function transferInvestment(uint256 tokenId, address to, uint256 amount) external",
    "function getFundingInfo(uint256) view returns (tuple(uint256 tokenId, uint256 targetAmount, uint256 fundedAmount, bool fullyFunded, bool settled, bool defaulted))",
    "function getInvestment(address, uint256) view returns (uint256)",
    "function hasClaimed(address, uint256) view returns (bool)",
    "event InvestmentMade(uint256 indexed tokenId, address indexed investor, uint256 amount)",
    "event InvoiceFullyFunded(uint256 indexed tokenId, uint256 netPrincipal, uint256 fee)",
    "event InvestorWithdrawal(uint256 indexed tokenId, address indexed investor, uint256 payout)",
    "event PositionTransferred(uint256 indexed tokenId, address indexed from, address indexed to, uint256 amount)",
  ],
};

/* ── Contract factory helpers ── */
export const getInvoToken   = (s) => new ethers.Contract(ADDRESSES.InvoToken,   ABIS.InvoToken,   s);
export const getFundingPool = (s) => new ethers.Contract(ADDRESSES.FundingPool, ABIS.FundingPool, s);

/* ── Read-only provider (no wallet needed) ── */
const RPC = "https://sepolia.base.org";
export function getReadProvider() {
  return new ethers.JsonRpcProvider(RPC);
}
export const getInvoTokenRead   = () => getInvoToken(getReadProvider());
export const getFundingPoolRead = () => getFundingPool(getReadProvider());

/* ── Value helpers (InvoToken uses 6 decimals for VALUE) ── */
export const parseTokenValue  = (amount) => ethers.parseUnits(String(amount), 6);
export const formatTokenValue = (wei)    => Number(ethers.formatUnits(wei, 6));

/* ── Explorer links ── */
export const txUrl      = (hash) => `https://sepolia.basescan.org/tx/${hash}`;
export const addressUrl = (addr) => `https://sepolia.basescan.org/address/${addr}`;
export const tokenUrl   = (id)   => `https://sepolia.basescan.org/token/${ADDRESSES.InvoToken}?a=${id}`;

/* ── Invoice status enum (matches Solidity) ── */
export const InvoiceStatus = ["Verified", "Funded", "Settled", "Defaulted"];

/* ── FundingPool deployment block (for bounded event queries) ── */
export const FUNDING_POOL_DEPLOY_BLOCK = 40060000;
