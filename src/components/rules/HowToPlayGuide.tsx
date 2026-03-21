import React, { useMemo, useState } from "react";
import { PlayingCard } from "../ui/Card";
import { Button } from "../ui/Button";
import { CardRank, CardSuit } from "../../types/game";

type RulePopupKey = "spreadHold" | "hitLock" | "caughtDrop" | "declare41";

interface RulePopupContent {
  title: string;
  body: string;
}

const RULE_POPUPS: Record<RulePopupKey, RulePopupContent> = {
  spreadHold: {
    title: "No Holding Spreads",
    body: "If your hand contains a valid spread, you must play it before you can end your turn. The only allowed hold is an all-Ace spread.",
  },
  hitLock: {
    title: "Hit Lock Timing",
    body: "First hit on another player locks drop for 2 of their turns. More hits in that same turn do not stack. Hits on later turns add +1 more locked turn each.",
  },
  caughtDrop: {
    title: "Caught Drop Payout",
    body: "If the dropper is tied or beaten on hand value, the drop fails. The winner gets regular stake from others, and double stake from the dropper.",
  },
  declare41: {
    title: "Automatic 41",
    body: "If your starting hand is exactly 41, it is auto-claimed at the start of your first turn before drawing. If someone wins before your turn, you cannot use 41.",
  },
};

const formatRtc = (amount: number): string => {
  return `${Math.max(0, Math.trunc(amount)).toLocaleString("en-US")} RTC`;
};

const cardSizeClass = "w-11 h-16 sm:w-12 sm:h-[4.5rem]";

const CardRow: React.FC<{ cards: Array<{ rank: CardRank; suit: CardSuit }> }> = ({ cards }) => {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {cards.map((card, index) => (
        <PlayingCard
          key={`${card.rank}-${card.suit}-${index}`}
          rank={card.rank}
          suit={card.suit}
          className={cardSizeClass}
        />
      ))}
    </div>
  );
};

export interface HowToPlayGuideProps {
  exampleStakeRtc?: number;
}

const InfoButton: React.FC<{ onClick: () => void; label: string }> = ({ onClick, label }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center rounded-full border border-cyan-300/35 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-cyan-100 transition hover:bg-cyan-400/20"
  >
    {label}
  </button>
);

const HowToPlayGuide: React.FC<HowToPlayGuideProps> = ({ exampleStakeRtc = 1000 }) => {
  const [activePopup, setActivePopup] = useState<RulePopupKey | null>(null);

  const examples = useMemo(() => {
    const stake = Math.max(100, Math.trunc(exampleStakeRtc));
    return {
      stake,
      standard4Players: stake * 3,
      drop3Players: stake * 2,
      caughtDrop3Players: stake * 3,
      triple4Players: stake * 9,
      summary: [
        { label: "Reem", payout: `Each opponent pays ${formatRtc(stake)}` },
        { label: "Successful Drop", payout: `Each opponent pays ${formatRtc(stake)}` },
        { label: "Caught Dropping", payout: `Dropper pays ${formatRtc(stake * 2)}; others pay ${formatRtc(stake)}` },
        { label: "Deck Runs Out", payout: `Each opponent pays ${formatRtc(stake)}` },
        { label: "41", payout: `Each opponent pays ${formatRtc(stake * 3)}` },
        { label: "11 and Under", payout: `Each opponent pays ${formatRtc(stake * 3)}` },
      ],
    };
  }, [exampleStakeRtc]);

  return (
    <div className="relative space-y-3 text-white/85">
      <section className="rounded-2xl border border-white/10 bg-[#0f1726]/60 p-4 sm:p-5">
        <div className="text-xs uppercase tracking-[0.2em] text-white/55">How to Play ReemTeam</div>
        <h1 className="mt-2 text-2xl font-semibold text-white rt-page-title">Complete Rules</h1>
        <p className="mt-2 text-sm text-white/70">
          Competitive multiplayer Tonk with forced spreads, drop locks from hits, and RTC stake payouts.
        </p>
      </section>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3" open>
        <summary className="cursor-pointer font-semibold text-white">Goal of the Game</summary>
        <div className="mt-2 text-sm text-white/75">
          Win the hand by Reem (play all cards in spreads), dropping with the lowest hand, winning when the draw pile runs out, or by a special hand (41 or 11 and under).
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer font-semibold text-white">Game Setup</summary>
        <div className="mt-2 space-y-1 text-sm text-white/75">
          <div>Each player receives 5 cards.</div>
          <div>The remaining cards form the draw pile.</div>
          <div>The discard pile starts empty (no flipped starter card).</div>
          <div>Play proceeds clockwise.</div>
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer font-semibold text-white">Card Values</summary>
        <div className="mt-2 space-y-1 text-sm text-white/75">
          <div>Ace = 1</div>
          <div>2-7 = face value</div>
          <div>Jack / Queen / King = 10</div>
          <div className="text-white/60">Lower hand value is better.</div>
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer font-semibold text-white">Spreads and Forced Play</summary>
        <div className="mt-3 space-y-3 text-sm text-white/75">
          <div>
            <div className="mb-2 text-white/90">Set example (same rank):</div>
            <CardRow
              cards={[
                { rank: "7", suit: "Spades" },
                { rank: "7", suit: "Diamonds" },
                { rank: "7", suit: "Hearts" },
              ]}
            />
          </div>
          <div>
            <div className="mb-2 text-white/90">Run example (same suit sequence):</div>
            <CardRow
              cards={[
                { rank: "4", suit: "Clubs" },
                { rank: "5", suit: "Clubs" },
                { rank: "6", suit: "Clubs" },
              ]}
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span>You cannot hold valid spreads in hand. Only all-Ace spreads may be held.</span>
            <InfoButton onClick={() => setActivePopup("spreadHold")} label="Rule Popup" />
          </div>
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer font-semibold text-white">Turn Structure and Hitting</summary>
        <div className="mt-3 space-y-3 text-sm text-white/75">
          <div>1. Draw from deck or discard pile.</div>
          <div>2. Play spreads / add to spreads / hit any spread, including your own.</div>
          <div>3. Discard one card to end your turn.</div>
          <div className="text-white/65">Drop is only allowed at the start of your turn before drawing.</div>
          <div>
            <div className="mb-2 text-white/90">Hit example:</div>
            <div className="flex flex-wrap items-center gap-2">
              <CardRow
                cards={[
                  { rank: "4", suit: "Diamonds" },
                  { rank: "5", suit: "Diamonds" },
                  { rank: "6", suit: "Diamonds" },
                ]}
              />
              <span className="text-white/60">+</span>
              <CardRow cards={[{ rank: "7", suit: "Diamonds" }]} />
            </div>
          </div>
          <div className="space-y-1 rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="font-semibold text-white">Drop Penalty From Hits</div>
            <div>First hit in a turn: target cannot drop for their next 2 turns.</div>
            <div>More hits in that same turn: no additional penalty.</div>
            <div>Hits on later turns: each hit adds +1 more no-drop turn.</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span className="text-white/70">Applies only when hitting another player&apos;s spread.</span>
              <InfoButton onClick={() => setActivePopup("hitLock")} label="Rule Popup" />
            </div>
          </div>
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer font-semibold text-white">Win Conditions and RTC Payouts</summary>
        <div className="mt-3 space-y-3 text-sm text-white/75">
          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="font-semibold text-white">Reem</div>
            <div>4 players at {formatRtc(examples.stake)} stake: winner receives {formatRtc(examples.standard4Players)}.</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="font-semibold text-white">Successful Drop</div>
            <div>3 players at {formatRtc(examples.stake)} stake: winner receives {formatRtc(examples.drop3Players)}.</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="flex flex-wrap items-center gap-2 font-semibold text-white">
              <span>Caught Dropping</span>
              <InfoButton onClick={() => setActivePopup("caughtDrop")} label="Rule Popup" />
            </div>
            <div className="mt-1">
              3 players at {formatRtc(examples.stake)} stake: winner receives {formatRtc(examples.caughtDrop3Players)} total.
            </div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="font-semibold text-white">Deck Runs Out</div>
            <div>4 players at {formatRtc(examples.stake)} stake: winner receives {formatRtc(examples.standard4Players)}.</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-black/25 p-3">
            <div className="font-semibold text-white">41 and 11 and Under</div>
            <div>4 players at {formatRtc(examples.stake)} stake: winner receives {formatRtc(examples.triple4Players)}.</div>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <span>41 is auto-claimed at the start of your first turn before drawing.</span>
              <InfoButton onClick={() => setActivePopup("declare41")} label="Rule Popup" />
            </div>
          </div>
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer font-semibold text-white">Deck Runs Out</summary>
        <div className="mt-2 space-y-1 text-sm text-white/75">
          <div>When the draw pile becomes empty, the hand ends.</div>
          <div>All players reveal hands and the lowest hand value wins.</div>
          <div>Payout uses standard stake (each opponent pays one stake).</div>
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer font-semibold text-white">Special Winning Hands</summary>
        <div className="mt-2 space-y-2 text-sm text-white/75">
          <div>
            <span className="font-semibold text-white">41:</span> Starting hand totals exactly 41 and is auto-claimed at the start of your first turn before drawing.
          </div>
          <div>
            <span className="font-semibold text-white">11 and Under:</span> Starting hand of 11 points or less is an automatic win.
          </div>
          <div>Both special wins pay triple stake from each opponent.</div>
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer font-semibold text-white">Quick Payout Summary</summary>
        <div className="mt-3 overflow-x-auto rounded-lg border border-white/10">
          <table className="w-full text-left text-sm">
            <thead className="bg-white/5 text-white/65">
              <tr>
                <th className="px-3 py-2">Win Condition</th>
                <th className="px-3 py-2">Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {examples.summary.map((item) => (
                <tr key={item.label}>
                  <td className="px-3 py-2 text-white">{item.label}</td>
                  <td className="px-3 py-2 text-white/75">{item.payout}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer font-semibold text-white">Strategy Tips</summary>
        <div className="mt-2 space-y-1 text-sm text-white/75">
          <div>Keep your hand value low to avoid losing drops.</div>
          <div>Use hits to extend opponents&apos; drop lock windows.</div>
          <div>Track turn order so you know whose turn could auto-claim 41.</div>
          <div>Do not hold non-Ace spreads. Play them immediately.</div>
        </div>
      </details>

      <details className="rounded-xl border border-white/10 bg-black/20 p-3">
        <summary className="cursor-pointer font-semibold text-white">Ready to Play</summary>
        <div className="mt-2 space-y-1 text-sm text-white/75">
          <div>1. Join a table.</div>
          <div>2. Keep your points low.</div>
          <div>3. Watch the discard pile and spreads.</div>
          <div>4. Time drops carefully and watch for special auto-wins.</div>
        </div>
      </details>

      {activePopup ? (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0e1320] p-5 shadow-[0_28px_70px_rgba(0,0,0,0.55)]">
            <div className="text-xs uppercase tracking-[0.18em] text-white/55">Rule Detail</div>
            <h3 className="mt-2 text-xl font-semibold text-white">{RULE_POPUPS[activePopup].title}</h3>
            <p className="mt-3 text-sm text-white/75">{RULE_POPUPS[activePopup].body}</p>
            <div className="mt-5 flex justify-end">
              <Button variant="secondary" size="sm" onClick={() => setActivePopup(null)}>
                Close
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default HowToPlayGuide;
