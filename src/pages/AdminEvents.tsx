import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Pause, Play, Plus, RefreshCw, Square, X } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "../components/ui/Button";
import { useAuthStore } from "../store/authStore";
import {
  EVENT_TYPE_LABELS,
  ReemEvent,
  ReemEventStatus,
  createEmptyEvent,
  eventRepository,
  formatEventStatus,
} from "../utils/reemEventAdmin";
import { copyTextWithFallback } from "../utils/share";

const AdminEvents: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [events, setEvents] = useState<ReemEvent[]>(() => eventRepository.list());

  const counts = useMemo(() => ({
    live: events.filter((event) => event.status === "live").length,
    registration: events.filter((event) => event.status === "registration_open").length,
    scheduled: events.filter((event) => event.status === "scheduled").length,
  }), [events]);

  const refresh = () => setEvents(eventRepository.list());

  const createEvent = () => {
    const event = eventRepository.save(createEmptyEvent(user?._id));
    navigate(`/admin/events/${event.id}/edit`);
  };

  const updateStatus = (event: ReemEvent, status: ReemEventStatus) => {
    const destructive = status === "canceled" || status === "completed";
    if (destructive && !window.confirm(`${formatEventStatus(status)} ${event.name}? This changes the event state for everyone.`)) {
      return;
    }
    eventRepository.updateStatus(event.id, status);
    refresh();
    toast.success(`${event.name}: ${formatEventStatus(status)}.`);
  };

  return (
    <div className="space-y-6">
      <section className="rt-panel-strong rounded-[32px] border border-white/12 p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/70">
              <CalendarDays className="h-4 w-4" />
              Event Admin
            </div>
            <h1 className="mt-5 text-4xl rt-page-title">ReemTeam Events</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/70">
              Create, schedule, launch, monitor, pause, complete, and recap recurring crib nights.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={refresh}><RefreshCw className="mr-2 h-4 w-4" />Refresh</Button>
            <Button onClick={createEvent}><Plus className="mr-2 h-4 w-4" />Create Event</Button>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <Stat label="Registration Open" value={counts.registration} />
          <Stat label="Scheduled" value={counts.scheduled} />
          <Stat label="Live" value={counts.live} />
        </div>
      </section>

      <section className="grid gap-4">
        {events.map((event) => {
          const activeTables = event.sessions.filter((session) => session.status === "live" || session.status === "paused").length;
          return (
            <article key={event.id} className="rt-panel-strong rounded-[26px] border border-white/10 p-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-amber-200/24 bg-amber-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-amber-100">
                      {EVENT_TYPE_LABELS[event.eventType]}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusClass(event.status)}`}>
                      {formatEventStatus(event.status)}
                    </span>
                    <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/60">
                      {event.isPrivate ? "Private" : "Public"}
                    </span>
                  </div>
                  <h2 className="mt-3 text-2xl rt-page-title">{event.name}</h2>
                  <div className="mt-2 grid gap-2 text-sm text-white/62 sm:grid-cols-2 lg:grid-cols-4">
                    <div>Start: {event.startTime ? new Date(event.startTime).toLocaleString() : "Not scheduled"}</div>
                    <div>{event.handLimit} hands</div>
                    <div>{event.registeredPlayers.length}/{event.maxPlayers * (event.maxTables ?? 1)} registered</div>
                    <div>{activeTables} active tables</div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <Link to={`/admin/events/${event.id}`}><Button size="sm" variant="secondary">Open</Button></Link>
                  <Link to={`/admin/events/${event.id}/edit`}><Button size="sm" variant="ghost">Edit</Button></Link>
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(event, "registration_open")}>Open Registration</Button>
                  <Button size="sm" onClick={() => updateStatus(event, "live")}><Play className="mr-1 h-3.5 w-3.5" />Start</Button>
                  {event.status === "paused" ? (
                    <Button size="sm" onClick={() => updateStatus(event, "live")}>Resume</Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => updateStatus(event, "paused")}><Pause className="mr-1 h-3.5 w-3.5" />Pause</Button>
                  )}
                  <Button size="sm" variant="secondary" onClick={() => updateStatus(event, "completed")}><Square className="mr-1 h-3.5 w-3.5" />Complete</Button>
                  <Button size="sm" variant="danger" onClick={() => updateStatus(event, "canceled")}><X className="mr-1 h-3.5 w-3.5" />Cancel</Button>
                  <Link to={`/admin/events/${event.id}/recap`}><Button size="sm" variant="ghost">View Recap</Button></Link>
                  <Button size="sm" variant="ghost" onClick={() => void copyTextWithFallback(`${window.location.origin}/events/${event.slug}`)}>Copy Invite</Button>
                </div>
              </div>
            </article>
          );
        })}
      </section>
    </div>
  );
};

const Stat: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
    <div className="text-[11px] uppercase tracking-[0.18em] text-white/45">{label}</div>
    <div className="mt-2 text-3xl rt-page-title text-white">{value}</div>
  </div>
);

const statusClass = (status: string) => {
  if (status === "live") return "bg-emerald-500/20 text-emerald-200";
  if (status === "registration_open") return "bg-amber-500/20 text-amber-100";
  if (status === "paused") return "bg-sky-500/20 text-sky-100";
  if (status === "completed") return "bg-white/12 text-white/72";
  if (status === "canceled") return "bg-rose-500/20 text-rose-200";
  return "bg-white/10 text-white/65";
};

export default AdminEvents;
