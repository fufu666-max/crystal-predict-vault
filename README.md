# Crystal Predict Vault

A privacy-preserving weather prediction system built on blockchain using Fully Homomorphic Encryption (FHE). This application allows users to submit encrypted temperature predictions that are stored on-chain and revealed after the target date for ranking purposes.

## 🌐 Live Demo

- **Live Demo**: [https://crystal-predict-vault.vercel.app/](https://crystal-predict-vault.vercel.app/)
- **Demo Video**: [https://github.com/ZoeDarwin/crystal-predict-vault/blob/main/crystal-predict-vault.mp4](https://github.com/ZoeDarwin/crystal-predict-vault/blob/main/crystal-predict-vault.mp4)

## Features

- **🔒 Fully Homomorphic Encryption**: Protect temperature predictions using Zama's FHEVM technology
- **🌡️ Encrypted Temperature Predictions**: Submit encrypted temperature and confidence levels
- **👤 User-Owned Data**: Only prediction owners can decrypt their data before reveal
- **📊 Leaderboard System**: Rank predictions by accuracy after decryption
- **🌐 Multi-Network Support**: Works on local Hardhat network and Sepolia testnet
- **💼 Wallet Integration**: Seamless wallet connection using RainbowKit

## Quick Start

### Prerequisites

- **Node.js**: Version 20 or higher
- **npm or yarn/pnpm**: Package manager
- **MetaMask** or compatible wallet

### Installation

1. **Install dependencies**

   ```bash
   npm install
   cd ui
   npm install
   ```

2. **Set up environment variables**

   ```bash
   npx hardhat vars set MNEMONIC
   npx hardhat vars set INFURA_API_KEY
   npx hardhat vars set ETHERSCAN_API_KEY
   ```

3. **Compile contracts**

   ```bash
   npm run compile
   npm run typechain
   ```

4. **Deploy to local network**

   ```bash
   # Terminal 1: Start Hardhat node
   npx hardhat node

   # Terminal 2: Deploy contract
   npx hardhat deploy --network localhost

   # Copy the deployed contract address and update ui/src/config/contracts.ts
   # CONTRACT_ADDRESSES[31337] = '0x...';
   ```

5. **Start frontend**

   ```bash
   cd ui
   npm run dev
   ```

6. **Connect wallet and test**

   - Open the app in your browser
   - Connect wallet to localhost network (Chain ID: 31337)
   - Submit a weather prediction
   - Decrypt your prediction to verify encryption/decryption

## Project Structure

```
crystal-predict-vault/
├── contracts/                           # Smart contract source files
│   ├── PrivateWeatherGuess.sol         # Main weather prediction contract
│   └── FHECounter.sol                  # Example FHE counter contract
├── deploy/                              # Deployment scripts
│   └── deploy.ts                        # Main deployment script
├── test/                                # Test files
│   ├── PrivateWeatherGuess.ts          # Local network tests
│   └── PrivateWeatherGuessSepolia.ts   # Sepolia testnet tests
├── ui/                                  # Frontend React application
│   ├── src/
│   │   ├── components/                 # React components
│   │   │   ├── CreatePredictionDialog.tsx  # Create prediction form
│   │   │   ├── PredictionDashboard.tsx     # Main dashboard
│   │   │   ├── Leaderboard.tsx             # Leaderboard display
│   │   │   └── ui/                         # shadcn/ui components
│   │   ├── hooks/                      # Custom React hooks
│   │   │   └── useWeatherPrediction.ts # Prediction hooks
│   │   ├── config/                     # Contract configuration
│   │   │   └── contracts.ts             # Contract addresses and ABIs
│   │   ├── lib/                        # Utilities
│   │   │   ├── fhevm.ts                # FHEVM encryption/decryption logic
│   │   │   ├── wagmi.ts                # Wagmi configuration
│   │   │   └── utils.ts                # General utilities
│   │   └── pages/                      # Page components
│   │       └── Index.tsx               # Main page
│   └── package.json
├── types/                               # TypeScript type definitions (generated)
├── hardhat.config.ts                    # Hardhat configuration
└── package.json                         # Dependencies and scripts
```

## Available Scripts

| Script             | Description              |
| ------------------ | ------------------------ |
| `npm run compile`  | Compile all contracts    |
| `npm run test`     | Run all tests (local)    |
| `npm run test:sepolia` | Run tests on Sepolia  |
| `npm run coverage` | Generate coverage report |
| `npm run lint`     | Run linting checks       |
| `npm run clean`    | Clean build artifacts    |
| `npm run typechain` | Generate TypeScript types |

## Smart Contract Architecture

### Contract Overview

The `PrivateWeatherGuess` contract is built on Zama's FHEVM (Fully Homomorphic Encryption Virtual Machine) technology, enabling computation on encrypted data without decryption. The contract stores encrypted temperature predictions and confidence levels, ensuring privacy until the reveal phase.

### Key Data Structures

```solidity
struct Prediction {
    address predictor;        // User who made the prediction
    string location;          // Location for weather prediction (plain text)
    uint256 targetDate;       // Target date for the prediction (Unix timestamp)
    uint256 submissionTime;   // When prediction was submitted
    bool isRevealed;          // Whether prediction has been revealed/decrypted
    bool isActive;            // Active status
}

struct EncryptedPredictionData {
    euint32 encryptedTemperature;  // Encrypted temperature in Celsius (multiplied by 10)
    euint32 encryptedConfidence;    // Encrypted confidence level (0-1000, where 1000 = 100%)
}

struct LeaderboardEntry {
    address predictor;
    int256 actualTemperature;  // Actual temperature (can be negative)
    uint256 predictionId;
    uint256 accuracy;          // Accuracy score (0-10000, where 10000 = 100.00%)
}
```

### Contract Functions

#### For Users

- **`submitPrediction()`**: Submit encrypted temperature and confidence predictions
  - Parameters: `location`, `targetDate`, `encryptedTemperature`, `temperatureProof`, `encryptedConfidence`, `confidenceProof`
  - Validates: Location length (1-100 chars), target date in future (max 1 year)
  - Grants decryption access to contract and prediction owner
  - Emits `PredictionSubmitted` event

- **`getPrediction()`**: Get prediction metadata (public information)
  - Returns: `predictor`, `location`, `targetDate`, `submissionTime`, `isRevealed`, `isActive`

- **`getEncryptedTemperature()`**: Get encrypted temperature handle
  - Access: Only prediction owner before reveal, or anyone after reveal
  - Returns: `euint32` encrypted temperature handle

- **`getEncryptedConfidence()`**: Get encrypted confidence handle
  - Access: Only prediction owner before reveal, or anyone after reveal
  - Returns: `euint32` encrypted confidence handle

- **`getUserPredictions()`**: Get user's prediction IDs
  - Returns: Array of prediction IDs for the user

- **`getLeaderboardEntry()`**: Get leaderboard entry for a prediction
  - Returns: `predictor`, `actualTemperature`, `accuracy`

#### For Owner

- **`revealPrediction()`**: Reveal prediction after target date
  - Parameters: `predictionId`, `actualTemperature`
  - Requirements: Only owner, target date passed, not already revealed
  - Creates leaderboard entry with actual temperature
  - Emits `PredictionRevealed` event

- **`updateLeaderboardAccuracy()`**: Update accuracy score after decryption
  - Parameters: `predictionId`, `accuracy` (0-10000)
  - Calculates accuracy based on difference between predicted and actual temperature
  - Emits `LeaderboardUpdated` event

- **`pause()` / `unpause()`**: Pause/unpause contract operations
  - Emergency controls for contract owner

## Encryption and Decryption Logic

### Encryption Flow (Frontend → Contract)

1. **Initialize FHEVM Instance**
   - Local Network (Chain ID 31337): Uses `@fhevm/mock-utils` with Hardhat plugin
   - Sepolia Network (Chain ID 11155111): Uses `@zama-fhe/relayer-sdk` with official FHEVM

2. **Encrypt Input Data**
   ```typescript
   // Convert temperature to integer (multiply by 10 for precision)
   const temperatureInt = Math.round(temperature * 10); // e.g., 25.5°C → 255
   
   // Convert confidence to integer (multiply by 10)
   const confidenceInt = Math.round(confidence * 10); // e.g., 85% → 850
   
   // Encrypt using FHEVM
   const encryptedTemp = await encryptInput(
     fhevm, 
     contractAddress, 
     userAddress, 
     temperatureInt
   );
   // Returns: { handles: [string], inputProof: string }
   ```

3. **Submit to Contract**
   - Contract receives `externalEuint32` (encrypted handle) and `bytes` (ZK proof)
   - Contract converts external encrypted input to internal `euint32` using `FHE.fromExternal()`
   - Contract grants decryption permissions:
     - `FHE.allowThis()`: Contract can decrypt
     - `FHE.allow(encryptedValue, msg.sender)`: Prediction owner can decrypt

### Decryption Flow (Contract → Frontend)

1. **Get Encrypted Handle**
   ```typescript
   // Retrieve encrypted handle from contract
   const encryptedHandle = await contract.getEncryptedTemperature(predictionId);
   // Returns: euint32 handle (0x...)
   ```

2. **Decrypt Using FHEVM**
   ```typescript
   // Local Network: Uses mock FHEVM with EIP-712 signature
   if (chainId === 31337) {
     const keypair = mockInstance.generateKeypair();
     const eip712 = mockInstance.createEIP712(
       keypair.publicKey,
       [contractAddress],
       startTimestamp,
       durationDays
     );
     const signature = await signer.signTypedData(...);
     const result = await mockInstance.userDecrypt(
       [{ handle, contractAddress }],
       keypair.privateKey,
       keypair.publicKey,
       signature,
       ...
     );
   }
   
   // Sepolia Network: Uses official FHEVM SDK
   else if (chainId === 11155111) {
     const keypair = fhevm.generateKeypair();
     // Similar flow with official SDK
   }
   ```

3. **Convert Back to Original Value**
   ```typescript
   // Divide by 10 to get original value
   const temperature = decryptedValue / 10; // 255 → 25.5°C
   const confidence = decryptedValue / 10;   // 850 → 85%
   ```

### Security Features

- **Access Control**: Only prediction owners can decrypt their data before reveal
- **Zero-Knowledge Proofs**: Input proofs verify encrypted values are within valid ranges
- **Permission System**: FHEVM's permission system ensures only authorized parties can decrypt
- **Reveal Mechanism**: After target date, owner can reveal predictions for leaderboard ranking

### Data Format

- **Temperature**: Stored as integer (multiplied by 10), e.g., 25.5°C → 255
- **Confidence**: Stored as integer (multiplied by 10), e.g., 85% → 850
- **Accuracy**: Calculated as `10000 - abs(predicted - actual) * 100` (max 10000 = 100%)

## How It Works

### User Workflow

1. **Connect Wallet**: User connects their MetaMask or compatible wallet
2. **Create Prediction**: 
   - Enter location, target date, predicted temperature, and confidence level
   - Frontend encrypts temperature and confidence using FHEVM
   - Submit encrypted prediction to smart contract
3. **View Predictions**: 
   - View all user's predictions
   - Decrypt own predictions to verify encryption/decryption works
4. **After Target Date**:
   - Contract owner reveals predictions with actual temperature
   - Accuracy is calculated and leaderboard is updated
   - All users can view decrypted predictions and leaderboard

### Encryption/Decryption Process

1. **Encryption (Client-Side)**:
   - User inputs temperature (e.g., 25.5°C) and confidence (e.g., 85%)
   - Values are multiplied by 10 for precision (255, 850)
   - FHEVM encrypts values using user's public key
   - Encrypted handles and ZK proofs are generated
   - Data is submitted to contract

2. **Storage (On-Chain)**:
   - Contract receives encrypted handles and proofs
   - Validates proofs and converts to internal `euint32` format
   - Grants decryption permissions to contract and user
   - Stores encrypted data in contract storage

3. **Decryption (Client-Side)**:
   - User requests encrypted handle from contract
   - FHEVM generates keypair and EIP-712 signature
   - Decryption request is sent to FHEVM relayer (Sepolia) or mock (localhost)
   - Decrypted value is returned and divided by 10 to get original value

### Security Model

- **Privacy**: Predictions are encrypted on-chain, only owners can decrypt before reveal
- **Verifiability**: ZK proofs ensure encrypted values are within valid ranges
- **Access Control**: FHEVM permission system restricts decryption access
- **Transparency**: After reveal, all predictions are publicly accessible for leaderboard

## Network Configuration

- **Local Network**: Chain ID 31337, uses Mock FHEVM with Hardhat plugin
- **Sepolia Testnet**: Chain ID 11155111, uses official FHEVM SDK with relayer

## Deployment

### Local Network

```bash
# Start Hardhat node
npx hardhat node

# Deploy contract
npx hardhat deploy --network localhost

# Update ui/src/config/contracts.ts with deployed address
```

### Sepolia Testnet

```bash
# Deploy to Sepolia
npx hardhat deploy --network sepolia

# Update ui/src/config/contracts.ts with deployed address

# Verify contract on Etherscan
npx hardhat verify --network sepolia <CONTRACT_ADDRESS>
```

### Vercel Deployment

1. **Get WalletConnect Project ID**
   - Go to [WalletConnect Cloud](https://cloud.walletconnect.com/)
   - Create a new project or use existing one
   - Copy your Project ID

2. **Update WalletConnect Project ID**
   - Open `ui/src/lib/wagmi.ts`
   - Replace `YOUR_PROJECT_ID` with your actual WalletConnect Project ID

3. **Deploy to Vercel**
   ```bash
   # Install Vercel CLI (if not already installed)
   npm i -g vercel

   # Navigate to ui directory
   cd ui

   # Deploy to Vercel
   vercel

   # Or connect via Vercel dashboard:
   # 1. Go to https://vercel.com
   # 2. Import your Git repository
   # 3. Set Root Directory to "ui"
   # 4. Framework Preset: Vite
   # 5. Build Command: npm run build
   # 6. Output Directory: dist
   ```

4. **Configure Environment Variables (if needed)**
   - In Vercel dashboard, go to Project Settings > Environment Variables
   - Add any required environment variables

5. **Update Contract Address for Production**
   - After deploying contract to Sepolia, update `ui/src/config/contracts.ts`
   - Set `CONTRACT_ADDRESSES[11155111]` with your Sepolia contract address
   - Redeploy to Vercel

## Technology Stack

### Smart Contracts
- **Solidity**: ^0.8.24
- **FHEVM**: Zama's Fully Homomorphic Encryption Virtual Machine
- **Hardhat**: Development environment and testing framework
- **TypeChain**: TypeScript bindings for smart contracts

### Frontend
- **React**: UI framework
- **TypeScript**: Type-safe JavaScript
- **Vite**: Build tool and dev server
- **Wagmi**: React hooks for Ethereum
- **RainbowKit**: Wallet connection UI
- **shadcn/ui**: UI component library
- **Tailwind CSS**: Styling framework

### FHEVM Integration
- **@fhevm/solidity**: Solidity library for FHE operations
- **@fhevm/hardhat-plugin**: Hardhat plugin for local FHEVM
- **@fhevm/mock-utils**: Mock FHEVM utilities for local testing
- **@zama-fhe/relayer-sdk**: Official FHEVM SDK for Sepolia testnet

## Documentation

- [FHEVM Documentation](https://docs.zama.ai/fhevm)
- [FHEVM Hardhat Setup Guide](https://docs.zama.ai/protocol/solidity-guides/getting-started/setup)
- [FHEVM Testing Guide](https://docs.zama.ai/protocol/solidity-guides/development-guide/hardhat/write_test)
- [Zama FHEVM GitHub](https://github.com/zama-ai/fhevm)

## License

This project is licensed under the BSD-3-Clause-Clear License. See the [LICENSE](LICENSE) file for details.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/zama-ai/fhevm/issues)
- **Documentation**: [FHEVM Docs](https://docs.zama.ai)
- **Community**: [Zama Discord](https://discord.gg/zama)
