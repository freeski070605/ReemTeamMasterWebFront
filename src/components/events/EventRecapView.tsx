import React from "react";
import { Link } from "react-router-dom";
import { Copy, Send } from "lucide-react";
import { Button } from "../ui/Button";
import {
  ReemEvent,
  buildEventInviteCopy,
  buildEventRecapCopy,
  calculateEventAwards,
  calculateEventLeaderboard,
  resolveEventWinner,
} from "../../utils/reemEventAdmin";
import { formatRoundDeltaAmount } from "../../utils/roundResults";
import { shareOrCopy } from "../../utils/share";

type EventRecapViewProps = {
  event: ReemEvent;
  admin?: boolean;
};

export const EventRecapView: React.FC<EventRecapViewProps> = ({ event, admin = false }) => {
  const leaderboard = calculateEventLeaderboard(event.registeredPlayers);
  const winner = resolveEventWinner(event.registeredPlayers);
  const awards = calculateEventAwards(event.registeredPlayers);

  const copyRecap = async () => {
    await shareOrCopy({ title: `${event.name} Results`, text: buildEventRecapCopy(event) });
  };

  const inviteCrew = async () => {
    await shareOrCopy({ title: event.name, text: buildEventInviteCopy(event), url: `${window.location.origin}/events/${event.slug}` });
  };

  return (
    <div className="space-y-5">
      <section className="rt-panel-strong rounded-[28px] border border-amber-200/20 p-6">
        <div className="text-[11px] uppercase tracking-[0.2em] text-amber-100/70">{event.name} Results</div>
        <h1 className="mt-3 text-4xl rt-page-title">Friday Night Reem Results</h1>
        <p className="mt-3 text-sm text-white/70">{event.handLimit} hands. Top stack owned the crib.</p>
        <p className="mt-1 text-sm text-amber-100/80">{event.crownDurationText || "Crown stays until next week."}</p>

        <div className="mt-6 flex flex-wrap gap-3">
          <Button onClick={copyRecap}><Copy className="mr-2 h-4 w-4" />Copy Event Recap</Button>
          <Button variant="secondary" onClick={inviteCrew}><Send className="mr-2 h-4 w-4" />Invite Crew</Button>
          <Link to="/tables"><Button variant="ghost">Back to Lobby</Button></Link>
          {admin ? <Link to="/admin/events/new"><Button variant="secondary">Run Another Event</Button></Link> : null}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <article className="rt-panel-strong rounded-[28px] border border-white/10 p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Main Winner</div>
          <h2 className="mt-3 text-3xl rt-page-title">{winner?.playerName ?? "Crown open"}</h2>
          {winner ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Stat label="Final Stack" value={formatRoundDeltaAmount(winner.currentStackRtc, "RTC")} />
              <Stat label="Net RTC" value={formatRoundDeltaAmount(winner.netRtc, "RTC")} />
              <Stat label="Hands Won" value={String(winner.handsWon)} />
              <Stat label="Biggest Payout" value={formatRoundDeltaAmount(winner.biggestPayoutRtc, "RTC")} />
            </div>
          ) : null}
          <div className="mt-4 rounded-2xl border border-amber-200/24 bg-amber-300/10 p-3 text-sm text-amber-50">
            {event.winnerBadgeLabel || "Crib Winner"} | {event.rewardText || event.prizeLabel || "Crown earned"}
          </div>
        </article>

        <article className="rt-panel-strong rounded-[28px] border border-white/10 p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Final Leaderboard</div>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="text-left text-[10px] uppercase tracking-[0.18em] text-white/42">
                <tr>
                  <th className="py-2 pr-3">Rank</th>
                  <th className="py-2 pr-3">Player</th>
                  <th className="py-2 pr-3">Final Stack</th>
                  <th className="py-2 pr-3">Net RTC</th>
                  <th className="py-2 pr-3">Wins</th>
                  <th className="py-2 pr-3">Reems</th>
                  <th className="py-2 pr-3">Drops</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((player, index) => (
                  <tr key={player.playerId} className="border-t border-white/8 text-white/72">
                    <td className="py-2 pr-3">{index + 1}</td>
                    <td className="py-2 pr-3 font-semibold text-white">{player.playerName}</td>
                    <td className="py-2 pr-3">{formatRoundDeltaAmount(player.currentStackRtc, "RTC")}</td>
                    <td className="py-2 pr-3">{formatRoundDeltaAmount(player.netRtc, "RTC")}</td>
                    <td className="py-2 pr-3">{player.handsWon}</td>
                    <td className="py-2 pr-3">{player.reems}</td>
                    <td className="py-2 pr-3">{player.successfulDrops}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Award label="Reem King" value={awards.reemKing?.playerName ?? "Open"} />
        <Award label="Drop Demon" value={awards.dropDemon?.playerName ?? "Open"} />
        <Award label="Crash Out" value={awards.crashOut?.playerName ?? "Open"} />
        <Award label="Biggest Hand" value={awards.biggestHand ? `${awards.biggestHand.playerName} ${formatRoundDeltaAmount(awards.biggestHand.biggestPayoutRtc, "RTC")}` : "Open"} />
        <Award label="Survivor" value={awards.survivor?.playerName ?? "Open"} />
      </section>

      <section className="rt-panel-strong rounded-[28px] border border-white/10 p-5">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Receipts</div>
        <div className="mt-3 space-y-2">
          {event.receipts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm text-white/58">
              Major event receipts will appear here after live hands settle.
            </div>
          ) : null}
          {event.receipts.map((receipt) => (
            <div key={receipt.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <div>
                <div className="font-semibold text-white">{receipt.title}</div>
                <div className="text-xs text-white/54">{receipt.cribName} | {formatRoundDeltaAmount(receipt.payoutRtc, "RTC")}</div>
              </div>
              <Button size="sm" variant="secondary" onClick={() => void shareOrCopy({ title: receipt.title, text: receipt.receiptText })}>
                Copy Receipt
              </Button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
    <div className="text-[10px] uppercase tracking-[0.18em] text-white/42">{label}</div>
    <div className="mt-1 text-lg font-semibold text-white">{value}</div>
  </div>
);

const Award: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <article className="rt-panel-strong rounded-2xl border border-white/10 p-4">
    <div className="text-[10px] uppercase tracking-[0.18em] text-white/42">{label}</div>
    <div className="mt-2 truncate text-lg font-semibold text-white">{value}</div>
  </article>
);
