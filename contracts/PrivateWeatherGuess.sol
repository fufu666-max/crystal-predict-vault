// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint32, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title PrivateWeatherGuess - Encrypted Weather Temperature Prediction System
/// @notice A fully homomorphic encryption (FHE) based weather prediction system that allows users to submit
///         encrypted temperature predictions. All predictions are stored encrypted and can only be decrypted
///         after the prediction period ends for ranking purposes.
/// @dev This contract uses Zama's FHEVM technology to perform computations on encrypted data.
///      Each prediction contains up to 2 encrypted values: predicted temperature and confidence level.
/// @custom:security-contact security@crystal-predict-vault.com
contract PrivateWeatherGuess is SepoliaConfig {
    address public owner;
    bool public paused;

    // Prediction data structure
    struct Prediction {
        address predictor; // User who made the prediction
        string location; // Location for weather prediction (plain text)
        uint256 targetDate; // Target date for the prediction (Unix timestamp)
        uint256 submissionTime; // When prediction was submitted
        bool isRevealed; // Whether prediction has been revealed/decrypted
        bool isActive; // Active status
    }

    // Encrypted prediction data
    struct EncryptedPredictionData {
        euint32 encryptedTemperature; // Encrypted temperature in Celsius (multiplied by 10 for precision)
        euint32 encryptedConfidence; // Encrypted confidence level (0-100, multiplied by 10)
    }

    // Prediction storage
    mapping(uint256 => Prediction) public predictions;
    mapping(uint256 => EncryptedPredictionData) private _encryptedData;
    uint256 public predictionCount;

    // User management
    mapping(address => uint256[]) private _userPredictions; // User's prediction IDs
    mapping(address => uint256) private _userPredictionCount; // Number of predictions per user

    // Leaderboard data (stored after decryption)
    struct LeaderboardEntry {
        address predictor;
        int256 actualTemperature; // Actual temperature (can be negative)
        uint256 predictionId;
        uint256 accuracy; // Accuracy score (0-10000, where 10000 = 100.00%)
    }

    mapping(uint256 => LeaderboardEntry) public leaderboard; // predictionId => leaderboard entry
    uint256[] public leaderboardIds; // Sorted prediction IDs by accuracy

    // Events
    event PredictionSubmitted(
        uint256 indexed predictionId,
        address indexed predictor,
        string location,
        uint256 targetDate,
        uint256 timestamp
    );
    event PredictionRevealed(
        uint256 indexed predictionId,
        address indexed predictor,
        int256 actualTemperature,
        uint256 accuracy
    );
    event LeaderboardUpdated(uint256 indexed predictionId, uint256 accuracy);
    event Paused(address account);
    event Unpaused(address account);
    event OwnershipTransferred(address indexed previousOwner, address indexed newOwner);

    constructor() {
        owner = msg.sender;
        paused = false;
    }

    /// @notice Submit new encrypted weather prediction
    function submitPrediction(
        string memory location,
        uint256 targetDate,
        externalEuint32 encryptedTemperature,
        bytes calldata temperatureProof,
        externalEuint32 encryptedConfidence,
        bytes calldata confidenceProof
    ) external {
        uint256 predictionId = predictionCount++;

        // Import encrypted values
        euint32 encryptedTemp = FHE.fromExternal(encryptedTemperature, temperatureProof);
        euint32 encryptedConf = FHE.fromExternal(encryptedConfidence, confidenceProof);

        // Create prediction
        predictions[predictionId] = Prediction({
            predictor: msg.sender,
            location: location,
            targetDate: targetDate,
            submissionTime: block.timestamp,
            isRevealed: false,
            isActive: true
        });

        // Store encrypted data
        _encryptedData[predictionId] = EncryptedPredictionData({
            encryptedTemperature: encryptedTemp,
            encryptedConfidence: encryptedConf
        });

        // Update user predictions
        _userPredictions[msg.sender].push(predictionId);
        _userPredictionCount[msg.sender]++;

        emit PredictionSubmitted(predictionId, msg.sender, location, targetDate, block.timestamp);
    }

    /// @notice Get prediction basic information
    function getPrediction(uint256 predictionId) external view returns (
        address predictor,
        string memory location,
        uint256 targetDate,
        uint256 submissionTime,
        bool isRevealed,
        bool isActive
    ) {
        Prediction storage prediction = predictions[predictionId];
        return (
            prediction.predictor,
            prediction.location,
            prediction.targetDate,
            prediction.submissionTime,
            prediction.isRevealed,
            prediction.isActive
        );
    }

    /// @notice Submit new encrypted weather prediction
    /// @dev Allows users to submit temperature predictions with encrypted temperature and confidence
    /// @param location Location for the weather prediction
    /// @param targetDate Target date for the prediction (Unix timestamp)
    /// @param encryptedTemperature Encrypted temperature in Celsius (multiplied by 10, e.g., 25.5°C = 255)
    /// @param temperatureProof ZK proof for encrypted temperature
    /// @param encryptedConfidence Encrypted confidence level (0-1000, where 1000 = 100%)
    /// @param confidenceProof ZK proof for encrypted confidence
    function submitPrediction(
        string memory location,
        uint256 targetDate,
        externalEuint32 encryptedTemperature,
        bytes calldata temperatureProof,
        externalEuint32 encryptedConfidence,
        bytes calldata confidenceProof
    ) external whenNotPaused {
        require(bytes(location).length > 0 && bytes(location).length <= 100, "Location must be 1-100 characters");
        require(targetDate > block.timestamp, "Target date must be in the future");
        require(targetDate <= block.timestamp + 365 days, "Target date cannot be more than 1 year in the future");

        uint256 predictionId = predictionCount++;

        // Import encrypted values
        euint32 encryptedTemp = FHE.fromExternal(encryptedTemperature, temperatureProof);
        euint32 encryptedConf = FHE.fromExternal(encryptedConfidence, confidenceProof);

        // Grant access: contract and owner can decrypt
        FHE.allowThis(encryptedTemp);
        FHE.allow(encryptedTemp, msg.sender);
        FHE.allowThis(encryptedConf);
        FHE.allow(encryptedConf, msg.sender);

        // Create prediction
        predictions[predictionId] = Prediction({
            predictor: msg.sender,
            location: location,
            targetDate: targetDate,
            submissionTime: block.timestamp,
            isRevealed: false,
            isActive: true
        });

        // Store encrypted data
        _encryptedData[predictionId] = EncryptedPredictionData({
            encryptedTemperature: encryptedTemp,
            encryptedConfidence: encryptedConf
        });

        // Update user predictions
        _userPredictions[msg.sender].push(predictionId);
        _userPredictionCount[msg.sender]++;

        emit PredictionSubmitted(predictionId, msg.sender, location, targetDate, block.timestamp);
    }

    /// @notice Get prediction basic information
    /// @param predictionId Prediction ID
    function getPrediction(uint256 predictionId) external view returns (
        address predictor,
        string memory location,
        uint256 targetDate,
        uint256 submissionTime,
        bool isRevealed,
        bool isActive
    ) {
        Prediction storage prediction = predictions[predictionId];
        return (
            prediction.predictor,
            prediction.location,
            prediction.targetDate,
            prediction.submissionTime,
            prediction.isRevealed,
            prediction.isActive
        );
    }

    /// @notice Get encrypted temperature (only accessible by prediction owner or after reveal)
    /// @param predictionId Prediction ID
    function getEncryptedTemperature(uint256 predictionId) external view returns (euint32) {
        require(predictions[predictionId].isActive, "Prediction does not exist");
        require(
            predictions[predictionId].predictor == msg.sender || predictions[predictionId].isRevealed,
            "Only prediction owner can access encrypted data before reveal"
        );
        return _encryptedData[predictionId].encryptedTemperature;
    }

    /// @notice Get encrypted confidence (only accessible by prediction owner or after reveal)
    /// @param predictionId Prediction ID
    function getEncryptedConfidence(uint256 predictionId) external view returns (euint32) {
        require(predictions[predictionId].isActive, "Prediction does not exist");
        require(
            predictions[predictionId].predictor == msg.sender || predictions[predictionId].isRevealed,
            "Only prediction owner can access encrypted data before reveal"
        );
        return _encryptedData[predictionId].encryptedConfidence;
    }

    /// @notice Reveal prediction and update leaderboard (only owner can call after target date)
    /// @param predictionId Prediction ID
    /// @param actualTemperature Actual temperature in Celsius (multiplied by 10, e.g., 25.5°C = 255)
    /// @dev This function should be called by owner after target date has passed
    function revealPrediction(uint256 predictionId, int256 actualTemperature) external onlyOwner {
        Prediction storage prediction = predictions[predictionId];
        require(prediction.isActive, "Prediction does not exist");
        require(!prediction.isRevealed, "Prediction already revealed");
        require(block.timestamp >= prediction.targetDate, "Target date has not passed yet");

        // Mark as revealed
        prediction.isRevealed = true;

        // Calculate accuracy (this would require decryption in a real scenario)
        // For now, we'll store the actual temperature and calculate accuracy off-chain
        // Accuracy calculation: 10000 - abs(predicted - actual) * 100 (max 10000 = 100%)
        // This is a simplified version - in production, you'd decrypt and compare

        leaderboard[predictionId] = LeaderboardEntry({
            predictor: prediction.predictor,
            actualTemperature: actualTemperature,
            predictionId: predictionId,
            accuracy: 0 // Will be calculated after decryption
        });

        leaderboardIds.push(predictionId);

        emit PredictionRevealed(predictionId, prediction.predictor, actualTemperature, 0);
    }

    /// @notice Update leaderboard accuracy after decryption (only owner)
    /// @param predictionId Prediction ID
    /// @param accuracy Accuracy score (0-10000, where 10000 = 100.00%)
    function updateLeaderboardAccuracy(uint256 predictionId, uint256 accuracy) external onlyOwner {
        require(predictions[predictionId].isRevealed, "Prediction must be revealed first");
        require(accuracy <= 10000, "Accuracy must be between 0 and 10000");
        
        leaderboard[predictionId].accuracy = accuracy;
        emit LeaderboardUpdated(predictionId, accuracy);
    }

    /// @notice Get user's prediction count
    /// @param user User address
    function getUserPredictionCount(address user) external view returns (uint256) {
        return _userPredictionCount[user];
    }

    /// @notice Get user's prediction IDs
    /// @param user User address
    function getUserPredictions(address user) external view returns (uint256[] memory) {
        return _userPredictions[user];
    }

    /// @notice Get leaderboard entry
    /// @param predictionId Prediction ID
    function getLeaderboardEntry(uint256 predictionId) external view returns (
        address predictor,
        int256 actualTemperature,
        uint256 accuracy
    ) {
        LeaderboardEntry storage entry = leaderboard[predictionId];
        require(entry.predictor != address(0), "Leaderboard entry does not exist");
        return (entry.predictor, entry.actualTemperature, entry.accuracy);
    }

    /// @notice Get total prediction count
    function getPredictionCount() external view returns (uint256) {
        return predictionCount;
    }

    /// @notice Get leaderboard count
    function getLeaderboardCount() external view returns (uint256) {
        return leaderboardIds.length;
    }

    /// @notice Pause contract operations (only owner)
    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit Paused(msg.sender);
    }

    /// @notice Unpause contract operations (only owner)
    function unpause() external onlyOwner whenPaused {
        paused = false;
        emit Unpaused(msg.sender);
    }

    /// @notice Transfer ownership to new owner (only owner)
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "New owner cannot be zero address");
        emit OwnershipTransferred(owner, newOwner);
        owner = newOwner;
    }
}

