import React from "react";
import { Crown } from "lucide-react";
import { PlayerReputationStats, getPlayerReputationTag } from "../../utils/crewCribs";
import { formatRoundDeltaAmount } from "../../utils/roundResults";
import { formatRTCAmount } from "../../utils/rtcCurrency";

type PlayerProfileCardProps = {
  playerName: string;
  stats: PlayerReputationStats;
  compact?: boolean;
};

export const PlayerProfileCard: React.FC<PlayerProfileCardProps> = ({ playerName, stats, compact = false }) => {
  const tag = getPlayerReputationTag(stats);
  const statItems = [
    ["Hands", stats.handsPlayed ?? 0],
    ["Wins", stats.handsWon ?? 0],
    ["Reems", stats.reems ?? 0],
    ["Drops", stats.successfulDrops ?? 0],
    ["Bad Drops", stats.failedDrops ?? 0],
    ["Best", formatRoundDeltaAmount(stats.biggestPayoutRtc ?? 0, "RTC")],
  ];

  return (
    <article className={`rounded-[22px] border border-white/12 bg-black/24 text-white backdrop-blur-[8px] ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[8px] font-semibold uppercase tracking-[0.26em] text-white/48">Player Profile</div>
          <h3 className={`${compact ? "mt-1 text-[15px]" : "mt-1 text-xl"} rt-page-title truncate`}>{playerName}</h3>
          <div className="mt-1 text-xs text-white/58">RTC {formatRTCAmount(stats.rtcBalance ?? 0)}</div>
        </div>
        <div className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-amber-200/28 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold text-amber-100">
          {tag === "Crown Holder" ? <Crown className="h-3 w-3" /> : null}
          {tag}
        </div>
      </div>

      <div className={`mt-3 grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-3"}`}>
        {statItems.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.04] p-2.5">
            <div className="text-[9px] uppercase tracking-[0.16em] text-white/42">{label}</div>
            <div className="mt-1 truncate text-sm font-semibold text-white">{value}</div>
          </div>
        ))}
      </div>
    </article>
  );
};
