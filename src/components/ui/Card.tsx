import React from 'react';
import { motion, PanInfo } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { CardSuit, CardRank } from '../../types/game';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PlayingCardProps {
  suit: CardSuit;
  rank: CardRank;
  isHidden?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  badgeText?: string;
  badgeTone?: 'danger' | 'info';
  dragEnabled?: boolean;
  onDragEnd?: (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => void;
  dragSnapToOrigin?: boolean;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({ 
  suit, 
  rank, 
  isHidden = false, 
  isSelected = false, 
  onClick,
  className,
  style,
  badgeText,
  badgeTone = 'info',
  dragEnabled = false,
  onDragEnd,
  dragSnapToOrigin = true,
}) => {
  const getCardAssetPath = (rank: CardRank, suit: CardSuit) => {
    const suitLower = suit.toLowerCase();
    let rankStr = rank.toString();

    // Map ranks to filenames
    if (rank === 'Ace') rankStr = 'ace';
    else if (rank === 'Jack') rankStr = 'j';
    else if (rank === 'Queen') rankStr = 'Q';
    else if (rank === 'King') rankStr = 'K';

    return `/assets/cards/${rankStr}_of_${suitLower}.png`;
  };

  return (
    <motion.div
      className={cn(
        'relative w-24 h-36 rounded-lg shadow-lg cursor-pointer select-none transition-transform overflow-hidden',
        isSelected ? 'shadow-yellow-400/50 ring-4 ring-yellow-400' : '',
        className
      )}
      onClick={onClick}
      style={style}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      drag={dragEnabled}
      dragElastic={dragEnabled ? 0.24 : 0}
      dragMomentum={dragEnabled}
      dragSnapToOrigin={dragSnapToOrigin}
      onDragEnd={onDragEnd}
    >
      <img
        src={isHidden ? "/assets/cards/back.png" : getCardAssetPath(rank, suit)}
        alt={isHidden ? "Card Back" : `${rank} of ${suit}`}
        className="w-full h-full object-contain filter drop-shadow-sm"
        draggable={false}
      />
      {badgeText ? (
        <div
          className={`absolute left-1 right-1 top-1 rounded-md px-1 py-0.5 text-center text-[9px] font-semibold leading-tight ${
            badgeTone === 'danger'
              ? 'bg-rose-600/95 text-white border border-rose-200/30'
              : 'bg-sky-600/95 text-white border border-sky-200/30'
          }`}
        >
          {badgeText}
        </div>
      ) : null}
    </motion.div>
  );
};

export const Card: React.FC<{ className?: string, children: React.ReactNode }> = ({ className, children }) => {
  return (
    <div className={`bg-gray-800/50 backdrop-blur-sm border border-gray-700 rounded-lg shadow-lg ${className}`}>
      {children}
    </div>
  );
};
