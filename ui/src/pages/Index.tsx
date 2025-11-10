import Hero from "@/components/Hero";
import PredictionDashboard from "@/components/PredictionDashboard";
import Leaderboard from "@/components/Leaderboard";

const Index = () => {
  return (
    <div className="min-h-screen bg-gradient-primary">
      <Hero />
      <PredictionDashboard />
      <Leaderboard />
    </div>
  );
};

export default Index;
