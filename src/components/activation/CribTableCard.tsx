import React from 'react';
import { Flame, Sparkles, Users } from 'lucide-react';
import { Table } from '../../types/game';
import { Button } from '../ui/Button';
import { getModeBadge, getModeDescription, getStakeDisplay, getTableDisplayName } from '../../branding/modeCopy';
import { getTableMomentumMeta } from '../../utils/lobbyExperience';

const toneClasses = {
  amber: 'border-amber-300/35 bg-amber-300/10 text-amber-100',
  emerald: 'border-emerald-300/35 bg-emerald-300/10 text-emerald-100',
  sky: 'border-sky-300/35 bg-sky-300/10 text-sky-100',
  rose: 'border-rose-300/35 bg-rose-300/10 text-rose-100',
  slate: 'border-white/15 bg-white/[0.05] text-white/78',
} as const;

interface CribTableCardProps {
  table: Table;
  emphasized?: boolean;
  beginnerFriendly?: boolean;
  highlightLabel?: string;
  ctaLabel?: string;
  onEnter: (table: Table) => void;
  onInvite?: (table: Table) => void;
}

export const CribTableCard: React.FC<CribTableCardProps> = ({
  table,
  emphasized = false,
  beginnerFriendly = false,
  highlightLabel,
  ctaLabel,
  onEnter,
  onInvite,
}) => {
  const stakeDisplay = getStakeDisplay(table.stake, table.mode);
  const momentum = getTableMomentumMeta(table);
  const seatsRemaining = Math.max(0, table.maxPlayers - table.currentPlayerCount);
  const disabled = seatsRemaining <= 0;

  return (
    <article
      className={`relative overflow-hidden rounded-[28px] border p-5 ${
        emphasized
          ? 'border-amber-300/40 bg-[linear-gradient(145deg,rgba(24,19,12,0.96),rgba(15,17,22,0.96))] shadow-[0_28px_58px_rgba(120,71,7,0.2)]'
          : 'border-white/10 bg-[linear-gradient(145deg,rgba(13,15,19,0.96),rgba(8,10,13,0.96))] shadow-[0_20px_42px_rgba(0,0,0,0.24)]'
      }`}
    >
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,rgba(255,255,255,0.03),transparent_36%,rgba(255,255,255,0.015))]" />
      <div className="relative z-10">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                {getModeBadge(table.mode)}
              </span>
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${toneClasses[momentum.tone]}`}>
                {momentum.badge}
              </span>
              {highlightLabel ? (
                <span className="rounded-full border border-amber-300/30 bg-amber-300/12 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-100">
                  {highlightLabel}
                </span>
              ) : null}
              {beginnerFriendly ? (
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-100">
                  Beginner Friendly
                </span>
              ) : null}
            </div>
            <h3 className="mt-3 text-2xl rt-page-title">{getTableDisplayName(table)}</h3>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              table.status === 'in-game'
                ? 'bg-amber-500/20 text-amber-100'
                : 'bg-emerald-500/20 text-emerald-200'
            }`}
          >
            {table.status === 'in-game' ? 'Hand Live' : 'Waiting'}
          </span>
        </div>

        <div className="mt-4 flex items-baseline gap-2 text-amber-300">
          <Sparkles className="h-5 w-5" />
          <span className="text-3xl rt-page-title">{stakeDisplay.amount}</span>
          <span className="text-sm text-white/58">{stakeDisplay.unit}</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-white/66">{getModeDescription(table.mode)}</p>

        <div className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-center justify-between gap-3 text-sm text-white/72">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-white/52" />
              {table.currentPlayerCount}/{table.maxPlayers} seats
            </div>
            <div>{momentum.seatLabel}</div>
          </div>
          <div className="mt-3 flex items-center gap-2">
            {Array.from({ length: table.maxPlayers }).map((_, seatIndex) => (
              <span
                key={`${table._id}-seat-${seatIndex}`}
                className={`h-2.5 flex-1 rounded-full ${
                  seatIndex < table.currentPlayerCount
                    ? 'rt-live-pulse bg-gradient-to-r from-amber-300 to-orange-300 shadow-[0_0_12px_rgba(251,191,36,0.45)]'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs text-white/58">
            <Flame className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200/80" />
            <span>{momentum.detail}</span>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            className="min-w-[160px] flex-1"
            disabled={disabled}
            onClick={() => onEnter(table)}
            variant={disabled ? 'secondary' : 'primary'}
          >
            {disabled ? 'Crib Full' : ctaLabel || (emphasized ? 'Take This Seat' : 'Enter Crib')}
          </Button>
          {onInvite ? (
            <Button className="min-w-[160px] flex-1" variant="secondary" onClick={() => onInvite(table)}>
              Invite Friends
            </Button>
          ) : null}
        </div>
      </div>
    </article>
  );
};
