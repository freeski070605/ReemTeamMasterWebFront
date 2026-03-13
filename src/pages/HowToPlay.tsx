import React from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import HowToPlayGuide from "../components/rules/HowToPlayGuide";

const HowToPlay: React.FC = () => {
  return (
    <div className="min-h-screen text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <HowToPlayGuide exampleStakeRtc={1000} />
        <div className="mt-10 flex justify-center">
          <Link to="/tables">
            <Button>Pull Up to Cribs</Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HowToPlay;
