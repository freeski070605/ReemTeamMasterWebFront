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
  layout?: "default" | "mobile-dock" | "side-stack";
}

const GameActions: React.FC<GameActionsProps> = ({
  drop,
  spread,
  hit,
  onDrop,
  onSpread,
  onHit,
  orientation = "horizontal",
  layout = "default",
}) => {
  const layoutClass =
    layout === "mobile-dock"
      ? "grid w-full grid-cols-3 gap-2"
      : layout === "side-stack"
        ? "flex w-full flex-col gap-1.5"
        : orientation === "vertical"
        ? "flex flex-col gap-2"
        : "flex flex-wrap justify-start gap-2";

  const renderAction = (
    label: string,
    state: ActionState,
    onClick: () => void
  ) => (
    <div
      key={label}
      className={`relative group flex flex-col items-center ${
        layout === "mobile-dock" || layout === "side-stack" ? "min-w-0 w-full" : "min-w-[84px]"
      }`}
    >
      <Button
        onClick={onClick}
        disabled={!state.enabled}
        title={!state.enabled ? state.reason : undefined}
        aria-label={!state.enabled && state.reason ? `${label}: ${state.reason}` : label}
        className={
          `${layout === "mobile-dock" ? "h-11 w-full rounded-2xl px-2 text-sm" : ""}${
            layout === "side-stack" ? "h-8 w-full rounded-lg px-2 text-xs" : ""
          } ${
            state.enabled && state.isPrimary
              ? "ring-2 ring-amber-300/80 shadow-[0_0_20px_rgba(251,191,36,0.34)]"
              : "border-white/15 bg-black/35"
          }`
        }
      >
        {label}
      </Button>
      {!state.enabled && state.reason ? (
        <div className="pointer-events-none absolute top-full z-20 mt-1 max-w-[150px] rounded-md border border-white/20 bg-black/80 px-2 py-1 text-center text-[10px] leading-tight text-white/90 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100">
          {state.reason}
        </div>
      ) : null}
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
