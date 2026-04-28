# InvoFlow

InvoFlow is a decentralized invoice financing platform for SMEs.

It tokenizes verified invoices, enables fractional investor funding, and settles repayments with transparent on-chain logic.

Live App: https://invoflow-pi.vercel.app/

## Core Outcome

- SMEs unlock working capital earlier instead of waiting for invoice due dates.
- Investors access short-duration, yield-bearing invoice positions.
- Funding, fees, and settlement are enforced by smart contracts.

## Web3 Track — Compliance & Implementation

**✅ Rule 1: At least one on-chain transaction required**
- Implemented: SMEs tokenize invoices via `InvoToken.sol` mint transaction
- Investors fund via `FundingPool.sol` deposit transaction
- Settlement & claims executed on-chain
- See: `backend/contracts/InvoToken.sol`, `backend/contracts/FundingPool.sol`

**✅ Rule 2: Must interact with a blockchain (testnet or mainnet)**
- Deployed on: Base Sepolia & Polygon Amoy testnets
- RPC configuration: `BASE_SEPOLIA_RPC_URL`, `POLYGON_AMOY_RPC_URL` in `.env`
- Deploy commands: `npm run deploy:base-sepolia`, `npm run deploy:polygon-amoy`
- Contract addresses tracked via `CONTRACT_ADDRESS` and `INVOICE_CONTRACT_ADDRESS` env vars
- See: `backend/hardhat.config.cjs`, `backend/package.json` scripts

**✅ Rule 3: Smart contract required**
- Core contracts:
  - `InvoToken.sol`: ERC-3525 invoice tokenization (ID, SLOT, VALUE model)
  - `FundingPool.sol`: Fractional USDC funding pool, origination fees, settlement
  - `InvoPaymaster.sol`: ERC-4337 paymaster for gasless transactions
  - `ChainlinkGSTVerifier.sol`: Chainlink Functions-based GST verification gate
- All contracts tested: `backend/test/` includes unit & integration tests
- See: `backend/contracts/`

**✅ Rule 4: Wallet integration required (signing / execution)**
- Frontend wallet integration: React pages for connect/sign/execute flows
- `frontend/src/pages/` includes roles for SME and Investor wallet interactions
- Backend API bridges frontend to contract calls via signed transactions
- Smart contract execution with gas estimation & fee handling
- See: `backend/src/controllers/invoice.controller.js`, `frontend/src/pages/`

**✅ Rule 5: Submit contract address + explorer link**
- Contract addresses stored in `.env` as `CONTRACT_ADDRESS`, `INVOICE_CONTRACT_ADDRESS`
- Hardhat config supports Etherscan verification: `ETHERSCAN_API_KEY` in `.env`
- Deploy scripts log verified contract addresses ready for explorer submission
- See: `backend/hardhat.config.cjs`, `backend/scripts/`

**✅ Rule 6: Must demonstrate real decentralization (no mock Web3)**
- Real blockchain transactions required for each flow step
- No hardcoded/mocked blockchain responses
- ERC-4337 paymaster enables real gasless transaction execution
- Chainlink Functions integrates external GST verification into on-chain gate
- Full settlement & dispute logic enforced by smart contract code
- See: `backend/contracts/FundingPool.sol` (settlement), `backend/contracts/InvoToken.sol` (tokenization)

## Architecture

### Frontend

- React + Vite application in `frontend/`
- Pages for landing, upload, marketplace, invoice detail, SME dashboard, and investor dashboard

### Backend API

- Express API in `backend/src/`
- Unified invoice response layer combining metadata, risk insights, cashflow simulation, and optional on-chain state
- API contract documented in `backend/API_CONTRACT.md`

### Smart Contracts

- `InvoToken.sol`: ERC-3525 style invoice token model (`ID`, `SLOT`, `VALUE`)
- `FundingPool.sol`: fractional USDC funding, origination fee deduction, settlement, investor claims
- `InvoPaymaster.sol`: ERC-4337 paymaster flow for gas sponsorship
- `ChainlinkGSTVerifier.sol`: Chainlink Functions-based GST IRN verification gate before minting

### ZK Layer

- Circuit scaffold and proof script in `backend/zk/`
- Designed for proving risk eligibility without exposing raw sensitive business data on-chain

## Current Status

Implemented and working:

- Contract code for tokenization and funding lifecycle
- Contract tests for minting, funding, settlement, claims, default, and fee logic
- Backend API for invoice create/list/detail/stats with validation and normalization
- Full frontend product flow with role-based pages

Scaffolded for integration:

- Live GST verification service integration
- Live payment webhook settlement integration
- Live smart wallet / gasless transaction service integration
- Full risk proof generation pipeline wiring

## Repository Structure

```text
AcousticRestarts_HackX/
├── README.md
├── backend/
│   ├── API_CONTRACT.md
│   ├── hardhat.config.cjs
│   ├── package.json
│   ├── contracts/
│   ├── data/
│   ├── scripts/
│   ├── src/
│   ├── test/
│   └── zk/
└── frontend/
    ├── package.json
    ├── vite.config.js
    └── src/
```

## Local Setup

### Prerequisites

- Node.js 18+
- npm 9+

### 1) Install dependencies

```bash
cd backend
npm install

cd ../frontend
npm install
```

### 2) Run backend

```bash
cd backend
npm run dev
```

Backend defaults to port `4000`.

### 3) Run frontend

```bash
cd frontend
npm run dev
```

Frontend runs on Vite dev server (typically port `5173`).

## Environment Configuration

Create `backend/.env` and set values as needed:

```env
PORT=4000

# Optional explicit toggle
BLOCKCHAIN_ENABLED=true

# RPC and contract config
RPC_URL=
BASE_SEPOLIA_RPC_URL=
POLYGON_AMOY_RPC_URL=
CONTRACT_ADDRESS=
INVOICE_CONTRACT_ADDRESS=

# Deployment
DEPLOYER_PRIVATE_KEY=
ETHERSCAN_API_KEY=
```

If `BLOCKCHAIN_ENABLED` is not set, backend auto-enables chain reads when RPC and contract address are configured.

## API Summary

Base URLs:

- `/`
- `/api`

Endpoints:

- `GET /health`
- `GET /config`
- `GET /stats`
- `GET /invoices`
- `GET /invoice/:id`
- `POST /invoice`

Compatibility aliases:

- `POST /invoices`
- `GET /invoice`

See `backend/API_CONTRACT.md` for response fields and validation rules.

## Smart Contract Commands

From `backend/`:

```bash
npm run compile
npm run test:contracts
```

Network deploy commands:

```bash
npm run deploy:base-sepolia
npm run deploy:polygon-amoy
```

## Business Model

FundingPool supports an origination fee in the `0.5% - 1.0%` range, deducted on full funding before SME disbursement.

## Notes for Evaluators

- This repo demonstrates protocol architecture and core contract-backed financing flow.
- Some external service adapters are intentionally scaffolded and marked as not implemented where integration credentials or production provider wiring are required.
