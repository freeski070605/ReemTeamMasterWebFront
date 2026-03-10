import React from "react";
import HowToPlayGuide from "../components/rules/HowToPlayGuide";

const HowToPlay: React.FC = () => {
  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <HowToPlayGuide exampleStakeRtc={1000} />
      </div>
    </div>
  );
};

export default HowToPlay;

