import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { Table } from '../types/game';
import { Button } from '../components/ui/Button';
import {
  getModeLabel,
  getStakeDisplay,
  getTableDisplayName,
} from '../branding/modeCopy';

const formatRtcAmount = (stake?: number): string | null => {
  if (typeof stake !== 'number' || !Number.isFinite(stake)) return null;
  return (stake * 1000).toLocaleString();
};

const Home: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await client.get<Table[]>('/tables');
        setTables(response.data || []);
      } catch (error) {
        console.error('Failed to load tables', error);
        setTables([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchTables();
  }, []);

  const tableSummary = useMemo(() => {
    const active = tables.filter((table) => table.status === 'in-game').length;
    const usd = tables.filter((table) => table.mode === 'USD_CONTEST').length;
    const rtc = tables.filter((table) => table.mode !== 'USD_CONTEST').length;
    return { active, usd, rtc };
  }, [tables]);

  const featured = useMemo(() => {
    if (tables.length === 0) return null;
    return [...tables].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'in-game' ? -1 : 1;
      if (a.currentPlayerCount !== b.currentPlayerCount) return b.currentPlayerCount - a.currentPlayerCount;
      return b.stake - a.stake;
    })[0];
  }, [tables]);

  const featuredSummary = useMemo(() => {
    if (!featured) {
      return {
        title: 'Crib - 50,000 RTC',
        buyIn: '50,000 RTC',
        seats: '0 / 4',
      };
    }

    const isUsd = featured.mode === 'USD_CONTEST';
    const stakeDisplay = getStakeDisplay(featured.stake, featured.mode);
    const rtcAmount = !isUsd ? formatRtcAmount(featured.stake) : null;
    const rtcLabel = rtcAmount ?? stakeDisplay.amount;

    return {
      title: isUsd ? getTableDisplayName(featured) : `Crib - ${rtcLabel} RTC`,
      buyIn: isUsd ? `${stakeDisplay.amount} ${stakeDisplay.unit}` : `${rtcLabel} RTC`,
      seats: `${featured.currentPlayerCount} / ${featured.maxPlayers}`,
    };
  }, [featured]);

  return (
    <div className="space-y-10">
      <section className="rt-panel-strong rounded-3xl p-8 md:p-10 overflow-hidden relative">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(247,188,58,0.28), rgba(247,188,58,0))' }}
        />
        <div
          className="pointer-events-none absolute -left-20 -bottom-20 h-80 w-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,138,38,0.2), rgba(255,138,38,0))' }}
        />
        <div className="relative z-10">
          <div className="mb-4 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
            Crib Smoke. Crown Stage.
          </div>
          <h1 className="rt-page-title text-4xl md:text-6xl font-semibold leading-tight">
            Welcome to ReemTeam.
          </h1>
          <p className="mt-4 text-lg text-white/80">The tables stay active and the hands move fast.</p>
          <p className="mt-4 max-w-2xl text-white/70">
            Cribs are where players run everyday hands using Reem Team Cash (RTC). Pull up, learn the table rhythm,
            and stack your bankroll.
          </p>
          <p className="mt-3 max-w-2xl text-white/70">
            When you&apos;re ready for bigger pressure, step into Cash Crown Tournaments - bracket play with locked
            seats and real cash payouts.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rt-glass rounded-2xl p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">New to Tonk or ReemTeam?</div>
          <p className="mt-3 text-white/70">Before you jump in, make sure you understand the rules.</p>
          <div className="mt-6">
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Learn the Game First</div>
            <Link to="/how-to-play" className="mt-2 inline-flex items-center gap-2 text-amber-300 font-semibold">
              -&gt; How to Play ReemTeam
            </Link>
            <div className="mt-2 text-sm text-white/70">
              (Shows spreads, hits, drops, Reems, and all win conditions)
            </div>
          </div>
        </div>
        <div className="rt-panel-strong rounded-2xl p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-white/55">Live Game Activity</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/55">Open Cribs</div>
              <div className="mt-2 text-3xl rt-page-title">{loading ? '--' : tables.length}</div>
            </div>
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/55">Hands Running Right Now</div>
              <div className="mt-2 text-3xl rt-page-title">{loading ? '--' : tableSummary.active}</div>
            </div>
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/55">Reem Team Cash Rooms</div>
              <div className="mt-2 text-3xl rt-page-title">{loading ? '--' : tableSummary.rtc}</div>
            </div>
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/55">Cash Crown Tournaments</div>
              <div className="mt-2 text-3xl rt-page-title">{loading ? '--' : tableSummary.usd}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rt-glass rounded-2xl p-6 space-y-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Where New Players Should Start</div>
          <div>
            <h2 className="rt-page-title text-2xl">Reem Team Cash Crib (Recommended)</h2>
            <p className="mt-2 text-sm text-white/70">This is the best place to learn the flow of the game.</p>
          </div>
          <ul className="space-y-2 text-sm text-white/70 list-disc pl-5">
            <li>Fast hands</li>
            <li>RTC stakes</li>
            <li>Join between rounds</li>
            <li>Leave anytime between hands</li>
          </ul>
          <div className="text-sm text-white/70">Perfect for:</div>
          <ul className="space-y-2 text-sm text-white/70 list-disc pl-5">
            <li>Learning spreads and hits</li>
            <li>Understanding drop timing</li>
            <li>Building RTC</li>
          </ul>
        </div>
        <div className="rt-glass rounded-2xl p-6 space-y-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Reem Team Cash Tournaments</div>
          <h2 className="rt-page-title text-2xl">Reem Team Cash Tournaments</h2>
          <p className="text-sm text-white/70">Structured tournaments played using RTC.</p>
          <ul className="space-y-2 text-sm text-white/70 list-disc pl-5">
            <li>Locked seats after start</li>
            <li>Everyone plays until the bracket finishes</li>
            <li>Winners earn RTC prizes or satellite tickets</li>
            <li>Some tournaments feed directly into Cash Crown events.</li>
          </ul>
        </div>
        <div className="rt-glass rounded-2xl p-6 space-y-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Cash Crown Tournaments</div>
          <h2 className="rt-page-title text-2xl">Cash Crown Tournaments</h2>
          <p className="text-sm text-white/70">This is the main stage.</p>
          <p className="text-sm text-white/70">
            Cash Crown tournaments require real money buy-ins and pay out real winnings.
          </p>
          <ul className="space-y-2 text-sm text-white/70 list-disc pl-5">
            <li>Fixed brackets</li>
            <li>Locked prize pools</li>
            <li>Placement payouts after results finalize</li>
          </ul>
          <p className="text-sm text-white/70">
            If you&apos;re chasing real competition and real payouts, this is where the crown gets decided.
          </p>
        </div>
      </section>

      <section className="rt-panel-strong rounded-2xl p-6">
        <div>
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Featured Crib (Start Here)</div>
          <div className="mt-2 text-2xl rt-page-title">{featuredSummary.title}</div>
          <div className="mt-3 text-sm text-white/70">{getModeLabel('FREE_RTC_TABLE')}</div>
          <div className="mt-3 flex flex-wrap gap-6 text-sm text-white/70">
            <div>Buy-in: {featuredSummary.buyIn}</div>
            <div>Seats: {featuredSummary.seats}</div>
          </div>
          <p className="mt-4 text-sm text-white/70">Run hands, read the table, and build your stack.</p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="rt-page-title text-2xl">Ready to Play?</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rt-glass rounded-2xl p-5 space-y-3">
            <Link to="/tables">
              <Button size="lg">Play Cribs</Button>
            </Link>
            <p className="text-sm text-white/70">Jump into active RTC tables.</p>
          </div>
          <div className="rt-glass rounded-2xl p-5 space-y-3">
            <Link to="/contests">
              <Button size="lg" variant="secondary">
                View Cash Crown Tournaments
              </Button>
            </Link>
            <p className="text-sm text-white/70">See upcoming real-money events.</p>
          </div>
          <div className="rt-glass rounded-2xl p-5 space-y-3">
            <Link to="/how-to-play">
              <Button size="lg" variant="ghost">
                How To Play ReemTeam
              </Button>
            </Link>
            <p className="text-sm text-white/70">
              Learn spreads, hits, drops, Reems, and win conditions before sitting at the table.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
