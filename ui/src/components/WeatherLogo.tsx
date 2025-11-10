const WeatherLogo = ({ className = "w-32 h-32" }: { className?: string }) => {
  return (
    <svg
      className={className}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id="weatherGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{ stopColor: "#00d4ff", stopOpacity: 1 }} />
          <stop offset="100%" style={{ stopColor: "#0066ff", stopOpacity: 1 }} />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle cx="50" cy="50" r="45" fill="url(#weatherGrad)" filter="url(#glow)" />
      <text
        x="50"
        y="70"
        fontFamily="Arial, sans-serif"
        fontSize="50"
        fill="white"
        textAnchor="middle"
        filter="url(#glow)"
      >
        ☁
      </text>
    </svg>
  );
};

export default WeatherLogo;

