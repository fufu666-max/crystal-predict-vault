#!/bin/bash

# Deploy PrivateWeatherGuess contract to local Hardhat network
# This script helps you deploy and update the contract address

echo "🚀 Deploying PrivateWeatherGuess contract to localhost..."
echo ""

# Deploy the contract
npx hardhat deploy --network localhost

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Next steps:"
echo "1. Copy the contract address from above"
echo "2. Open ui/src/config/contracts.ts"
echo "3. Update CONTRACT_ADDRESSES[31337] with the deployed address"
echo "4. Refresh your frontend application"
echo ""
echo "Example:"
echo "  CONTRACT_ADDRESSES = {"
echo "    31337: '0x5FbDB2315678afecb367f032d93F642f64180aa3',"
echo "    ..."
echo "  }"

