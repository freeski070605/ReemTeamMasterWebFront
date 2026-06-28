import React, { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { Copy, Pause, Play, Square, X } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "../components/ui/Button";
import {
  EVENT_TYPE_LABELS,
  ReemEvent,
  ReemEventStatus,
  calculateEventLeaderboard,
  eventRepository,
  formatEventStatus,
} from "../utils/reemEventAdmin";
import { formatRoundDeltaAmount } from "../utils/roundResults";
import { copyTextWithFallback } from "../utils/share";

const AdminEventDetail: React.FC = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<ReemEvent | null>(() => (eventId ? eventRepository.get(eventId) : null));

  if (!eventId || !event) return <Navigate to="/admin/events" replace />;

  const inviteUrl = `${window.location.origin}/events/${event.slug}`;
  const leaderboard = calculateEventLeaderboard(event.registeredPlayers);
  const activeSession = event.sessions[0];

  const refresh = () => setEvent(eventRepository.get(eventId));

  const updateStatus = (status: ReemEventStatus) => {
    const destructive = status === "canceled" || status === "completed";
    if (destructive && !window.confirm(`${formatEventStatus(status)} ${event.name}? This may end player access to the event.`)) {
      return;
    }
    eventRepository.updateStatus(event.id, status);
    refresh();
    toast.success(`${event.name}: ${formatEventStatus(status)}.`);
  };

  return (
    <div className="space-y-6">
      <section className="rt-panel-strong rounded-[32px] border border-white/12 p-6 md:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-amber-200/24 bg-amber-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-100">
                {EVENT_TYPE_LABELS[event.eventType]}
              </span>
              <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/64">
                {formatEventStatus(event.status)}
              </span>
              <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/64">
                {event.isPrivate ? "Private" : "Public"}
              </span>
            </div>
            <h1 className="mt-4 text-4xl rt-page-title">{event.name}</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/70">{event.tagline || "Event control room."}</p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs text-white/58">
              <span>{event.handLimit} hands</span>
              <span>|</span>
              <span>Start: {event.startTime ? new Date(event.startTime).toLocaleString() : "Not scheduled"}</span>
              <span>|</span>
              <span>{event.cribName}</span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 xl:justify-end">
            <Button size="sm" variant="secondary" onClick={() => void copyTextWithFallback(inviteUrl)}><Copy className="mr-1.5 h-3.5 w-3.5" />Copy Invite</Button>
            <Button size="sm" variant="secondary" onClick={() => updateStatus("registration_open")}>Open Registration</Button>
            <Button size="sm" variant="secondary" onClick={() => updateStatus("scheduled")}>Lock Registration</Button>
            <Button size="sm" onClick={() => updateStatus("live")}><Play className="mr-1 h-3.5 w-3.5" />Start Event</Button>
            <Button size="sm" variant="secondary" onClick={() => updateStatus("paused")}><Pause className="mr-1 h-3.5 w-3.5" />Pause Event</Button>
            <Button size="sm" onClick={() => updateStatus("live")}>Resume Event</Button>
            <Button size="sm" variant="secondary" onClick={() => updateStatus("completed")}><Square className="mr-1 h-3.5 w-3.5" />End Event</Button>
            <Button size="sm" variant="danger" onClick={() => updateStatus("canceled")}><X className="mr-1 h-3.5 w-3.5" />Cancel Event</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-4">
        <Stat label="Registered Players" value={event.registeredPlayers.length} />
        <Stat label="Active Tables" value={event.sessions.length} />
        <Stat label="Current Hand" value={activeSession?.currentHandNumber ?? 0} />
        <Stat label="Receipts" value={event.receipts.length + event.sessions.reduce((sum, session) => sum + session.receipts.length, 0)} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <article className="rt-panel-strong rounded-[28px] border border-white/10 p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Live Leaderboard</div>
          <div className="mt-4 space-y-2">
            {leaderboard.map((player, index) => (
              <div key={player.playerId} className="grid gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white/70 sm:grid-cols-[40px_1fr_repeat(6,minmax(64px,auto))]">
                <div className="font-semibold text-white">#{index + 1}</div>
                <div className="font-semibold text-white">{player.playerName}</div>
                <div>{formatRoundDeltaAmount(player.currentStackRtc, "RTC")}</div>
                <div>{formatRoundDeltaAmount(player.netRtc, "RTC")}</div>
                <div>{player.handsWon} wins</div>
                <div>{player.reems} reems</div>
                <div>{player.successfulDrops} drops</div>
                <div>{player.failedDrops} bad</div>
              </div>
            ))}
            {leaderboard.length === 0 ? <div className="rounded-2xl border border-dashed border-white/12 p-4 text-sm text-white/58">No players registered yet.</div> : null}
          </div>
        </article>

        <article className="rt-panel-strong rounded-[28px] border border-white/10 p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Emergency Controls</div>
          <p className="mt-2 text-sm text-white/62">These controls are visual placeholders until backend table/player operations are wired.</p>
          <div className="mt-4 grid gap-2">
            {["Remove/Kick Player", "Reseat Player", "Reset Table", "Force Complete Current Hand", "Mark Player Disconnected", "Admin Note"].map((label) => (
              <Button key={label} variant="secondary" disabled>{label}</Button>
            ))}
          </div>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rt-panel-strong rounded-[28px] border border-white/10 p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Receipts Feed</div>
          <div className="mt-3 rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-4 text-sm text-white/58">
            Event receipts from completed hands will stream here.
          </div>
        </article>
        <article className="rt-panel-strong rounded-[28px] border border-white/10 p-5">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Next Actions</div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link to={`/admin/events/${event.id}/edit`}><Button variant="secondary">Edit Event</Button></Link>
            <Link to={`/admin/events/${event.id}/recap`}><Button>View Recap</Button></Link>
            <Button variant="ghost" onClick={() => navigate("/admin/events")}>Back to Events</Button>
          </div>
        </article>
      </section>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <article className="rt-panel-strong rounded-2xl border border-white/10 p-4">
    <div className="text-[10px] uppercase tracking-[0.18em] text-white/42">{label}</div>
    <div className="mt-2 text-3xl rt-page-title text-white">{value}</div>
  </article>
);

export default AdminEventDetail;
