import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm, deployments } from "hardhat";
import { PrivateWeatherGuess } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  alice: HardhatEthersSigner;
};

describe("PrivateWeatherGuessSepolia", function () {
  let signers: Signers;
  let contract: PrivateWeatherGuess;
  let contractAddress: string;
  let step: number;
  let steps: number;

  function progress(message: string) {
    console.log(`${++step}/${steps} ${message}`);
  }

  before(async function () {
    if (fhevm.isMock) {
      console.warn(`This hardhat test suite can only run on Sepolia Testnet`);
      this.skip();
    }

    try {
      const PrivateWeatherGuessDeployment = await deployments.get("PrivateWeatherGuess");
      contractAddress = PrivateWeatherGuessDeployment.address;
      contract = await ethers.getContractAt("PrivateWeatherGuess", PrivateWeatherGuessDeployment.address);
    } catch (e) {
      (e as Error).message += ". Call 'npx hardhat deploy --network sepolia'";
      throw e;
    }

    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { alice: ethSigners[0] };
  });

  beforeEach(async () => {
    step = 0;
    steps = 0;
  });

  it("submit and decrypt weather prediction", async function () {
    steps = 12;

    this.timeout(4 * 40000);

    const location = "San Francisco";
    const targetDate = Math.floor(Date.now() / 1000) + 86400; // Tomorrow
    const temperature = 200; // 20.0°C
    const confidence = 850; // 85%

    progress(`Encrypting temperature ${temperature}...`);
    const encryptedTemp = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(temperature)
      .encrypt();

    progress(`Encrypting confidence ${confidence}...`);
    const encryptedConf = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(confidence)
      .encrypt();

    progress(
      `Call submitPrediction() PrivateWeatherGuess=${contractAddress} signer=${signers.alice.address}...`
    );
    let tx = await contract
      .connect(signers.alice)
      .submitPrediction(
        location,
        targetDate,
        encryptedTemp.handles[0],
        encryptedTemp.inputProof,
        encryptedConf.handles[0],
        encryptedConf.inputProof
      );
    await tx.wait();

    progress(`Call getPredictionCount()...`);
    const predictionCount = await contract.getPredictionCount();
    expect(predictionCount).to.be.gt(0);

    const predictionId = Number(predictionCount) - 1;

    progress(`Call getPrediction(${predictionId})...`);
    const [predictor, predLocation] = await contract.getPrediction(predictionId);
    expect(predictor).to.eq(signers.alice.address);
    expect(predLocation).to.eq(location);

    progress(`Call getEncryptedTemperature(${predictionId})...`);
    const encryptedTempHandle = await contract
      .connect(signers.alice)
      .getEncryptedTemperature(predictionId);
    expect(encryptedTempHandle).to.not.eq(ethers.ZeroHash);

    progress(`Decrypting temperature handle=${encryptedTempHandle}...`);
    const decryptedTemp = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedTempHandle,
      contractAddress,
      signers.alice
    );
    progress(`Decrypted temperature=${decryptedTemp}`);

    expect(decryptedTemp).to.eq(temperature);

    progress(`Call getEncryptedConfidence(${predictionId})...`);
    const encryptedConfHandle = await contract
      .connect(signers.alice)
      .getEncryptedConfidence(predictionId);
    expect(encryptedConfHandle).to.not.eq(ethers.ZeroHash);

    progress(`Decrypting confidence handle=${encryptedConfHandle}...`);
    const decryptedConf = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedConfHandle,
      contractAddress,
      signers.alice
    );
    progress(`Decrypted confidence=${decryptedConf}`);

    expect(decryptedConf).to.eq(confidence);
  });
});

