import React from "react";
import { Copy } from "lucide-react";
import { RoundReceipt } from "../../utils/reemEvents";
import { formatRoundDeltaAmount } from "../../utils/roundResults";
import { Button } from "../ui/Button";

type CribReceiptsPanelProps = {
  receipts: RoundReceipt[];
  title?: string;
  compact?: boolean;
  onCopyReceipt: (receipt: RoundReceipt) => void;
};

const receiptKindLabel = (receipt: RoundReceipt) => {
  if (receipt.reason === "REEM") return "Reem win";
  if (receipt.reason === "DROP_WIN") return "Drop win";
  if (receipt.reason === "BAD_DROP") return "Bad drop";
  if (receipt.reason === "STOCK") return "Stock win";
  return "Big payout";
};

export const CribReceiptsPanel: React.FC<CribReceiptsPanelProps> = ({
  receipts,
  title = "Crib Receipts",
  compact = false,
  onCopyReceipt,
}) => (
  <section className={`rounded-[22px] border border-white/12 bg-black/26 text-white backdrop-blur-[8px] ${compact ? "p-3" : "p-4"}`}>
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-[8px] font-semibold uppercase tracking-[0.26em] text-white/52">Archive</div>
        <h3 className={`${compact ? "mt-1 text-[15px]" : "mt-1 text-lg"} rt-page-title`}>{title}</h3>
      </div>
      <div className="rounded-full border border-white/12 bg-white/[0.04] px-2.5 py-1 text-[10px] text-white/64">
        {receipts.length} saved
      </div>
    </div>

    <div className="mt-3 space-y-2">
      {receipts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.03] p-3 text-xs text-white/58">
          Receipts show here after Reems, drops, bad drops, big payouts, event winners, and crown changes.
        </div>
      ) : null}
      {receipts.slice(0, compact ? 3 : 6).map((receipt) => (
        <article key={receipt.id} className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-[9px] uppercase tracking-[0.18em] text-amber-100/70">{receiptKindLabel(receipt)}</div>
              <div className="mt-1 truncate text-sm font-semibold text-white">{receipt.title}</div>
              <div className="mt-1 text-[11px] leading-snug text-white/60">
                <span>{receipt.cribName}</span>
                <span> | </span>
                <span>{formatRoundDeltaAmount(receipt.payoutRtc, "RTC")}</span>
                <span> | </span>
                <span>{new Date(receipt.timestamp).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</span>
              </div>
              <div className="mt-1 truncate text-[11px] text-white/50">{receipt.playerNames.join(", ")}</div>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onCopyReceipt(receipt)} className="h-8 w-8 shrink-0 px-0">
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </div>
        </article>
      ))}
    </div>
  </section>
);
