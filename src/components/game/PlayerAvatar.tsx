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
        className={`rounded-full border-2 border-yellow-400/40 bg-gradient-to-br from-neutral-800 to-neutral-900 p-[2px] shadow-[0_8px_20px_rgba(0,0,0,0.4)] ${sizeClasses[size]}`}
      >
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-black/28 ring-1 ring-white/8 shadow-[inset_0_1px_3px_rgba(255,255,255,0.14),inset_0_-10px_18px_rgba(0,0,0,0.24)]">
          {avatarSrc ? (
            <img
              src={avatarSrc}
              alt={player.name}
              className="h-full w-full object-cover object-center"
            />
          ) : (
            <span className="text-white font-bold">{player.name.substring(0, 2).toUpperCase()}</span>
          )}
        </div>
      </div>
      {showName && <div className="text-white font-semibold mt-2 text-sm tracking-wide">{player.name}</div>}
    </div>
  );
};

export default PlayerAvatar;
