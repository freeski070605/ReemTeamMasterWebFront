import React from "react";
import { Copy, Send, RotateCcw } from "lucide-react";
import { Button } from "../ui/Button";
import { RoundReceipt as RoundReceiptModel } from "../../utils/reemEvents";
import { formatRoundDeltaAmount } from "../../utils/roundResults";

interface RoundReceiptProps {
  receipt: RoundReceiptModel;
  compact?: boolean;
  onCopy: () => void;
  onInvite?: () => void;
  onRunItBack?: () => void;
}

const RoundReceipt: React.FC<RoundReceiptProps> = ({
  receipt,
  compact = false,
  onCopy,
  onInvite,
  onRunItBack,
}) => (
  <article
    className={`w-full overflow-hidden rounded-[22px] border border-amber-200/24 bg-[linear-gradient(145deg,rgba(42,31,15,0.88),rgba(8,10,13,0.82))] text-white shadow-[0_20px_42px_rgba(0,0,0,0.26)] backdrop-blur-[10px] ${
      compact ? "p-3" : "p-4"
    }`}
  >
    <div className="text-[8px] font-semibold uppercase tracking-[0.26em] text-amber-100/70">Receipt</div>
    <div className={`${compact ? "mt-1 text-[15px]" : "mt-2 text-xl"} font-black uppercase leading-tight text-amber-50`}>
      {receipt.title}
    </div>
    <div className={`${compact ? "mt-1 text-[12px]" : "mt-2 text-sm"} font-semibold text-emerald-100`}>
      {formatRoundDeltaAmount(receipt.payoutRtc, "RTC")}
    </div>
    <div className={`${compact ? "mt-1 text-[10px]" : "mt-2 text-xs"} leading-snug text-white/72`}>
      {receipt.score !== undefined ? <div>Score: {receipt.score}</div> : null}
      <div>{receipt.cribName}</div>
      <div>Run it back?</div>
    </div>
    <div className="mt-3 grid grid-cols-3 gap-1.5">
      <Button size="sm" variant="secondary" onClick={onCopy} className="h-8 px-2 text-[9px]">
        <Copy className="mr-1 h-3 w-3" />
        Copy
      </Button>
      {onInvite ? (
        <Button size="sm" variant="ghost" onClick={onInvite} className="h-8 px-2 text-[9px]">
          <Send className="mr-1 h-3 w-3" />
          Invite
        </Button>
      ) : null}
      {onRunItBack ? (
        <Button size="sm" onClick={onRunItBack} className="h-8 px-2 text-[9px]">
          <RotateCcw className="mr-1 h-3 w-3" />
          Run
        </Button>
      ) : null}
    </div>
  </article>
);

export default RoundReceipt;
