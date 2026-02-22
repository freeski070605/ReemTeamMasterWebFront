import React from "react";
import { resolveAvatarUrl } from "../../utils/avatar";

interface PlayerAvatarProps {
  player: {
    name: string;
    avatarUrl?: string;
  };
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
}

const PlayerAvatar: React.FC<PlayerAvatarProps> = ({ player, size = 'md', showName = false }) => {
  const avatarSrc = resolveAvatarUrl(player.avatarUrl);

  const sizeClasses = {
    sm: 'w-12 h-12 text-sm',
    md: 'w-16 h-16 text-xl',
    lg: 'w-24 h-24 text-3xl',
  };

  return (
    <div className="flex flex-col items-center">
      <div
        className={`bg-gradient-to-br from-neutral-800 to-neutral-900 rounded-full flex items-center justify-center text-white font-bold border-2 border-yellow-400/40 shadow-[0_8px_20px_rgba(0,0,0,0.4)] ${sizeClasses[size]}`}
      >
        {avatarSrc ? (
          <img src={avatarSrc} alt={player.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          player.name.substring(0, 2).toUpperCase()
        )}
      </div>
      {showName && <div className="text-white font-semibold mt-2 text-sm tracking-wide">{player.name}</div>}
    </div>
  );
};

export default PlayerAvatar;
