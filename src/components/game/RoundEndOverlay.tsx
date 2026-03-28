import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { Button } from "../ui/Button";
import { PlayingCard as CardComponent } from "../ui/Card";
import { Card as CardType } from "../../types/game";
import { RoundOutcomePresentation } from "../../utils/roundResults";

interface RoundEndPlayerRow {
  userId: string;
  username: string;
  rank: number | null;
  resultLabel: string;
  scoreLabel: string;
  deltaLabel: string;
  deltaValue: number | null;
  isWinner: boolean;
}

interface RoundEndSessionStats {
  profitLabel: string;
  winStreak: number;
  reems: number;
  handsPlayed: number;
}

interface RoundEndOverlayProps {
  open: boolean;
  outcome: RoundOutcomePresentation;
  settlementTitle: string;
  settlementSummary: string | null;
  settlementLines: string[];
  playerRows: RoundEndPlayerRow[];
  countdownLabel?: string | null;
  readinessLabel: string;
  readinessDetail?: string | null;
  showRunItBack: boolean;
  runItBackDisabled?: boolean;
  onRunItBack: () => void;
  onLeaveTable: () => void;
  winningCards?: CardType[];
  sessionStats?: RoundEndSessionStats | null;
}

const toneStyles: Record<
  RoundOutcomePresentation["tone"],
  {
    glow: string;
    border: string;
    headline: string;
    badge: string;
    summary: string;
  }
> = {
  gold: {
    glow: "from-amber-300/28 via-yellow-200/10 to-transparent",
    border: "border-amber-300/30",
    headline: "text-amber-100",
    badge: "bg-amber-300/14 text-amber-100 border-amber-200/20",
    summary: "bg-amber-400/10 border-amber-300/20",
  },
  emerald: {
    glow: "from-emerald-300/24 via-green-200/8 to-transparent",
    border: "border-emerald-300/28",
    headline: "text-emerald-100",
    badge: "bg-emerald-300/14 text-emerald-100 border-emerald-200/20",
    summary: "bg-emerald-400/10 border-emerald-300/20",
  },
  sky: {
    glow: "from-sky-300/24 via-cyan-200/8 to-transparent",
    border: "border-sky-300/28",
    headline: "text-sky-100",
    badge: "bg-sky-300/14 text-sky-100 border-sky-200/20",
    summary: "bg-sky-400/10 border-sky-300/20",
  },
  rose: {
    glow: "from-rose-300/24 via-red-200/8 to-transparent",
    border: "border-rose-300/28",
    headline: "text-rose-100",
    badge: "bg-rose-300/14 text-rose-100 border-rose-200/20",
    summary: "bg-rose-400/10 border-rose-300/20",
  },
  slate: {
    glow: "from-white/12 via-slate-200/6 to-transparent",
    border: "border-white/16",
    headline: "text-white",
    badge: "bg-white/10 text-white/90 border-white/14",
    summary: "bg-white/6 border-white/12",
  },
};

const getAnimationProps = (reduceMotion: boolean, delay = 0) => ({
  initial: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 },
  animate: reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0 },
  exit: reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8 },
  transition: reduceMotion ? { duration: 0.12 } : { duration: 0.24, delay, ease: "easeOut" as const },
});

const RoundEndOverlay: React.FC<RoundEndOverlayProps> = ({
  open,
  outcome,
  settlementTitle,
  settlementSummary,
  settlementLines,
  playerRows,
  countdownLabel,
  readinessLabel,
  readinessDetail,
  showRunItBack,
  runItBackDisabled = false,
  onRunItBack,
  onLeaveTable,
  winningCards = [],
  sessionStats,
}) => {
  const reduceMotion = useReducedMotion() ?? false;
  const tone = toneStyles[outcome.tone];
  const visibleSessionStats = sessionStats && sessionStats.handsPlayed > 0 ? sessionStats : null;
  const highlightedCards = winningCards.slice(0, 5);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center px-3 py-4 sm:px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: "easeOut" }}
          aria-hidden={!open}
        >
          <motion.div
            className="absolute inset-0 bg-[rgba(5,8,16,0.68)] backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0.12 : 0.18, ease: "easeOut" }}
          />

          <div className="relative z-10 w-full max-w-[720px]">
            {highlightedCards.length > 0 ? (
              <div className="pointer-events-none absolute inset-x-10 top-2 hidden justify-center sm:flex" aria-hidden>
                <div className="relative h-28 w-full max-w-sm opacity-45">
                  {highlightedCards.map((card, index) => {
                    const centeredIndex = index - (highlightedCards.length - 1) / 2;
                    return (
                      <motion.div
                        key={`${card.rank}-${card.suit}-${index}`}
                        className="absolute left-1/2 top-1/2"
                        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92, y: 10 }}
                        animate={
                          reduceMotion
                            ? { opacity: 0.28 }
                            : {
                                opacity: 0.28,
                                scale: 1,
                                x: centeredIndex * 52,
                                y: Math.abs(centeredIndex) * 3,
                                rotate: centeredIndex * 8,
                              }
                        }
                        exit={{ opacity: 0 }}
                        transition={{ duration: reduceMotion ? 0.14 : 0.28, delay: reduceMotion ? 0 : 0.08 }}
                        style={{ marginLeft: "-1.4rem", marginTop: "-2.1rem" }}
                      >
                        <CardComponent
                          suit={card.suit}
                          rank={card.rank}
                          className="h-20 w-14 rounded-xl shadow-[0_0_36px_rgba(245,158,11,0.22)]"
                        />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="round-end-title"
              className={`relative overflow-hidden rounded-[28px] border bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(7,10,18,0.97))] text-white shadow-[0_28px_90px_rgba(0,0,0,0.5)] ${tone.border}`}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 10 }}
              animate={reduceMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: 8 }}
              transition={{ duration: reduceMotion ? 0.14 : 0.28, ease: "easeOut" }}
            >
              <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${tone.glow}`} />
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.1),transparent_34%),radial-gradient(circle_at_bottom,rgba(255,255,255,0.05),transparent_42%)]" />

              <div className="relative max-h-[min(86vh,760px)] overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
                <motion.div {...getAnimationProps(reduceMotion, 0)}>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.36em] text-white/58">
                    {outcome.eyebrow}
                  </div>
                  <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <h2 id="round-end-title" className={`text-3xl font-black tracking-[0.08em] sm:text-[2.5rem] ${tone.headline}`}>
                        {outcome.headline}
                      </h2>
                      <p className="mt-2 text-base font-semibold text-white sm:text-lg">{outcome.secondary}</p>
                      <p className="mt-1 text-sm text-white/70 sm:text-[15px]">{outcome.explanation}</p>
                    </div>

                    <div className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] ${tone.badge}`}>
                      {settlementTitle}
                    </div>
                  </div>
                </motion.div>

                <motion.div
                  className={`mt-4 rounded-2xl border p-3 sm:p-4 ${tone.summary}`}
                  {...getAnimationProps(reduceMotion, 0.12)}
                >
                  <div className="text-[11px] uppercase tracking-[0.22em] text-white/54">Settlement</div>
                  {settlementSummary ? (
                    <div className="mt-2 text-sm font-semibold text-white sm:text-[15px]">{settlementSummary}</div>
                  ) : null}
                  {settlementLines.length > 0 ? (
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      {settlementLines.map((line) => (
                        <div
                          key={line}
                          className="rounded-xl border border-white/10 bg-black/18 px-3 py-2 text-sm text-white/78"
                        >
                          {line}
                        </div>
                      ))}
                    </div>
                  ) : null}
                </motion.div>

                <motion.div className="mt-4 grid gap-2 sm:grid-cols-2" {...getAnimationProps(reduceMotion, 0.22)}>
                  {playerRows.map((row) => (
                    <div
                      key={row.userId}
                      className={`rounded-2xl border px-3 py-3 sm:px-4 ${
                        row.isWinner
                          ? "border-emerald-300/28 bg-emerald-400/12 shadow-[0_0_24px_rgba(52,211,153,0.12)]"
                          : "border-white/10 bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-white sm:text-[15px]">{row.username}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/52">
                            {row.rank ? <span>Rank {row.rank}</span> : null}
                            <span>{row.resultLabel}</span>
                          </div>
                        </div>
                        <div
                          className={`text-sm font-bold ${
                            row.deltaValue === null
                              ? "text-white/58"
                              : row.deltaValue > 0
                                ? "text-emerald-300"
                                : row.deltaValue < 0
                                  ? "text-rose-300"
                                  : "text-white/80"
                          }`}
                        >
                          {row.deltaLabel}
                        </div>
                      </div>
                      <div className="mt-2 text-sm text-white/74">{row.scoreLabel}</div>
                    </div>
                  ))}
                </motion.div>

                {visibleSessionStats ? (
                  <motion.div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.035] p-3 sm:p-4" {...getAnimationProps(reduceMotion, 0.26)}>
                    <div className="text-[11px] uppercase tracking-[0.22em] text-white/54">Session Pulse</div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      <div className="rounded-xl border border-white/10 bg-black/18 px-3 py-2.5">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/46">Session Profit</div>
                        <div className="mt-1 text-base font-semibold text-white">{visibleSessionStats.profitLabel}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/18 px-3 py-2.5">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/46">Win Streak</div>
                        <div className="mt-1 text-base font-semibold text-white">{visibleSessionStats.winStreak}</div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/18 px-3 py-2.5">
                        <div className="text-[11px] uppercase tracking-[0.18em] text-white/46">Reems This Session</div>
                        <div className="mt-1 text-base font-semibold text-white">{visibleSessionStats.reems}</div>
                      </div>
                    </div>
                  </motion.div>
                ) : null}

                <motion.div className="mt-4 border-t border-white/10 pt-3 sm:pt-4" {...getAnimationProps(reduceMotion, 0.32)}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      {countdownLabel ? (
                        <div className="text-sm font-semibold text-amber-200 sm:text-[15px]">{countdownLabel}</div>
                      ) : null}
                      <div className="mt-1 text-sm text-white">{readinessLabel}</div>
                      {readinessDetail ? (
                        <div className="mt-1 text-xs uppercase tracking-[0.16em] text-white/44">{readinessDetail}</div>
                      ) : null}
                    </div>

                    <div className="flex flex-col-reverse gap-2 sm:flex-row">
                      <Button onClick={onLeaveTable} variant="secondary" size="md" className="min-w-[132px]">
                        Leave Table
                      </Button>
                      {showRunItBack ? (
                        <Button
                          onClick={onRunItBack}
                          variant="primary"
                          size="md"
                          disabled={runItBackDisabled}
                          className="min-w-[132px]"
                        >
                          Run It Back
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </motion.div>
              </div>
            </motion.section>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

export default RoundEndOverlay;
