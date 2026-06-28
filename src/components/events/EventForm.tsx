import React, { useEffect, useMemo, useState } from "react";
import { Copy } from "lucide-react";
import { Button } from "../ui/Button";
import {
  EVENT_DEFAULTS,
  EVENT_TIEBREAKERS,
  EVENT_TYPE_LABELS,
  ReemEvent,
  ReemEventStatus,
  ReemEventType,
  makeInviteCode,
  slugifyEvent,
} from "../../utils/reemEventAdmin";
import { copyTextWithFallback } from "../../utils/share";

type EventFormProps = {
  event: ReemEvent;
  onSubmit: (event: ReemEvent, status: ReemEventStatus) => void;
};

export const EventForm: React.FC<EventFormProps> = ({ event, onSubmit }) => {
  const [draft, setDraft] = useState<ReemEvent>(event);

  useEffect(() => {
    setDraft(event);
  }, [event]);

  const inviteUrl = useMemo(() => `${window.location.origin}/events/${draft.slug || draft.inviteCode}`, [draft.inviteCode, draft.slug]);

  const update = <K extends keyof ReemEvent>(key: K, value: ReemEvent[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const handleTypeChange = (eventType: ReemEventType) => {
    const defaults = EVENT_DEFAULTS[eventType];
    setDraft((current) => ({
      ...current,
      eventType,
      handLimit: defaults.handLimit,
      startingStackRtc: defaults.startingStackRtc,
      stakeRtc: defaults.stakeRtc,
      maxPlayers: defaults.maxPlayers,
      maxTables: defaults.maxTables,
      tagline: defaults.tagline,
      rewardText: defaults.rewardText,
      prizeLabel: defaults.rewardText,
      crownDurationText: defaults.crownDurationText,
    }));
  };

  const handleNameChange = (name: string) => {
    setDraft((current) => ({
      ...current,
      name,
      slug: current.slug ? current.slug : slugifyEvent(name),
      inviteCode: current.inviteCode ? current.inviteCode : makeInviteCode(name),
    }));
  };

  const submit = (status: ReemEventStatus) => {
    onSubmit(
      {
        ...draft,
        isPrivate: !draft.isPublic,
        slug: draft.slug || slugifyEvent(draft.name),
        inviteCode: draft.inviteCode || makeInviteCode(draft.name),
      },
      status
    );
  };

  return (
    <div className="space-y-5">
      <section className="grid gap-4 lg:grid-cols-2">
        <Field label="Event name">
          <input value={draft.name} onChange={(event) => handleNameChange(event.target.value)} className={inputClass} />
        </Field>
        <Field label="Event type">
          <select value={draft.eventType} onChange={(event) => handleTypeChange(event.target.value as ReemEventType)} className={inputClass}>
            {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="Crib name/select">
          <input value={draft.cribName} onChange={(event) => update("cribName", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Visibility">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setDraft((current) => ({ ...current, isPublic: true, isPrivate: false }))} className={toggleClass(draft.isPublic)}>
              Public
            </button>
            <button type="button" onClick={() => setDraft((current) => ({ ...current, isPublic: false, isPrivate: true }))} className={toggleClass(draft.isPrivate)}>
              Private
            </button>
          </div>
        </Field>
        <Field label="Invite slug/code">
          <div className="flex gap-2">
            <input value={draft.slug} onChange={(event) => update("slug", slugifyEvent(event.target.value))} className={inputClass} />
            <Button type="button" variant="secondary" onClick={() => void copyTextWithFallback(inviteUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </Field>
        <Field label="Invite code">
          <input value={draft.inviteCode} onChange={(event) => update("inviteCode", event.target.value.toUpperCase())} className={inputClass} />
        </Field>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <NumberField label="Hand limit" value={draft.handLimit} onChange={(value) => update("handLimit", value)} />
        <NumberField label="Starting stack RTC" value={draft.startingStackRtc} onChange={(value) => update("startingStackRtc", value)} />
        <NumberField label="Stake RTC" value={draft.stakeRtc} onChange={(value) => update("stakeRtc", value)} />
        <NumberField label="Max players" value={draft.maxPlayers} onChange={(value) => update("maxPlayers", value)} />
        <NumberField label="Max tables" value={draft.maxTables ?? 1} onChange={(value) => update("maxTables", value)} />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <Field label="Start date/time">
          <input type="datetime-local" value={toDatetimeLocal(draft.startTime)} onChange={(event) => update("startTime", fromDatetimeLocal(event.target.value))} className={inputClass} />
        </Field>
        <Field label="Registration open">
          <input type="datetime-local" value={toDatetimeLocal(draft.registrationOpenAt)} onChange={(event) => update("registrationOpenAt", fromDatetimeLocal(event.target.value))} className={inputClass} />
        </Field>
        <Field label="Registration close">
          <input type="datetime-local" value={toDatetimeLocal(draft.registrationCloseAt)} onChange={(event) => update("registrationCloseAt", fromDatetimeLocal(event.target.value))} className={inputClass} />
        </Field>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Field label="Prize/reward label">
          <input value={draft.prizeLabel ?? ""} onChange={(event) => update("prizeLabel", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Winner badge label">
          <input value={draft.winnerBadgeLabel ?? ""} onChange={(event) => update("winnerBadgeLabel", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Crown duration text">
          <input value={draft.crownDurationText ?? ""} onChange={(event) => update("crownDurationText", event.target.value)} className={inputClass} />
        </Field>
        <Field label="Tagline">
          <input value={draft.tagline ?? ""} onChange={(event) => update("tagline", event.target.value)} className={inputClass} />
        </Field>
      </section>

      <section className="rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Rules</div>
        <div className="mt-2 text-sm font-semibold text-white">Winner rule: Net RTC profit</div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {EVENT_TIEBREAKERS.map((item, index) => (
            <div key={item} className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-white/70">
              {index + 1}. {formatRuleLabel(item)}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button onClick={() => submit("draft")} variant="secondary">Save Draft</Button>
        <Button onClick={() => submit("scheduled")} variant="secondary">Schedule Event</Button>
        <Button onClick={() => submit("registration_open")}>Open Registration</Button>
      </div>
    </div>
  );
};

const inputClass = "h-11 w-full rounded-xl border border-white/14 bg-black/35 px-3 text-sm text-white outline-none focus:border-amber-300/55";
const toggleClass = (active: boolean) =>
  `rounded-xl border px-3 py-2 text-sm font-semibold ${active ? "border-amber-300/55 bg-amber-300/12 text-amber-100" : "border-white/14 bg-white/[0.04] text-white/70"}`;

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <div className="mb-2 text-[11px] uppercase tracking-[0.18em] text-white/48">{label}</div>
    {children}
  </label>
);

const NumberField: React.FC<{ label: string; value: number; onChange: (value: number) => void }> = ({ label, value, onChange }) => (
  <Field label={label}>
    <input type="number" min={1} value={value} onChange={(event) => onChange(Math.max(1, Number(event.target.value) || 1))} className={inputClass} />
  </Field>
);

const toDatetimeLocal = (value?: string) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 16);
};

const fromDatetimeLocal = (value: string) => (value ? new Date(value).toISOString() : "");

const formatRuleLabel = (value: string) =>
  value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
