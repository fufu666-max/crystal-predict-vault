import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { PrivateWeatherGuess, PrivateWeatherGuess__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("PrivateWeatherGuess")) as PrivateWeatherGuess__factory;
  const contract = (await factory.deploy()) as PrivateWeatherGuess;
  const contractAddress = await contract.getAddress();

  return { contract, contractAddress };
}

describe("PrivateWeatherGuess", function () {
  let signers: Signers;
  let contract: PrivateWeatherGuess;
  let contractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract, contractAddress } = await deployFixture());
  });

  it("should have correct initial state after deployment", async function () {
    const owner = await contract.owner();
    expect(owner).to.eq(signers.deployer.address);
    
    const paused = await contract.paused();
    expect(paused).to.be.false;
    
    const predictionCount = await contract.getPredictionCount();
    expect(predictionCount).to.eq(0);
  });

  it("should allow user to submit encrypted weather prediction", async function () {
    const location = "New York";
    const targetDate = Math.floor(Date.now() / 1000) + 86400; // Tomorrow
    const temperature = 255; // 25.5°C (multiplied by 10)
    const confidence = 850; // 85% (multiplied by 10)

    // Encrypt temperature
    const encryptedTemp = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(temperature)
      .encrypt();

    // Encrypt confidence
    const encryptedConf = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(confidence)
      .encrypt();

    const tx = await contract
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

    const predictionCount = await contract.getPredictionCount();
    expect(predictionCount).to.eq(1);

    const [predictor, predLocation, predTargetDate] = await contract.getPrediction(0);
    expect(predictor).to.eq(signers.alice.address);
    expect(predLocation).to.eq(location);
    expect(predTargetDate).to.eq(targetDate);
  });

  it("should allow prediction owner to access encrypted data", async function () {
    const location = "London";
    const targetDate = Math.floor(Date.now() / 1000) + 86400;
    const temperature = 180; // 18.0°C
    const confidence = 900; // 90%

    const encryptedTemp = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(temperature)
      .encrypt();

    const encryptedConf = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(confidence)
      .encrypt();

    const tx = await contract
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

    // Owner should be able to get encrypted temperature
    const encryptedTempHandle = await contract
      .connect(signers.alice)
      .getEncryptedTemperature(0);
    expect(encryptedTempHandle).to.not.eq(ethers.ZeroHash);

    // Decrypt to verify
    const decryptedTemp = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedTempHandle,
      contractAddress,
      signers.alice
    );
    expect(decryptedTemp).to.eq(temperature);
  });

  it("should prevent non-owners from accessing encrypted data before reveal", async function () {
    const location = "Tokyo";
    const targetDate = Math.floor(Date.now() / 1000) + 86400;
    const temperature = 220; // 22.0°C
    const confidence = 750; // 75%

    const encryptedTemp = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(temperature)
      .encrypt();

    const encryptedConf = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(confidence)
      .encrypt();

    const tx = await contract
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

    // Bob should not be able to access encrypted data
    await expect(
      contract.connect(signers.bob).getEncryptedTemperature(0)
    ).to.be.revertedWith("Only prediction owner can access encrypted data before reveal");
  });

  it("should allow owner to reveal prediction after target date", async function () {
    const location = "Paris";
    const targetDate = Math.floor(Date.now() / 1000) - 86400; // Yesterday (already passed)
    const temperature = 200; // 20.0°C
    const confidence = 800; // 80%
    const actualTemperature = 195; // 19.5°C

    const encryptedTemp = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(temperature)
      .encrypt();

    const encryptedConf = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(confidence)
      .encrypt();

    const tx = await contract
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

    // Owner can reveal
    const revealTx = await contract
      .connect(signers.deployer)
      .revealPrediction(0, actualTemperature);
    await revealTx.wait();

    const [, , , , isRevealed] = await contract.getPrediction(0);
    expect(isRevealed).to.be.true;

    // After reveal, anyone can access encrypted data
    const encryptedTempHandle = await contract
      .connect(signers.bob)
      .getEncryptedTemperature(0);
    expect(encryptedTempHandle).to.not.eq(ethers.ZeroHash);
  });

  it("should track user predictions correctly", async function () {
    const location = "Berlin";
    const targetDate = Math.floor(Date.now() / 1000) + 86400;
    const temperature = 150; // 15.0°C
    const confidence = 700; // 70%

    const encryptedTemp = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(temperature)
      .encrypt();

    const encryptedConf = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(confidence)
      .encrypt();

    // Submit first prediction
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

    // Submit second prediction
    const encryptedTemp2 = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(200)
      .encrypt();

    const encryptedConf2 = await fhevm
      .createEncryptedInput(contractAddress, signers.alice.address)
      .add32(900)
      .encrypt();

    tx = await contract
      .connect(signers.alice)
      .submitPrediction(
        "Moscow",
        targetDate + 86400,
        encryptedTemp2.handles[0],
        encryptedTemp2.inputProof,
        encryptedConf2.handles[0],
        encryptedConf2.inputProof
      );
    await tx.wait();

    const userCount = await contract.getUserPredictionCount(signers.alice.address);
    expect(userCount).to.eq(2);

    const userPredictions = await contract.getUserPredictions(signers.alice.address);
    expect(userPredictions.length).to.eq(2);
    expect(userPredictions[0]).to.eq(0);
    expect(userPredictions[1]).to.eq(1);
  });
});

