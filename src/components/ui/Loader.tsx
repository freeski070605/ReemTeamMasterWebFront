import React from "react";

const Loader: React.FC = () => {
  return (
    <div className="flex justify-center items-center py-6">
      <div className="relative h-12 w-12">
        <div className="absolute inset-0 rounded-full border-2 border-amber-200/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-amber-300 border-r-orange-400 animate-spin" />
      </div>
    </div>
  );
};

export { Loader };
