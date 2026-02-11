import React from "react";
import { Button } from "../ui/Button";

interface GameActionsProps {
  canDrop: boolean;
  canSpread: boolean;
  canHit: boolean;
  onDrop: () => void;
  onSpread: () => void;
  onHit: () => void;
  orientation?: "horizontal" | "vertical";
}

const GameActions: React.FC<GameActionsProps> = ({
  canDrop,
  canSpread,
  canHit,
  onDrop,
  onSpread,
  onHit,
  orientation = "horizontal",
}) => {
  const layoutClass =
    orientation === "vertical" ? "flex flex-col gap-2" : "flex flex-wrap justify-center gap-2";
  return (
    <div className={layoutClass}>
      <Button onClick={onDrop} disabled={!canDrop}>Drop</Button>
      <Button onClick={onSpread} disabled={!canSpread}>Spread</Button>
      <Button onClick={onHit} disabled={!canHit}>Hit</Button>
    </div>
  );
};

export default GameActions;
