# InvoFlow

The Folder Structure 
AcousticRestarts_HackX/
├── .gitignore
├── README.md
│
├── backend/                          ← contracts + server merged
│   ├── contracts/
│   │   ├── core/
│   │   │   ├── InvoToken.sol         ← ERC-3525 SFT (ID/SLOT/VALUE invoice token)
│   │   │   ├── FundingPool.sol       ← fractional USDC funding + fee deduction
│   │   │   ├── InvoPaymaster.sol     ← ERC-4337 gasless sponsorship
│   │   │   └── ChainlinkGSTVerifier.sol  ← Chainlink Functions IRN oracle
│   │   ├── interfaces/
│   │   │   ├── IERC3525.sol
│   │   │   └── IFundingPool.sol
│   │   └── mocks/
│   │       └── MockUSDC.sol
│   ├── src/                          ← Express API server
│   │   ├── index.js
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   │   ├── gst.service.js        ← Decentro/Sandbox IRN verification
│   │   │   ├── payment.service.js    ← virtual bank account via Decentro/RazorpayX
│   │   │   ├── biconomy.service.js   ← smart wallet + gasless AA
│   │   │   └── riskEngine.service.js ← off-chain ML score + ZK proof dispatch
│   │   └── middleware/
│   ├── zk/
│   │   ├── circuits/riskScore.circom ← Groth16 trust-score circuit
│   │   └── scripts/generateProof.js
│   ├── scripts/deploy.js
│   ├── test/
│   ├── hardhat.config.js             ← Base Sepolia + Polygon Amoy networks
│   ├── package.json
│   └── .env.example
│
└── client/                           ← Next.js 14 frontend
    ├── src/
    │   ├── app/
    │   ├── components/
    │   │   ├── InvoiceUpload.jsx
    │   │   ├── SMEDashboard.jsx
    │   │   └── InvestorDashboard.jsx
    │   ├── hooks/useInvoices.js
    │   └── lib/api.js
    ├── package.json
    └── .env.example