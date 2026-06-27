import React from "react";
import { Crown, Share2 } from "lucide-react";
import { Button } from "../ui/Button";
import { EventConfig } from "../../utils/reemEvents";
import { PlayerReputationStats, getPlayerReputationTag } from "../../utils/crewCribs";
import { formatRoundDeltaAmount } from "../../utils/roundResults";

export type EventRecapPlayer = PlayerReputationStats & {
  playerId: string;
  playerName: string;
  finalStackRtc: number;
  netRtc: number;
};

type EventRecapPanelProps = {
  eventConfig: EventConfig;
  cribName: string;
  players: EventRecapPlayer[];
  biggestHandLabel?: string;
  compact?: boolean;
  onShare: () => void;
};

const topBy = (players: EventRecapPlayer[], score: (player: EventRecapPlayer) => number) =>
  [...players].sort((a, b) => score(b) - score(a))[0] ?? null;

export const EventRecapPanel: React.FC<EventRecapPanelProps> = ({
  eventConfig,
  cribName,
  players,
  biggestHandLabel,
  compact = false,
  onShare,
}) => {
  const leaderboard = [...players].sort((a, b) => b.finalStackRtc - a.finalStackRtc || b.netRtc - a.netRtc);
  const winner = leaderboard[0] ?? null;
  const reemKing = topBy(players, (player) => player.reems ?? 0);
  const dropDemon = topBy(players, (player) => player.successfulDrops ?? 0);
  const crashOut = topBy(players, (player) => player.failedDrops ?? 0);

  return (
    <section className={`rounded-[24px] border border-amber-200/24 bg-[linear-gradient(145deg,rgba(42,31,15,0.9),rgba(8,10,13,0.86))] text-white shadow-[0_20px_42px_rgba(0,0,0,0.28)] backdrop-blur-[10px] ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[8px] font-semibold uppercase tracking-[0.26em] text-amber-100/70">
            <Crown className="h-3.5 w-3.5" />
            Friday Night Reem Results
          </div>
          <h3 className={`${compact ? "mt-1 text-[16px]" : "mt-2 text-xl"} rt-page-title truncate`}>{eventConfig.label}</h3>
          <p className="mt-1 text-xs text-white/68">12 hands. Top stack owned the crib. Crown stays until next week.</p>
        </div>
        <Button size="sm" variant="secondary" onClick={onShare} className="shrink-0">
          <Share2 className="mr-1.5 h-3.5 w-3.5" />
          Recap
        </Button>
      </div>

      <div className="mt-3 rounded-2xl border border-amber-200/20 bg-amber-300/10 p-3">
        <div className="text-[9px] uppercase tracking-[0.2em] text-amber-100/70">{cribName}</div>
        <div className="mt-1 text-lg font-semibold text-amber-50">
          {winner ? `${winner.playerName} wins with ${formatRoundDeltaAmount(winner.finalStackRtc, "RTC")}` : "Crown still open"}
        </div>
        {winner ? <div className="mt-1 text-xs text-white/70">Net RTC {formatRoundDeltaAmount(winner.netRtc, "RTC")}</div> : null}
      </div>

      <div className="mt-3 space-y-1.5">
        {leaderboard.map((player, index) => (
          <div key={player.playerId} className="flex items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs">
            <span className="min-w-0 truncate">{index + 1}. {player.playerName}</span>
            <span className="shrink-0 font-semibold text-white">{formatRoundDeltaAmount(player.finalStackRtc, "RTC")}</span>
          </div>
        ))}
      </div>

      <div className={`mt-3 grid gap-2 ${compact ? "grid-cols-2" : "grid-cols-4"}`}>
        <Award label="Reem King" value={reemKing?.playerName ?? "Open"} />
        <Award label="Drop Demon" value={dropDemon?.playerName ?? "Open"} />
        <Award label="Crash Out" value={crashOut?.playerName ?? "Open"} />
        <Award label="Biggest Hand" value={biggestHandLabel ?? "Open"} />
      </div>

      {winner ? (
        <div className="mt-3 rounded-full border border-white/12 bg-white/[0.04] px-3 py-2 text-[10px] text-white/68">
          {winner.playerName}: {getPlayerReputationTag({ ...winner, isCrownHolder: true })}
        </div>
      ) : null}
    </section>
  );
};

const Award: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-black/18 p-2.5">
    <div className="text-[8px] uppercase tracking-[0.18em] text-white/42">{label}</div>
    <div className="mt-1 truncate text-xs font-semibold text-white">{value}</div>
  </div>
);
