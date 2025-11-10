import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useSubmitPrediction, useContractAddress } from "@/hooks/useWeatherPrediction";
import { useAccount, useChainId } from "wagmi";
import { AlertCircle } from "lucide-react";

interface CreatePredictionDialogProps {
  children: React.ReactNode;
}

const CreatePredictionDialog = ({ children }: CreatePredictionDialogProps) => {
  const [open, setOpen] = useState(false);
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const contractAddress = useContractAddress();
  const submitPrediction = useSubmitPrediction();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConnected) {
      alert("Please connect your wallet first");
      return;
    }

    const form = e.target as HTMLFormElement;
    const formData = new FormData(form);
    
    const location = formData.get("location") as string;
    const targetDateStr = formData.get("targetDate") as string;
    const temperature = parseFloat(formData.get("temperature") as string);
    const confidence = parseFloat(formData.get("confidence") as string);

    if (!location || !targetDateStr || isNaN(temperature) || isNaN(confidence)) {
      alert("Please fill in all fields");
      return;
    }

    const targetDate = Math.floor(new Date(targetDateStr).getTime() / 1000);
    const currentTimestamp = Math.floor(Date.now() / 1000);

    // Validate target date is in the future
    if (targetDate <= currentTimestamp) {
      alert("Target date must be in the future. Please select a future date.");
      return;
    }

    // Validate target date is not more than 1 year in the future
    const oneYearFromNow = currentTimestamp + 365 * 24 * 60 * 60;
    if (targetDate > oneYearFromNow) {
      alert("Target date cannot be more than 1 year in the future.");
      return;
    }

    try {
      await submitPrediction.mutateAsync({
        location,
        targetDate,
        temperature,
        confidence,
      });
      setOpen(false);
      form.reset();
    } catch (error) {
      console.error("Failed to submit prediction:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl text-foreground">Create Weather Prediction</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Submit an encrypted temperature prediction for a future date
          </DialogDescription>
        </DialogHeader>
        
        {!contractAddress && (
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Contract Not Deployed</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-2">The contract is not deployed on chain {chainId}.</p>
              <p className="mb-2">Please follow these steps:</p>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>Deploy the contract: <code className="bg-muted px-1 rounded">npx hardhat deploy --network localhost</code></li>
                <li>Update <code className="bg-muted px-1 rounded">ui/src/config/contracts.ts</code> with the deployed address</li>
                <li>Refresh this page</li>
              </ol>
              <p className="mt-2 text-xs text-muted-foreground">
                See README.md for detailed instructions.
              </p>
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="location" className="text-foreground">Location</Label>
            <Input 
              id="location"
              name="location"
              placeholder="e.g., New York, London, Tokyo"
              className="bg-background border-border text-foreground"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="targetDate" className="text-foreground">Target Date</Label>
            <Input 
              id="targetDate"
              name="targetDate"
              type="date"
              min={new Date().toISOString().split('T')[0]}
              className="bg-background border-border text-foreground"
              required
            />
            <p className="text-xs text-muted-foreground">
              Select a future date (within 1 year)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="temperature" className="text-foreground">Predicted Temperature (°C)</Label>
            <Input 
              id="temperature"
              name="temperature"
              type="number"
              step="0.1"
              placeholder="25.5"
              className="bg-background border-border text-foreground"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="confidence" className="text-foreground">Confidence Level (%)</Label>
            <Input 
              id="confidence"
              name="confidence"
              type="number"
              min="0"
              max="100"
              step="1"
              placeholder="85"
              className="bg-background border-border text-foreground"
              required
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              className="flex-1"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow-cyan"
              disabled={submitPrediction.isPending || !contractAddress || !isConnected}
            >
              {submitPrediction.isPending ? "Submitting..." : "Create Encrypted Prediction"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreatePredictionDialog;
