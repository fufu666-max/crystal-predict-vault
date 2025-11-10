// Import factory - Vite will handle the ethers dependency resolution
// Path is relative to ui/src/config, going up to project root to access types
import { PrivateWeatherGuess__factory } from '../../../types/factories/contracts/PrivateWeatherGuess__factory';

// Contract addresses for different networks
export const CONTRACT_ADDRESSES = {
  // Local development (hardhat)
  31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3', // Deployed to localhost

  // Sepolia testnet (will be updated after deployment)
  11155111: '', // To be filled after sepolia deployment
} as const;

// Contract factory for deployment
export const getContractFactory = () => PrivateWeatherGuess__factory;

// Get contract address for current chain
export const getContractAddress = (chainId: number): string | null => {
  const address = CONTRACT_ADDRESSES[chainId as keyof typeof CONTRACT_ADDRESSES];
  if (!address || address === '') {
    return null;
  }
  return address;
};

// Contract ABI - extract from factory
export const CONTRACT_ABI = PrivateWeatherGuess__factory.abi;

