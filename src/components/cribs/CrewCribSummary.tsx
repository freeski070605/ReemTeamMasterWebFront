import React from "react";
import { Crown, ReceiptText, Send, Users } from "lucide-react";
import { CrewCrib, buildCribInviteCopy } from "../../utils/crewCribs";
import { Button } from "../ui/Button";

type CrewCribSummaryProps = {
  crib: CrewCrib;
  compact?: boolean;
  onTakeSeat?: () => void;
  onInvite?: (copy: string) => void;
  onViewReceipts?: () => void;
};

export const CrewCribSummary: React.FC<CrewCribSummaryProps> = ({
  crib,
  compact = false,
  onTakeSeat,
  onInvite,
  onViewReceipts,
}) => (
  <article className={`rounded-[22px] border border-white/12 bg-black/20 ${compact ? "p-3" : "p-4"}`}>
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-white/48">
          <Users className="h-3.5 w-3.5" />
          {crib.isPrivate ? "Private Crib" : "Crew Crib"}
        </div>
        <h3 className={`${compact ? "mt-1 text-lg" : "mt-2 text-2xl"} rt-page-title truncate`}>
          {crib.name || "Free's Crib"}
        </h3>
      </div>
      <div className="shrink-0 rounded-full border border-amber-200/28 bg-amber-300/10 px-2.5 py-1 text-[10px] font-semibold text-amber-100">
        {crib.members.length || 4} crew
      </div>
    </div>

    <div className={`mt-3 grid gap-2 ${compact ? "" : "sm:grid-cols-2"}`}>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <div className="text-[10px] uppercase tracking-[0.18em] text-white/45">This Week</div>
        <div className="mt-1 text-sm font-semibold text-white">{crib.weeklyHandsPlayed} hands played this week</div>
      </div>
      <div className="rounded-2xl border border-amber-200/20 bg-amber-300/10 p-3">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.18em] text-amber-100/70">
          <Crown className="h-3.5 w-3.5" />
          Crown
        </div>
        <div className="mt-1 text-sm font-semibold text-amber-50">King of the Crib: {crib.crownHolder || "Cash"}</div>
      </div>
    </div>

    <div className="mt-3 space-y-1.5 text-sm text-white/70">
      <div>Biggest Reem: {crib.biggestReem || "Blaze +8K"}</div>
      <div>Worst Drop: {crib.worstDrop || "Drift caught at 27"}</div>
    </div>

    <div className="mt-4 flex flex-wrap gap-2">
      {onTakeSeat ? (
        <Button size="sm" onClick={onTakeSeat} className="min-w-[112px] flex-1">
          Take Seat
        </Button>
      ) : null}
      {onInvite ? (
        <Button size="sm" variant="secondary" onClick={() => onInvite(buildCribInviteCopy(crib))} className="min-w-[112px] flex-1">
          <Send className="mr-1.5 h-3.5 w-3.5" />
          Invite Crew
        </Button>
      ) : null}
      {onViewReceipts ? (
        <Button size="sm" variant="ghost" onClick={onViewReceipts} className="min-w-[112px] flex-1">
          <ReceiptText className="mr-1.5 h-3.5 w-3.5" />
          View Receipts
        </Button>
      ) : null}
    </div>
  </article>
);
