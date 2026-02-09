import React from 'react';
import { motion } from 'framer-motion';
import { CardSuit, CardRank } from '../../types/game';

interface PlayingCardProps {
  suit: CardSuit;
  rank: CardRank;
  isHidden?: boolean;
  isSelected?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const PlayingCard: React.FC<PlayingCardProps> = ({ 
  suit, 
  rank, 
  isHidden = false, 
  isSelected = false, 
  onClick,
  className,
  style
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
      className={`relative w-24 h-36 rounded-lg shadow-lg cursor-pointer select-none transition-transform overflow-hidden ${isSelected ? '-translate-y-4 shadow-yellow-400/50 ring-4 ring-yellow-400' : ''} ${className}`}
      onClick={onClick}
      style={style}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
    >
      <img
        src={isHidden ? "/assets/cards/back.png" : getCardAssetPath(rank, suit)}
        alt={isHidden ? "Card Back" : `${rank} of ${suit}`}
        className="w-full h-full object-contain filter drop-shadow-sm"
        draggable={false}
      />
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
