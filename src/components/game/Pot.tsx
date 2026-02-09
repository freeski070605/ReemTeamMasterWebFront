import React from "react";

interface PotProps {
  amount: number;
}

const Pot: React.FC<PotProps> = ({ amount }) => {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="text-2xl font-bold text-white">Pot</div>
      <div className="text-4xl font-bold text-yellow-400">${amount}</div>
    </div>
  );
};

export default Pot;
