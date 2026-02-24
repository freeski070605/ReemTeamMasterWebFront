import React from "react";
import { Button } from "../ui/Button";

interface ActionState {
  enabled: boolean;
  reason?: string;
  isPrimary?: boolean;
}

interface GameActionsProps {
  drop: ActionState;
  spread: ActionState;
  hit: ActionState;
  onDrop: () => void;
  onSpread: () => void;
  onHit: () => void;
  orientation?: "horizontal" | "vertical";
}

const GameActions: React.FC<GameActionsProps> = ({
  drop,
  spread,
  hit,
  onDrop,
  onSpread,
  onHit,
  orientation = "horizontal",
}) => {
  const layoutClass =
    orientation === "vertical" ? "flex flex-col gap-2" : "flex flex-wrap justify-center gap-2.5";

  const renderAction = (
    label: string,
    state: ActionState,
    onClick: () => void
  ) => (
    <div key={label} className="flex min-w-[84px] flex-col items-center gap-1">
      <Button
        onClick={onClick}
        disabled={!state.enabled}
        className={
          state.enabled && state.isPrimary
            ? "ring-2 ring-amber-300/90 shadow-[0_0_18px_rgba(251,191,36,0.52)] animate-pulse"
            : ""
        }
      >
        {label}
      </Button>
      {!state.enabled && state.reason ? (
        <div className="text-center text-[10px] leading-tight text-rose-200/90">
          {state.reason}
        </div>
      ) : (
        <div className="h-[20px]" aria-hidden />
      )}
    </div>
  );

  return (
    <div className={layoutClass}>
      {renderAction("Drop", drop, onDrop)}
      {renderAction("Spread", spread, onSpread)}
      {renderAction("Hit", hit, onHit)}
    </div>
  );
};

export default GameActions;
