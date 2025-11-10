import PredictionCard from "./PredictionCard";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import CreatePredictionDialog from "./CreatePredictionDialog";
import { usePredictionCount, usePrediction, useContractAddress } from "@/hooks/useWeatherPrediction";
import { useAccount, useChainId } from "wagmi";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";

const PredictionDashboard = () => {
  const { data: predictionCount } = usePredictionCount();
  const { address } = useAccount();
  const chainId = useChainId();
  const contractAddress = useContractAddress();
  
  // Get all predictions
  const predictionIds = Array.from({ length: Number(predictionCount || 0) }, (_, i) => i);

  return (
    <section className="py-20 px-4">
      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
          <div>
            <h2 className="text-4xl font-bold text-foreground mb-2">
              Weather Predictions
            </h2>
            <p className="text-muted-foreground">
              Encrypted temperature predictions secured by blockchain
            </p>
          </div>
          <CreatePredictionDialog>
            <Button 
              size="lg"
              className="mt-4 md:mt-0 bg-secondary hover:bg-secondary/90 text-secondary-foreground shadow-glow-purple"
            >
              <Plus className="mr-2 h-5 w-5" />
              Create Prediction
            </Button>
          </CreatePredictionDialog>
        </div>

        {!contractAddress && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Contract Not Deployed</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-2">The contract is not deployed on chain {chainId}.</p>
              <p className="mb-2">To deploy the contract:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Start Hardhat node: <code className="bg-muted px-1 rounded">npx hardhat node</code></li>
                <li>Deploy contract: <code className="bg-muted px-1 rounded">npx hardhat deploy --network localhost</code></li>
                <li>Update <code className="bg-muted px-1 rounded">ui/src/config/contracts.ts</code> with the deployed address</li>
                <li>Refresh this page</li>
              </ol>
            </AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!contractAddress ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              Please deploy the contract first to view predictions.
            </div>
          ) : predictionIds.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No predictions yet. Create the first one!
            </div>
          ) : (
            predictionIds.map((id) => (
              <PredictionCard key={id} predictionId={id} />
            ))
          )}
        </div>
      </div>
    </section>
  );
};

export default PredictionDashboard;
