import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Lock, Eye, TrendingUp, Award } from "lucide-react";

interface HowItWorksDialogProps {
  children: React.ReactNode;
}

const HowItWorksDialog = ({ children }: HowItWorksDialogProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-2xl text-foreground">How It Works</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Learn how Private Weather Guess ensures encrypted and private temperature predictions
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                <Lock className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">1. Submit Encrypted Predictions</h3>
              <p className="text-sm text-muted-foreground">
                Submit your temperature predictions in encrypted form. All data is stored encrypted on the blockchain, ensuring complete privacy.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-secondary/20 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-secondary" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">2. Set Your Confidence</h3>
              <p className="text-sm text-muted-foreground">
                Specify your confidence level for each prediction. Your encrypted temperature and confidence are stored securely on-chain.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                <Eye className="h-5 w-5 text-accent" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">3. Reveal After Target Date</h3>
              <p className="text-sm text-muted-foreground">
                After the target date passes, predictions can be revealed. Only the prediction owner can decrypt their data before reveal.
              </p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-destructive/20 flex items-center justify-center">
                <Award className="h-5 w-5 text-destructive" />
              </div>
            </div>
            <div>
              <h3 className="font-semibold text-foreground mb-1">4. Leaderboard Ranking</h3>
              <p className="text-sm text-muted-foreground">
                After decryption, predictions are ranked by accuracy. The leaderboard shows the most accurate weather predictors.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HowItWorksDialog;
