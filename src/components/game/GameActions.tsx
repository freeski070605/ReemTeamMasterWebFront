import React from "react";
import { Button } from "../ui/Button";

interface GameActionsProps {
  canDrop: boolean;
  canSpread: boolean;
  canHit: boolean;
  onDrop: () => void;
  onSpread: () => void;
  onHit: () => void;
}

const GameActions: React.FC<GameActionsProps> = ({ canDrop, canSpread, canHit, onDrop, onSpread, onHit }) => {
  return (
    <div className="flex justify-center space-x-4">
      <Button onClick={onDrop} disabled={!canDrop}>Drop</Button>
      <Button onClick={onSpread} disabled={!canSpread}>Spread</Button>
      <Button onClick={onHit} disabled={!canHit}>Hit</Button>
    </div>
  );
};

export default GameActions;
