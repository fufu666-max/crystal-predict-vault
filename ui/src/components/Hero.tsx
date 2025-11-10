import { Button } from "@/components/ui/button";
import { Lock } from "lucide-react";
import { ConnectButton } from '@rainbow-me/rainbowkit';
import WeatherLogo from "./WeatherLogo";
import heroBg from "@/assets/hero-bg.jpg";
import HowItWorksDialog from "./HowItWorksDialog";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Wallet Connection - Top Right */}
      <div className="absolute top-4 right-4 z-50">
        <ConnectButton />
      </div>
      {/* Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${heroBg})` }}
      >
        <div className="absolute inset-0 bg-gradient-primary opacity-80" />
      </div>

      {/* Animated grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(0,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />

      {/* Content */}
      <div className="relative z-10 container mx-auto px-4 text-center">
        <div className="flex justify-center mb-8 animate-float">
          <WeatherLogo className="w-32 h-32 drop-shadow-[0_0_30px_rgba(0,255,255,0.5)]" />
        </div>
        
        <h1 className="text-5xl md:text-7xl font-bold mb-6 bg-gradient-to-r from-primary via-accent to-secondary bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(0,255,255,0.3)]">
          Private Weather Guess
        </h1>
        
        <p className="text-2xl md:text-3xl mb-4 text-foreground font-light tracking-wide">
          Predict Weather. Encrypted & Private.
        </p>
        
        <p className="text-lg text-muted-foreground mb-12 max-w-2xl mx-auto">
          Submit encrypted temperature predictions. All predictions are stored encrypted and revealed after the target date for ranking.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <HowItWorksDialog>
            <Button 
              size="lg" 
              variant="outline"
              className="border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-300"
            >
              <Lock className="mr-2 h-5 w-5" />
              How It Works
            </Button>
          </HowItWorksDialog>
        </div>

        {/* Stats */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto">
          <div className="backdrop-blur-md bg-card/30 rounded-lg p-6 border border-primary/20 hover:border-primary/50 transition-all duration-300">
            <div className="text-3xl font-bold text-primary mb-2">2,547</div>
            <div className="text-muted-foreground">Active Predictions</div>
          </div>
          <div className="backdrop-blur-md bg-card/30 rounded-lg p-6 border border-secondary/20 hover:border-secondary/50 transition-all duration-300">
            <div className="text-3xl font-bold text-secondary mb-2">$1.2M</div>
            <div className="text-muted-foreground">Total Staked</div>
          </div>
          <div className="backdrop-blur-md bg-card/30 rounded-lg p-6 border border-accent/20 hover:border-accent/50 transition-all duration-300">
            <div className="text-3xl font-bold text-accent mb-2">98.4%</div>
            <div className="text-muted-foreground">Accuracy Rate</div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
