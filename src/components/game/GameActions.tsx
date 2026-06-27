import React from "react";
import { Button } from "../ui/Button";

interface ActionState {
  enabled: boolean;
  reason?: string;
  isPrimary?: boolean;
}

interface GameActionsProps {
  drawDeck?: ActionState;
  drawDiscard?: ActionState;
  drop: ActionState;
  spread: ActionState;
  hit: ActionState;
  discard?: ActionState;
  onDrawDeck?: () => void;
  onDrawDiscard?: () => void;
  onDrop: () => void;
  onSpread: () => void;
  onHit: () => void;
  onDiscard?: () => void;
  orientation?: "horizontal" | "vertical";
  layout?: "default" | "mobile-dock" | "side-stack";
  hideDisabled?: boolean;
}

const GameActions: React.FC<GameActionsProps> = ({
  drawDeck,
  drawDiscard,
  drop,
  spread,
  hit,
  discard,
  onDrawDeck,
  onDrawDiscard,
  onDrop,
  onSpread,
  onHit,
  onDiscard,
  orientation = "horizontal",
  layout = "default",
  hideDisabled = false,
}) => {
  const layoutClass =
    layout === "mobile-dock"
      ? "grid w-full grid-cols-3 gap-1.5"
      : layout === "side-stack"
        ? "grid w-full grid-cols-2 gap-1.5"
        : orientation === "vertical"
        ? "flex flex-col gap-1.5"
        : "flex flex-wrap justify-center gap-1.5";

  const renderAction = (
    label: string,
    state: ActionState,
    onClick: () => void
  ) => {
    const isCompactLayout = layout === "mobile-dock" || layout === "side-stack";
    const buttonVariant = state.enabled && state.isPrimary ? "secondary" : "ghost";

    return (
      <div
        key={label}
        className={`relative group flex flex-col items-center ${
          isCompactLayout ? "min-w-0 w-full" : "min-w-[74px]"
        }`}
      >
        <Button
          onClick={onClick}
          disabled={!state.enabled}
          title={!state.enabled ? state.reason : undefined}
          aria-label={!state.enabled && state.reason ? `${label}: ${state.reason}` : label}
          variant={buttonVariant}
          size="sm"
          className={
            `${layout === "mobile-dock" ? "h-9 w-full rounded-full px-2 text-[11px] uppercase tracking-[0.18em]" : ""}${
              layout === "side-stack" ? "h-8 w-full rounded-[14px] px-1.5 text-[8px] font-semibold uppercase tracking-[0.08em]" : ""
            } ${
              layout === "default" ? "h-8 rounded-full px-3 text-[10px] uppercase tracking-[0.18em]" : ""
            } ${
              state.enabled && state.isPrimary
                ? "border-amber-300/45 !bg-amber-200/12 text-amber-50 shadow-[0_0_16px_rgba(251,191,36,0.18)]"
                : "border-white/14 !bg-black/20 text-white/84 shadow-[0_10px_22px_rgba(0,0,0,0.2)] hover:!bg-white/8"
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
  };

  return (
    <div className={layoutClass}>
      {drawDeck && onDrawDeck && (!hideDisabled || drawDeck.enabled) ? renderAction("Draw Deck", drawDeck, onDrawDeck) : null}
      {drawDiscard && onDrawDiscard && (!hideDisabled || drawDiscard.enabled) ? renderAction("Draw Discard", drawDiscard, onDrawDiscard) : null}
      {!hideDisabled || drop.enabled ? renderAction("Drop", drop, onDrop) : null}
      {!hideDisabled || spread.enabled ? renderAction("Spread", spread, onSpread) : null}
      {!hideDisabled || hit.enabled ? renderAction("Hit", hit, onHit) : null}
      {discard && onDiscard && (!hideDisabled || discard.enabled) ? renderAction("Discard", discard, onDiscard) : null}
    </div>
  );
};

export default GameActions;
