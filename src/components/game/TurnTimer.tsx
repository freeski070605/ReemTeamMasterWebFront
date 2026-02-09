import React from "react";

interface TurnTimerProps {
  timeLeft: number;
  maxTime: number;
}

const TurnTimer: React.FC<TurnTimerProps> = ({ timeLeft, maxTime }) => {
  const percentage = (timeLeft / maxTime) * 100;
  return (
    <div className="w-full h-4 bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full bg-green-500 transition-all duration-100"
        style={{ width: `${percentage}%` }}
      ></div>
    </div>
  );
};

export default TurnTimer;
