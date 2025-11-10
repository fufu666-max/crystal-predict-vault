// FHEVM SDK utilities for frontend
import { ethers, JsonRpcProvider } from "ethers";

// Import @zama-fhe/relayer-sdk (dynamic import for Sepolia only)
// For localhost, we use @fhevm/mock-utils instead
let createInstance: any = null;
let initSDK: any = null;
let SepoliaConfig: any = null;
type FhevmInstance = any;

// Import @fhevm/mock-utils for localhost mock FHEVM
let MockFhevmInstance: any = null;
let userDecryptHandleBytes32: any = null;

export interface EncryptedInput {
  handles: string[];
  inputProof: string;
}

let fhevmInstance: FhevmInstance | null = null;
let isSDKInitialized = false;
let lastChainId: number | null = null; // Track the chainId used to create fhevmInstance

/**
 * Initialize FHEVM instance
 * Local network (31337): Uses @fhevm/mock-utils + Hardhat plugin
 * Sepolia (11155111): Uses @zama-fhe/relayer-sdk
 */
export async function initializeFHEVM(chainId?: number): Promise<FhevmInstance> {
  // Check window.ethereum
  if (typeof window === "undefined" || !(window as any).ethereum) {
    throw new Error("window.ethereum is not available. Please install MetaMask.");
  }

  // Get chainId first
  let currentChainId = chainId;
  if (!currentChainId) {
    try {
      const chainIdHex = await (window as any).ethereum.request({ method: "eth_chainId" });
      currentChainId = parseInt(chainIdHex, 16);
    } catch (error) {
      console.error("[FHEVM] Failed to get chainId:", error);
      currentChainId = 31337;
    }
  }

  console.log("[FHEVM] Current chain ID:", currentChainId);

  // If fhevmInstance exists but chainId changed, reset it
  if (fhevmInstance && lastChainId !== null && lastChainId !== currentChainId) {
    console.log(`[FHEVM] Chain ID changed from ${lastChainId} to ${currentChainId}. Resetting FHEVM instance...`);
    fhevmInstance = null;
    lastChainId = null;
    // Reset SDK initialization flag if switching from Sepolia
    if (lastChainId === 11155111) {
      isSDKInitialized = false;
    }
  }

  if (!fhevmInstance) {
    // Initialize SDK for Sepolia only
    if (currentChainId === 11155111 && !isSDKInitialized) {
      console.log("[FHEVM] Initializing FHE SDK for Sepolia...");
      
      try {
        // Dynamically import Sepolia SDK only when needed
        if (!createInstance || !initSDK || !SepoliaConfig) {
          const sdk = await import("@zama-fhe/relayer-sdk/bundle");
          createInstance = sdk.createInstance;
          initSDK = sdk.initSDK;
          SepoliaConfig = sdk.SepoliaConfig;
        }
        
        if (initSDK) {
          await initSDK();
          isSDKInitialized = true;
          console.log("[FHEVM] ✅ SDK initialized successfully");
        }
      } catch (error: any) {
        console.error("[FHEVM] SDK initialization failed:", error);
        console.warn("[FHEVM] Continuing with createInstance...");
      }
    }

    // Local network: Use Mock FHEVM
    if (currentChainId === 31337) {
      const localhostRpcUrl = "http://localhost:8545";
      
      try {
        console.log("[FHEVM] Fetching FHEVM metadata from Hardhat node...");
        const provider = new JsonRpcProvider(localhostRpcUrl);
        const metadata = await provider.send("fhevm_relayer_metadata", []);
        
        console.log("[FHEVM] Metadata:", metadata);
        
        if (metadata && metadata.ACLAddress && metadata.InputVerifierAddress && metadata.KMSVerifierAddress) {
          // Use @fhevm/mock-utils to create mock instance
          if (!MockFhevmInstance || !userDecryptHandleBytes32) {
            const mockUtils = await import("@fhevm/mock-utils");
            MockFhevmInstance = mockUtils.MockFhevmInstance;
            userDecryptHandleBytes32 = mockUtils.userDecryptHandleBytes32;
            console.log("[FHEVM] ✅ Loaded mock-utils");
          }
          
          console.log("[FHEVM] Creating MockFhevmInstance...");
          
          const mockInstance = await MockFhevmInstance.create(provider, provider, {
            aclContractAddress: metadata.ACLAddress,
            chainId: 31337,
            gatewayChainId: 55815,
            inputVerifierContractAddress: metadata.InputVerifierAddress,
            kmsContractAddress: metadata.KMSVerifierAddress,
            verifyingContractAddressDecryption: "0x5ffdaAB0373E62E2ea2944776209aEf29E631A64",
            verifyingContractAddressInputVerification: "0x812b06e1CDCE800494b79fFE4f925A504a9A9810",
          });
          
          console.log("[FHEVM] Mock instance created:", {
            constructor: mockInstance.constructor?.name,
            type: typeof mockInstance,
            hasGenerateKeypair: typeof mockInstance.generateKeypair === 'function',
          });
          
          // Add generateKeypair method if it doesn't exist
          if (typeof mockInstance.generateKeypair !== 'function') {
            console.log("[FHEVM] Adding generateKeypair method to Mock instance...");
            (mockInstance as any).generateKeypair = () => {
              return {
                publicKey: new Uint8Array(32).fill(0),
                privateKey: new Uint8Array(32).fill(0),
              };
            };
            console.log("[FHEVM] ✅ Added generateKeypair method to Mock instance");
          }
          
          fhevmInstance = mockInstance;
          lastChainId = currentChainId;
          console.log("[FHEVM] ✅ Mock FHEVM instance created successfully!");
          return mockInstance;
        } else {
          throw new Error("FHEVM metadata is incomplete");
        }
      } catch (error: any) {
        console.error("[FHEVM] Failed to create Mock instance:", error);
        throw new Error(
          `Local Hardhat node FHEVM initialization failed: ${error.message}\n\n` +
          `Please ensure:\n` +
          `1. Hardhat node is running (npx hardhat node)\n` +
          `2. @fhevm/hardhat-plugin is imported in hardhat.config.ts\n` +
          `3. Restart Hardhat node and retry`
        );
      }
    }
    
    // Sepolia network: Use official SDK with MetaMask provider to avoid CORS
    else if (currentChainId === 11155111) {
      try {
        console.log("[FHEVM] Creating Sepolia FHEVM instance...");
        
        if (typeof window === "undefined" || !(window as any).ethereum) {
          throw new Error("MetaMask not detected. Please install MetaMask to use Sepolia network.");
        }
        
        // Dynamically import Sepolia SDK if not already loaded
        if (!createInstance || !SepoliaConfig) {
          const sdk = await import("@zama-fhe/relayer-sdk/bundle");
          createInstance = sdk.createInstance;
          initSDK = sdk.initSDK;
          SepoliaConfig = sdk.SepoliaConfig;
        }
        
        // Initialize SDK if not already initialized
        if (!isSDKInitialized && initSDK) {
          try {
            await initSDK();
            isSDKInitialized = true;
            console.log("[FHEVM] ✅ SDK initialized successfully");
          } catch (initError: any) {
            console.warn("[FHEVM] SDK initialization failed, continuing:", initError);
          }
        }
        
        // Create config using MetaMask provider (no CORS issues)
        const config = {
          ...SepoliaConfig,
          network: (window as any).ethereum,  // Use MetaMask provider
        };
        
        fhevmInstance = await createInstance(config);
        lastChainId = currentChainId;
        console.log("[FHEVM] ✅ Sepolia FHEVM instance created successfully!");
      } catch (error: any) {
        console.error("[FHEVM] ❌ Sepolia instance creation failed:", error);
        throw new Error(
          `Failed to create Sepolia FHEVM instance: ${error.message || "Unknown error"}`
        );
      }
    }
    
    else {
      throw new Error(`Unsupported network (Chain ID: ${currentChainId}). Please switch to local network (31337) or Sepolia (11155111).`);
    }
  }
  
  return fhevmInstance;
}

/**
 * Get or initialize FHEVM instance
 */
export async function getFHEVMInstance(chainId?: number): Promise<FhevmInstance> {
  return initializeFHEVM(chainId);
}

/**
 * Encrypt input data
 */
export async function encryptInput(
  fhevm: FhevmInstance,
  contractAddress: string,
  userAddress: string,
  value: number
): Promise<EncryptedInput> {
  try {
    const encryptedInput = fhevm
      .createEncryptedInput(contractAddress, userAddress)
      .add32(value);
    
    const encrypted = await encryptedInput.encrypt();
    
    // Convert to format required by contract
    const handles = encrypted.handles.map(handle => {
      const hexHandle = ethers.hexlify(handle);
      if (hexHandle.length < 66) {
        const padded = hexHandle.slice(2).padStart(64, '0');
        return `0x${padded}`;
      }
      if (hexHandle.length > 66) {
        return hexHandle.slice(0, 66);
      }
      return hexHandle;
    });
    
    return {
      handles,
      inputProof: ethers.hexlify(encrypted.inputProof),
    };
  } catch (error: any) {
    console.error("[FHEVM] Encryption failed:", error);
    throw new Error(`Encryption failed: ${error.message || "Unknown error"}`);
  }
}

/**
 * Decrypt euint32 value (single value)
 */
export async function decryptEuint32(
  fhevm: FhevmInstance,
  handle: string,
  contractAddress: string,
  userAddress: string,
  signer: any,
  chainId?: number
): Promise<number> {
  // Validate handle format
  if (!handle || handle === "0x" || handle.length !== 66) {
    throw new Error(`Invalid handle format: ${handle}. Expected 66 characters (0x + 64 hex chars)`);
  }

  const isLocalNetwork = chainId === 31337;
  const isSepoliaNetwork = chainId === 11155111;
  
  if (isLocalNetwork) {
    const mockInstance = fhevm || await getFHEVMInstance(chainId);
    
    if (!mockInstance) {
      throw new Error("Mock FHEVM instance not available for local network");
    }
    
    // Ensure generateKeypair method exists
    if (typeof mockInstance.generateKeypair !== 'function') {
      (mockInstance as any).generateKeypair = () => ({
        publicKey: new Uint8Array(32).fill(0),
        privateKey: new Uint8Array(32).fill(0),
      });
    }
    
    const keypair = mockInstance.generateKeypair();
    const contractAddresses = [contractAddress];
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10";
    
    const eip712 = mockInstance.createEIP712(
      keypair.publicKey,
      contractAddresses,
      startTimeStamp,
      durationDays
    );
    
    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );
    
    const result = await mockInstance.userDecrypt(
      [{ handle, contractAddress }],
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddresses,
      userAddress,
      startTimeStamp,
      durationDays
    );
    
    const value = result[handle];
    if (value === undefined) {
      throw new Error(`Decryption failed: No value returned for handle ${handle}`);
    }
    
    return Number(value);
  } else if (isSepoliaNetwork) {
    if (!fhevm) {
      throw new Error(
        `FHEVM instance is null or undefined. ` +
        `Please ensure you're connected to Sepolia network (Chain ID: 11155111) and FHEVM is properly initialized.`
      );
    }
    
    if (typeof fhevm.generateKeypair !== 'function') {
      throw new Error(
        `Invalid FHEVM instance for Sepolia network. ` +
        `Expected Sepolia FHEVM instance with generateKeypair method.`
      );
    }
    
    const keypair = fhevm.generateKeypair();
    const contractAddresses = [contractAddress];
    
    const startTimeStamp = Math.floor(Date.now() / 1000).toString();
    const durationDays = "10";
    
    const eip712 = fhevm.createEIP712(
      keypair.publicKey,
      contractAddresses,
      startTimeStamp,
      durationDays
    );
    
    const signature = await signer.signTypedData(
      eip712.domain,
      { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
      eip712.message
    );
    
    const result = await fhevm.userDecrypt(
      [{ handle, contractAddress }],
      keypair.privateKey,
      keypair.publicKey,
      signature.replace("0x", ""),
      contractAddresses,
      userAddress,
      startTimeStamp,
      durationDays
    );
    
    return Number(result[handle] || 0);
  } else {
    throw new Error(
      `Unsupported network for decryption. ChainId: ${chainId}. ` +
      `Supported networks: Local (31337) or Sepolia (11155111).`
    );
  }
}

/**
 * Reset FHEVM instance (for network switching)
 */
export function resetFHEVMInstance() {
  fhevmInstance = null;
  lastChainId = null;
  console.log("[FHEVM] Instance and chainId tracking reset");
}

