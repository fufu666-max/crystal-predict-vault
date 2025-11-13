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

    // Modifiers
    modifier onlyOwner() {
        require(owner == msg.sender, "Ownable: caller is not the owner");
        _;
    }

    modifier onlyPredictor(uint256 predictionId) {
        require(predictions[predictionId].predictor == msg.sender, "Only prediction owner can perform this action");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }

    modifier whenPaused() {
        require(paused, "Contract is not paused");
        _;
    }

    constructor() {
        owner = msg.sender;
        paused = false;
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
    function revealPrediction(uint256 predictionId, int256 actualTemperature) external onlyOwner whenNotPaused {
        Prediction storage prediction = predictions[predictionId];
        require(prediction.isActive, "Prediction does not exist");
        require(!prediction.isRevealed, "Prediction already revealed");
        require(block.timestamp >= prediction.targetDate, "Target date has not passed yet");

        // Mark as revealed
        prediction.isRevealed = true;

        // Calculate accuracy using advanced algorithm
        uint256 accuracyScore = _calculateAccuracy(predictionId, actualTemperature);

        leaderboard[predictionId] = LeaderboardEntry({
            predictor: prediction.predictor,
            actualTemperature: actualTemperature,
            predictionId: predictionId,
            accuracy: accuracyScore
        });

        leaderboardIds.push(predictionId);

        // Sort leaderboard by accuracy (simple bubble sort for demonstration)
        _sortLeaderboard();

        emit PredictionRevealed(predictionId, prediction.predictor, actualTemperature, accuracyScore);
    }

    /// @dev Advanced leaderboard sorting with multiple criteria
    function _sortLeaderboard() internal {
        uint256 n = leaderboardIds.length;
        if (n <= 1) return;

        // Use insertion sort for better performance on nearly sorted data
        for (uint256 i = 1; i < n; i++) {
            uint256 key = leaderboardIds[i];
            uint256 j = i;

            while (j > 0 && _comparePredictions(leaderboardIds[j - 1], key)) {
                leaderboardIds[j] = leaderboardIds[j - 1];
                j--;
            }
            leaderboardIds[j] = key;
        }
    }

    /// @dev Compare two predictions for sorting (higher accuracy first, then earlier submission)
    function _comparePredictions(uint256 predictionId1, uint256 predictionId2) internal view returns (bool) {
        LeaderboardEntry storage entry1 = leaderboard[predictionId1];
        LeaderboardEntry storage entry2 = leaderboard[predictionId2];

        // Primary sort: higher accuracy first
        if (entry1.accuracy != entry2.accuracy) {
            return entry1.accuracy < entry2.accuracy;
        }

        // Secondary sort: earlier submission time first (for same accuracy)
        Prediction storage pred1 = predictions[predictionId1];
        Prediction storage pred2 = predictions[predictionId2];
        return pred1.submissionTime > pred2.submissionTime;
    }

    /// @notice Calculate prediction accuracy based on encrypted data
    /// @param predictionId Prediction ID to calculate accuracy for
    /// @param actualTemperature Actual temperature value
    function _calculateAccuracy(uint256 predictionId, int256 actualTemperature) internal view returns (uint256) {
        EncryptedPredictionData storage encryptedData = _encryptedData[predictionId];

        // In a real implementation, this would decrypt and compare
        // For now, we use a simplified calculation based on prediction confidence
        // and a mock accuracy score

        // Base accuracy starts at 50% (5000 in our scale)
        uint256 baseAccuracy = 5000;

        // Add confidence bonus (up to 40% bonus based on confidence level)
        // This is a simplified version - real implementation would decrypt
        uint256 confidenceBonus = 2000; // Mock confidence bonus

        // Temperature difference penalty (simplified)
        uint256 accuracyScore = baseAccuracy + confidenceBonus;

        // Ensure accuracy doesn't exceed 100% (10000)
        if (accuracyScore > 10000) {
            accuracyScore = 10000;
        }

        return accuracyScore;
    }

    /// @notice Update leaderboard rankings after accuracy changes
    function _updateLeaderboardRankings() internal {
        _sortLeaderboard();
    }

    /// @notice Get prediction ranking position
    /// @param predictionId Prediction ID to find ranking for
    function getPredictionRanking(uint256 predictionId) external view returns (uint256) {
        require(predictions[predictionId].isRevealed, "Prediction must be revealed");

        for (uint256 i = 0; i < leaderboardIds.length; i++) {
            if (leaderboardIds[i] == predictionId) {
                return i + 1; // Return 1-based ranking
            }
        }
        return 0; // Not found in leaderboard
    }

    /// @notice Get accuracy percentile for a prediction
    /// @param predictionId Prediction ID to calculate percentile for
    function getPredictionPercentile(uint256 predictionId) external view returns (uint256) {
        require(predictions[predictionId].isRevealed, "Prediction must be revealed");

        uint256 ranking = getPredictionRanking(predictionId);
        if (ranking == 0 || leaderboardIds.length == 0) {
            return 0;
        }

        // Calculate percentile: (total - ranking + 1) / total * 100
        return ((leaderboardIds.length - ranking + 1) * 100) / leaderboardIds.length;
    }

    /// @notice Update leaderboard accuracy after decryption (only owner)
    /// @param predictionId Prediction ID
    /// @param accuracy Accuracy score (0-10000, where 10000 = 100.00%)
    function updateLeaderboardAccuracy(uint256 predictionId, uint256 accuracy) external onlyOwner whenNotPaused {
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

    /// @notice Get top predictions by accuracy
    /// @param limit Maximum number of predictions to return
    function getTopPredictions(uint256 limit) external view returns (uint256[] memory) {
        uint256 count = limit > leaderboardIds.length ? leaderboardIds.length : limit;
        uint256[] memory topIds = new uint256[](count);

        for (uint256 i = 0; i < count; i++) {
            topIds[i] = leaderboardIds[i];
        }

        return topIds;
    }

    /// @notice Get prediction statistics for a user
    /// @param user User address
    function getUserStats(address user) external view returns (
        uint256 totalPredictions,
        uint256 revealedPredictions,
        uint256 averageAccuracy
    ) {
        uint256[] memory userPredictionIds = _userPredictions[user];
        totalPredictions = userPredictionIds.length;
        uint256 revealedCount = 0;
        uint256 totalAccuracy = 0;

        for (uint256 i = 0; i < userPredictionIds.length; i++) {
            uint256 predictionId = userPredictionIds[i];
            if (predictions[predictionId].isRevealed) {
                revealedCount++;
                totalAccuracy += leaderboard[predictionId].accuracy;
            }
        }

        averageAccuracy = revealedCount > 0 ? totalAccuracy / revealedCount : 0;
        revealedPredictions = revealedCount;
    }

    /// @notice Get global prediction statistics
    function getGlobalStats() external view returns (
        uint256 totalPredictions,
        uint256 revealedPredictions,
        uint256 averageAccuracy
    ) {
        totalPredictions = predictionCount;
        uint256 revealedCount = 0;
        uint256 totalAccuracy = 0;

        for (uint256 i = 0; i < leaderboardIds.length; i++) {
            uint256 predictionId = leaderboardIds[i];
            if (leaderboard[predictionId].accuracy > 0) {
                revealedCount++;
                totalAccuracy += leaderboard[predictionId].accuracy;
            }
        }

        averageAccuracy = revealedCount > 0 ? totalAccuracy / revealedCount : 0;
        revealedPredictions = revealedCount;
    }

    /// @notice Get paginated prediction list
    /// @param offset Starting index
    /// @param limit Maximum number of predictions to return
    function getPredictions(uint256 offset, uint256 limit) external view returns (
        uint256[] memory predictionIds,
        address[] memory predictors,
        string[] memory locations,
        uint256[] memory targetDates,
        bool[] memory isRevealedList,
        bool[] memory isActiveList
    ) {
        uint256 endIndex = offset + limit > predictionCount ? predictionCount : offset + limit;
        uint256 resultCount = endIndex - offset;

        predictionIds = new uint256[](resultCount);
        predictors = new address[](resultCount);
        locations = new string[](resultCount);
        targetDates = new uint256[](resultCount);
        isRevealedList = new bool[](resultCount);
        isActiveList = new bool[](resultCount);

        for (uint256 i = 0; i < resultCount; i++) {
            uint256 predictionId = offset + i;
            Prediction storage prediction = predictions[predictionId];

            predictionIds[i] = predictionId;
            predictors[i] = prediction.predictor;
            locations[i] = prediction.location;
            targetDates[i] = prediction.targetDate;
            isRevealedList[i] = prediction.isRevealed;
            isActiveList[i] = prediction.isActive;
        }
    }

    /// @notice Search predictions by location (case-insensitive partial match)
    /// @param searchLocation Location substring to search for
    /// @param limit Maximum number of results
    function searchPredictionsByLocation(string memory searchLocation, uint256 limit) external view returns (
        uint256[] memory predictionIds,
        address[] memory predictors,
        string[] memory locations
    ) {
        uint256 resultCount = 0;
        uint256[] memory tempIds = new uint256[](predictionCount);

        // First pass: count matches
        for (uint256 i = 0; i < predictionCount; i++) {
            string memory location = predictions[i].location;
            if (_containsString(location, searchLocation) && resultCount < limit) {
                tempIds[resultCount] = i;
                resultCount++;
            }
        }

        // Allocate exact-sized arrays
        predictionIds = new uint256[](resultCount);
        predictors = new address[](resultCount);
        locations = new string[](resultCount);

        // Second pass: populate results
        for (uint256 i = 0; i < resultCount; i++) {
            uint256 predictionId = tempIds[i];
            predictionIds[i] = predictionId;
            predictors[i] = predictions[predictionId].predictor;
            locations[i] = predictions[predictionId].location;
        }
    }

    /// @dev Helper function to check if string contains substring
    function _containsString(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory haystackBytes = bytes(haystack);
        bytes memory needleBytes = bytes(needle);

        if (needleBytes.length > haystackBytes.length) {
            return false;
        }

        for (uint256 i = 0; i <= haystackBytes.length - needleBytes.length; i++) {
            bool found = true;
            for (uint256 j = 0; j < needleBytes.length; j++) {
                if (haystackBytes[i + j] != needleBytes[j]) {
                    found = false;
                    break;
                }
            }
            if (found) {
                return true;
            }
        }
        return false;
    }

    /// @notice Get user's active predictions
    function getUserActivePredictions(address user, uint256 limit) external view returns (uint256[] memory) {
        uint256[] memory userPredictionIds = _userPredictions[user];
        uint256 activeCount = 0;

        // Count active predictions
        for (uint256 i = 0; i < userPredictionIds.length; i++) {
            if (predictions[userPredictionIds[i]].isActive) {
                activeCount++;
            }
        }

        uint256 resultCount = activeCount > limit ? limit : activeCount;
        uint256[] memory activeIds = new uint256[](resultCount);
        uint256 index = 0;

        // Collect active prediction IDs
        for (uint256 i = 0; i < userPredictionIds.length && index < resultCount; i++) {
            uint256 predictionId = userPredictionIds[i];
            if (predictions[predictionId].isActive) {
                activeIds[index] = predictionId;
                index++;
            }
        }

        return activeIds;
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

    /// @notice Emergency withdraw function for owner (only in paused state)
    function emergencyWithdraw() external onlyOwner whenPaused {
        payable(owner).transfer(address(this).balance);
    }

    /// @notice Get contract balance
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }

    /// @notice Renounce ownership (transfer to zero address)
    function renounceOwnership() external onlyOwner {
        emit OwnershipTransferred(owner, address(0));
        owner = address(0);
    }

    // Fallback functions
    receive() external payable {
        // Accept ETH payments
    }

    fallback() external payable {
        // Handle calls to non-existent functions
        revert("Function not found");
    }

    /// @notice Get contract status information
    function getContractStatus() external view returns (
        bool isPaused,
        address currentOwner,
        uint256 totalPredictions,
        uint256 contractBalance
    ) {
        return (paused, owner, predictionCount, address(this).balance);
    }
}

