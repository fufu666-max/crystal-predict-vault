import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { mainnet, sepolia, hardhat } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'Private Weather Guess',
  projectId: 'YOUR_PROJECT_ID', // Get from WalletConnect Cloud
  chains: [
    {
      ...hardhat,
      id: 31337,
      name: 'Localhost',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: {
        default: {
          http: ['http://localhost:8545'],
        },
      },
    },
    sepolia,
  ],
  ssr: false,
});
