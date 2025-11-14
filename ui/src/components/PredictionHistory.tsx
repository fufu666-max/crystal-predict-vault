import { useState } from "react";
import { useAccount } from "wagmi";
import { useUserPredictions, usePredictionStatus } from "@/hooks/useWeatherPrediction";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { History, Eye, Clock, Trophy } from "lucide-react";

interface PredictionHistoryProps {
  className?: string;
}

const PredictionHistory = ({ className }: PredictionHistoryProps) => {
  const { address } = useAccount();
  const { data: userPredictions, isLoading } = useUserPredictions(address);
  const [selectedPrediction, setSelectedPrediction] = useState<number | null>(null);

  if (!address) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Prediction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Connect your wallet to view prediction history.</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Prediction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const predictions = userPredictions || [];

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Prediction History
        </CardTitle>
        <CardDescription>
          Your {predictions.length} weather prediction{predictions.length !== 1 ? 's' : ''}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All ({predictions.length})</TabsTrigger>
            <TabsTrigger value="active">
              Active ({predictions.filter(p => !p.isRevealed).length})
            </TabsTrigger>
            <TabsTrigger value="revealed">
              Revealed ({predictions.filter(p => p.isRevealed).length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-2">
            {predictions.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No predictions yet. Submit your first weather prediction!
              </p>
            ) : (
              predictions.map((prediction, index) => (
                <PredictionCard
                  key={prediction.id || index}
                  prediction={prediction}
                  onViewDetails={() => setSelectedPrediction(prediction.id)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-2">
            {predictions.filter(p => !p.isRevealed).map((prediction, index) => (
              <PredictionCard
                key={prediction.id || index}
                prediction={prediction}
                onViewDetails={() => setSelectedPrediction(prediction.id)}
              />
            ))}
          </TabsContent>

          <TabsContent value="revealed" className="space-y-2">
            {predictions.filter(p => p.isRevealed).map((prediction, index) => (
              <PredictionCard
                key={prediction.id || index}
                prediction={prediction}
                onViewDetails={() => setSelectedPrediction(prediction.id)}
              />
            ))}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

interface PredictionCardProps {
  prediction: any;
  onViewDetails: () => void;
}

const PredictionCard = ({ prediction, onViewDetails }: PredictionCardProps) => {
  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString();
  };

  const getStatusBadge = (prediction: any) => {
    if (!prediction.isRevealed) {
      const now = Date.now() / 1000;
      if (prediction.targetDate > now) {
        return <Badge variant="secondary">Pending</Badge>;
      } else {
        return <Badge variant="outline">Ready to Reveal</Badge>;
      }
    } else {
      return <Badge variant="default">Revealed</Badge>;
    }
  };

  return (
    <div className="flex items-center justify-between p-3 border rounded-lg">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-primary/10 rounded">
          {prediction.isRevealed ? (
            <Trophy className="h-4 w-4 text-primary" />
          ) : (
            <Clock className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
        <div>
          <p className="font-medium">{prediction.location}</p>
          <p className="text-sm text-muted-foreground">
            Target: {formatDate(prediction.targetDate)}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {getStatusBadge(prediction)}
        <Button variant="ghost" size="sm" onClick={onViewDetails}>
          <Eye className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
};

export default PredictionHistory;
