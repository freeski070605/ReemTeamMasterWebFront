import React, { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { CalendarDays, Copy, Lock, Users } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "../components/ui/Button";
import { useAuthStore } from "../store/authStore";
import {
  EVENT_TYPE_LABELS,
  ReemEvent,
  buildEventInviteCopy,
  eventRepository,
  formatEventStatus,
} from "../utils/reemEventAdmin";
import { formatRTCAmount } from "../utils/rtcCurrency";
import { shareOrCopy } from "../utils/share";

const EventJoin: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuthStore();
  const [event, setEvent] = useState<ReemEvent | null>(() => (slug ? eventRepository.get(slug) : null));

  if (!slug || !event) return <Navigate to="/tables" replace />;

  const capacity = event.maxPlayers * (event.maxTables ?? 1);
  const registered = event.registeredPlayers.length;
  const hasSeat = registered < capacity;
  const joined = !!user?._id && event.registeredPlayers.some((player) => player.playerId === user._id);
  const inviteUrl = `${window.location.origin}/events/${event.slug}`;

  const joinEvent = () => {
    if (!isAuthenticated || !user) {
      navigate(`/login?redirect=/events/${event.slug}`);
      return;
    }
    if (!["registration_open", "live"].includes(event.status)) return;
    const next = eventRepository.registerPlayer(event.id, { playerId: user._id, playerName: user.username });
    if (next) {
      setEvent(next);
      toast.success(joined ? "You're already in." : "You're registered for the event.");
    }
  };

  const primaryLabel =
    event.status === "registration_open"
      ? joined
        ? "Registered"
        : "Join Event"
      : event.status === "scheduled"
        ? "Coming Soon"
        : event.status === "live"
          ? hasSeat
            ? "Join Live"
            : "Event Full"
          : event.status === "completed"
            ? "View Results"
            : event.status === "canceled"
              ? "Event Canceled"
              : "Registration Closed";

  const primaryDisabled =
    event.status === "canceled" ||
    event.status === "paused" ||
    event.status === "draft" ||
    (event.status === "scheduled") ||
    (!hasSeat && !joined);

  const handlePrimary = () => {
    if (event.status === "completed") {
      navigate(`/events/${event.slug}/results`);
      return;
    }
    joinEvent();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <section className="rt-panel-strong rounded-[32px] border border-white/12 p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/70">
              <CalendarDays className="h-4 w-4" />
              {EVENT_TYPE_LABELS[event.eventType]}
            </div>
            <h1 className="mt-5 text-4xl rt-page-title">{event.name}</h1>
            <p className="mt-3 max-w-2xl text-sm text-white/72">{event.tagline || "Pull up, take a seat, and win the crib."}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge>{formatEventStatus(event.status)}</Badge>
              <Badge>{event.isPrivate ? "Private" : "Public"}</Badge>
              <Badge>{registered}/{capacity} registered</Badge>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={handlePrimary} disabled={primaryDisabled && event.status !== "completed"}>{primaryLabel}</Button>
            <Button variant="secondary" onClick={() => void shareOrCopy({ title: event.name, text: buildEventInviteCopy(event), url: inviteUrl })}>
              <Copy className="mr-2 h-4 w-4" />
              Copy Invite
            </Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Stat label="Hand Limit" value={`${event.handLimit} hands`} />
        <Stat label="Starting Stack" value={formatRTCAmount(event.startingStackRtc)} />
        <Stat label="Stake" value={formatRTCAmount(event.stakeRtc)} />
        <Stat label="Reward" value={event.rewardText || event.prizeLabel || "Crown"} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <article className="rt-panel-strong rounded-[28px] border border-white/10 p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/48">
            <Users className="h-4 w-4" />
            Event Details
          </div>
          <div className="mt-4 space-y-2 text-sm text-white/68">
            <div>Crib: {event.cribName}</div>
            <div>Start time: {event.startTime ? new Date(event.startTime).toLocaleString() : "Not scheduled"}</div>
            <div>Registration opens: {event.registrationOpenAt ? new Date(event.registrationOpenAt).toLocaleString() : "Open by admin control"}</div>
            <div>Registration closes: {event.registrationCloseAt ? new Date(event.registrationCloseAt).toLocaleString() : "When event starts"}</div>
          </div>
        </article>
        <article className="rt-panel-strong rounded-[28px] border border-white/10 p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/48">
            <Lock className="h-4 w-4" />
            Winner Rule
          </div>
          <div className="mt-4 text-sm font-semibold text-white">Highest net RTC profit after hand limit.</div>
          <div className="mt-3 space-y-2 text-sm text-white/62">
            <div>1. Most hands won</div>
            <div>2. Most Reems</div>
            <div>3. Lowest final hand score</div>
            <div>4. Shared crown or sudden death later</div>
          </div>
        </article>
      </section>

      <div className="flex flex-wrap gap-3">
        <Link to="/tables"><Button variant="ghost">Back to Lobby</Button></Link>
        {event.status === "completed" ? <Link to={`/events/${event.slug}/results`}><Button variant="secondary">View Results</Button></Link> : null}
      </div>
    </div>
  );
};

const Badge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[0.18em] text-white/64">{children}</span>
);

const Stat: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <article className="rt-panel-strong rounded-2xl border border-white/10 p-4">
    <div className="text-[10px] uppercase tracking-[0.18em] text-white/42">{label}</div>
    <div className="mt-2 text-lg font-semibold text-white">{value}</div>
  </article>
);

export default EventJoin;
