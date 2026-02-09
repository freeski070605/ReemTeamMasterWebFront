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
    <div className="flex items-center justify-center gap-3">
      <Button
        onClick={onDrop}
        disabled={!canDrop}
        variant="secondary"
        size="sm"
        className="px-4"
      >
        <span className="inline-flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M5 7h14l-1.2 12.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 7Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M9 7V5.5A2.5 2.5 0 0 1 11.5 3h1A2.5 2.5 0 0 1 15 5.5V7" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Drop
        </span>
      </Button>
      <Button
        onClick={onSpread}
        disabled={!canSpread}
        variant="primary"
        size="lg"
        className="px-6 shadow-lg"
      >
        <span className="inline-flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M4 17.5 10 4.5a1 1 0 0 1 1.8 0l6.2 13a1 1 0 0 1-.9 1.5H4.9a1 1 0 0 1-.9-1.5Z" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 9v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Spread
        </span>
      </Button>
      <Button
        onClick={onHit}
        disabled={!canHit}
        variant="ghost"
        size="sm"
        className="px-4 text-white/80 hover:text-white"
      >
        <span className="inline-flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="m5 19 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="m13 5 6 6-8 8-6-6 8-8Z" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          Hit
        </span>
      </Button>
    </div>
  );
};

export default GameActions;
