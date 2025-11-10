import { useContractRead, useAccount, useChainId, useWalletClient } from 'wagmi';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { getContractAddress, CONTRACT_ABI } from '../config/contracts';
import { getFHEVMInstance, encryptInput, decryptEuint32 } from '../lib/fhevm';
import { toast } from 'sonner';
import { ethers } from 'ethers';

export interface Prediction {
  predictor: string;
  location: string;
  targetDate: number;
  submissionTime: number;
  isRevealed: boolean;
  isActive: boolean;
}

export interface LeaderboardEntry {
  predictor: string;
  actualTemperature: number;
  accuracy: number;
}

// Hook to get contract address
export const useContractAddress = () => {
  const chainId = useChainId();
  const address = getContractAddress(chainId);
  if (!address) {
    console.warn(`[useContractAddress] Contract not deployed on chain ${chainId}. Please deploy the contract and update ui/src/config/contracts.ts`);
  }
  return address;
};

// Hook to get prediction count
export const usePredictionCount = () => {
  const contractAddress = useContractAddress();

  return useContractRead({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getPredictionCount',
    enabled: !!contractAddress,
  });
};

// Hook to get user prediction count
export const useUserPredictionCount = (userAddress?: string) => {
  const { address } = useAccount();
  const contractAddress = useContractAddress();
  const targetAddress = userAddress || address;

  return useContractRead({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getUserPredictionCount',
    args: targetAddress ? [targetAddress] : undefined,
    enabled: !!contractAddress && !!targetAddress,
  });
};

// Hook to get user predictions
export const useUserPredictions = (userAddress?: string) => {
  const { address } = useAccount();
  const contractAddress = useContractAddress();
  const targetAddress = userAddress || address;

  return useContractRead({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getUserPredictions',
    args: targetAddress ? [targetAddress] : undefined,
    enabled: !!contractAddress && !!targetAddress,
  });
};

// Hook to get prediction details
export const usePrediction = (predictionId: number) => {
  const contractAddress = useContractAddress();

  const result = useContractRead({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getPrediction',
    args: [predictionId],
    enabled: !!contractAddress && predictionId >= 0,
  });

  const transformedData = result.data ? {
    predictor: String(result.data[0] || ''),
    location: String(result.data[1] || ''),
    targetDate: Number(result.data[2] || 0),
    submissionTime: Number(result.data[3] || 0),
    isRevealed: result.data[4] === true || result.data[4] === 1 || String(result.data[4]).toLowerCase() === 'true',
    isActive: result.data[5] === true || result.data[5] === 1 || String(result.data[5]).toLowerCase() === 'true',
  } as Prediction : undefined;

  return {
    ...result,
    data: transformedData,
  };
};

// Hook to submit prediction
export const useSubmitPrediction = () => {
  const contractAddress = useContractAddress();
  const queryClient = useQueryClient();
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();

  return useMutation({
    mutationFn: async (params: {
      location: string;
      targetDate: number;
      temperature: number; // Temperature in Celsius (e.g., 25.5)
      confidence: number; // Confidence 0-100 (e.g., 85)
    }) => {
      if (!contractAddress) throw new Error('Contract not available');
      if (!address) throw new Error('Wallet not connected');

      // Initialize FHEVM
      const fhevm = await getFHEVMInstance(chainId);
      console.log('[Prediction] FHEVM initialized');

      // Convert temperature to integer (multiply by 10 for precision)
      const temperatureInt = Math.round(params.temperature * 10);
      // Convert confidence to integer (multiply by 10, e.g., 85% = 850)
      const confidenceInt = Math.round(params.confidence * 10);

      // Encrypt temperature
      const encryptedTemp = await encryptInput(fhevm, contractAddress, address, temperatureInt);
      console.log('[Prediction] Temperature encrypted');

      // Encrypt confidence
      const encryptedConf = await encryptInput(fhevm, contractAddress, address, confidenceInt);
      console.log('[Prediction] Confidence encrypted');

      // Use ethers.js directly
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("No wallet provider detected");
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum, "any");
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);

      console.log('[Prediction] Submitting prediction...', {
        location: params.location,
        targetDate: params.targetDate,
        contractAddress,
      });

      const tx = await contract.submitPrediction(
        params.location,
        params.targetDate,
        encryptedTemp.handles[0],
        encryptedTemp.inputProof,
        encryptedConf.handles[0],
        encryptedConf.inputProof
      );

      console.log('[Prediction] Transaction sent:', tx.hash);
      const receipt = await tx.wait();
      console.log('[Prediction] Transaction confirmed:', receipt);

      return receipt;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['predictions'] });
      queryClient.invalidateQueries({ queryKey: ['userPredictions'] });
      toast.success('Prediction submitted successfully!');
    },
    onError: (error: any) => {
      console.error('[Prediction] Submission failed:', error);
      toast.error(error.message || 'Failed to submit prediction');
    },
  });
};

// Hook to decrypt prediction
export const useDecryptPrediction = () => {
  const contractAddress = useContractAddress();
  const { address } = useAccount();
  const chainId = useChainId();
  const { data: walletClient } = useWalletClient();

  return useMutation({
    mutationFn: async (params: {
      predictionId: number;
      type: 'temperature' | 'confidence';
    }) => {
      if (!contractAddress) throw new Error('Contract not available');
      if (!address) throw new Error('Wallet not connected');

      // Initialize FHEVM
      const fhevm = await getFHEVMInstance(chainId);

      // Get ethers signer
      if (typeof window === "undefined" || !(window as any).ethereum) {
        throw new Error("No wallet provider detected");
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum, "any");
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, CONTRACT_ABI, signer);

      // Get encrypted handle
      let encryptedHandle: string;
      if (params.type === 'temperature') {
        encryptedHandle = await contract.getEncryptedTemperature(params.predictionId);
      } else {
        encryptedHandle = await contract.getEncryptedConfidence(params.predictionId);
      }

      console.log('[Decrypt] Encrypted handle:', encryptedHandle);

      // Decrypt
      const decryptedValue = await decryptEuint32(
        fhevm,
        encryptedHandle,
        contractAddress,
        address,
        signer,
        chainId
      );

      // Convert back from integer
      const result = params.type === 'temperature' 
        ? decryptedValue / 10  // Temperature: divide by 10
        : decryptedValue / 10;  // Confidence: divide by 10

      return result;
    },
    onError: (error: any) => {
      console.error('[Decrypt] Decryption failed:', error);
      toast.error(error.message || 'Failed to decrypt prediction');
    },
  });
};

// Hook to get leaderboard entry
export const useLeaderboardEntry = (predictionId: number) => {
  const contractAddress = useContractAddress();

  const result = useContractRead({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getLeaderboardEntry',
    args: [predictionId],
    enabled: !!contractAddress && predictionId >= 0,
  });

  const transformedData = result.data ? {
    predictor: String(result.data[0] || ''),
    actualTemperature: Number(result.data[1] || 0) / 10, // Convert from integer
    accuracy: Number(result.data[2] || 0) / 100, // Convert from basis points (10000 = 100%)
  } as LeaderboardEntry : undefined;

  return {
    ...result,
    data: transformedData,
  };
};

// Hook to get leaderboard count
export const useLeaderboardCount = () => {
  const contractAddress = useContractAddress();

  return useContractRead({
    address: contractAddress as `0x${string}`,
    abi: CONTRACT_ABI,
    functionName: 'getLeaderboardCount',
    enabled: !!contractAddress,
  });
};

