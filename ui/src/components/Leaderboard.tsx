import { Trophy, Medal, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useLeaderboardCount, useLeaderboardEntry, usePrediction } from "@/hooks/useWeatherPrediction";

const Leaderboard = () => {
  const { data: leaderboardCount } = useLeaderboardCount();
  
  // Get all leaderboard entries
  const leaderboardIds = Array.from({ length: Number(leaderboardCount || 0) }, (_, i) => i);

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-accent" />;
      case 2:
        return <Medal className="h-5 w-5 text-muted-foreground" />;
      case 3:
        return <Award className="h-5 w-5 text-secondary" />;
      default:
        return <span className="text-sm font-bold text-muted-foreground">#{rank}</span>;
    }
  };

  return (
    <footer className="bg-gradient-to-t from-background to-card/20 border-t border-border py-16 px-4">
      <div className="container mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-foreground mb-2">
            Weather Prediction Leaderboard
          </h2>
          <p className="text-muted-foreground">
            Top predictors ranked by accuracy after decryption
          </p>
        </div>

        <div className="max-w-4xl mx-auto space-y-3">
          {Number(leaderboardCount || 0) === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No leaderboard entries yet. Predictions will appear here after they are revealed.
            </div>
          ) : (
            leaderboardIds.slice(0, 5).map((id, index) => {
              const { data: entry } = useLeaderboardEntry(id);
              const { data: prediction } = usePrediction(id);
              
              if (!entry || !prediction) return null;
              
              const predictor = {
                rank: index + 1,
                address: entry.predictor,
                accuracy: entry.accuracy,
                location: prediction.location,
                actualTemp: entry.actualTemperature,
              };
              
              return (
              <div
                key={predictor.rank}
                className="backdrop-blur-md bg-card/40 rounded-lg p-4 border border-border hover:border-primary/50 transition-all duration-300 group"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-1">
                    <div className="flex items-center justify-center w-10">
                      {getRankIcon(predictor.rank)}
                    </div>
                    
                    <div className="flex-1">
                      <div className="font-mono text-sm text-foreground group-hover:text-primary transition-colors">
                        {predictor.address.slice(0, 6)}...{predictor.address.slice(-4)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {predictor.location}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center hidden sm:block">
                      <div className="text-xs text-muted-foreground mb-1">Accuracy</div>
                      <Badge className="bg-accent/20 text-accent border-accent/30">
                        {predictor.accuracy.toFixed(1)}%
                      </Badge>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-xs text-muted-foreground mb-1">Actual Temp</div>
                      <div className="font-semibold text-foreground">{predictor.actualTemp.toFixed(1)}°C</div>
                    </div>
                  </div>
                </div>
              </div>
              );
            }).filter(Boolean)
          )}
        </div>

        <div className="mt-12 text-center text-sm text-muted-foreground">
          <p>Secured by smart contracts • Transparent • Immutable</p>
        </div>
      </div>
    </footer>
  );
};

export default Leaderboard;
