import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import client from '../api/client';
import { useAuthStore } from '../store/authStore';
import { Table } from '../types/game';
import { Button } from '../components/ui/Button';

const Home: React.FC = () => {
  const { isAuthenticated } = useAuthStore();
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
    const waiting = tables.filter((table) => table.status === 'waiting').length;
    const usd = tables.filter((table) => table.mode === 'USD_CONTEST').length;
    const rtc = tables.filter((table) => table.mode !== 'USD_CONTEST').length;
    return { active, waiting, usd, rtc };
  }, [tables]);

  const featured = useMemo(() => {
    if (tables.length === 0) return null;
    return [...tables].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'in-game' ? -1 : 1;
      if (a.currentPlayerCount !== b.currentPlayerCount) return b.currentPlayerCount - a.currentPlayerCount;
      return b.stake - a.stake;
    })[0];
  }, [tables]);

  return (
    <div className="space-y-8">
      <section className="rt-panel-strong rounded-3xl p-8 md:p-10 overflow-hidden relative">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-72 w-72 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(247,188,58,0.28), rgba(247,188,58,0))' }}
        />
        <div
          className="pointer-events-none absolute -left-20 -bottom-20 h-80 w-80 rounded-full blur-3xl"
          style={{ background: 'radial-gradient(circle, rgba(255,138,38,0.2), rgba(255,138,38,0))' }}
        />
        <div className="relative z-10 grid gap-8 md:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="mb-4 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.2em] text-white/70">
              Dual-Currency Competitive Arena
            </div>
            <h1 className="rt-page-title text-4xl md:text-6xl font-semibold leading-tight">
              Skill-first Tonk.
              <span className="block text-amber-300">Refactored for RTC and USD modes.</span>
            </h1>
            <p className="mt-5 max-w-xl text-white/70">
              Free RTC tables for pace, structured RTC tournaments for progression, and USD contests for fixed
              prize competition. Same gameboard flow, cleaner ecosystem.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {isAuthenticated ? (
                <>
                  <Link to="/tables">
                    <Button size="lg">Browse Tables</Button>
                  </Link>
                  <Link to="/contests">
                    <Button variant="secondary" size="lg">
                      Open Contests
                    </Button>
                  </Link>
                </>
              ) : (
                <>
                  <Link to="/register">
                    <Button size="lg">Create Account</Button>
                  </Link>
                  <Link to="/login">
                    <Button variant="secondary" size="lg">
                      Login
                    </Button>
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/55">Tables</div>
              <div className="mt-2 text-3xl rt-page-title">{loading ? '--' : tables.length}</div>
            </div>
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/55">In Progress</div>
              <div className="mt-2 text-3xl rt-page-title">{loading ? '--' : tableSummary.active}</div>
            </div>
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/55">RTC Modes</div>
              <div className="mt-2 text-3xl rt-page-title">{loading ? '--' : tableSummary.rtc}</div>
            </div>
            <div className="rt-glass rounded-2xl p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-white/55">USD Modes</div>
              <div className="mt-2 text-3xl rt-page-title">{loading ? '--' : tableSummary.usd}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        <div className="rt-glass rounded-2xl p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Free Mode</div>
          <h2 className="mt-3 rt-page-title text-2xl">FREE_RTC_TABLE</h2>
          <p className="mt-3 text-white/70 text-sm">
            Continuous round-based sessions with AI support and immediate RTC movement.
          </p>
        </div>
        <div className="rt-glass rounded-2xl p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Competitive RTC</div>
          <h2 className="mt-3 rt-page-title text-2xl">RTC_TOURNAMENT / SATELLITE</h2>
          <p className="mt-3 text-white/70 text-sm">
            Locked-player structured matches with entry, placements, and ticket path to USD contests.
          </p>
        </div>
        <div className="rt-glass rounded-2xl p-6">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Paid Contests</div>
          <h2 className="mt-3 rt-page-title text-2xl">USD_CONTEST</h2>
          <p className="mt-3 text-white/70 text-sm">
            Fixed entry, locked prize pool, and placement-based payout after engine results.
          </p>
        </div>
      </section>

      <section className="rt-panel-strong rounded-2xl p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-white/50">Featured Arena</div>
            <div className="mt-2 text-2xl rt-page-title">
              {featured ? (featured.name || `Table ${featured._id.slice(-4)}`) : 'No active table'}
            </div>
            <div className="mt-1 text-sm text-white/65">
              {featured
                ? `${featured.mode || 'FREE_RTC_TABLE'} • Stake ${featured.stake} • ${featured.currentPlayerCount}/${featured.maxPlayers} players`
                : 'Tables appear here once seeded and available.'}
            </div>
          </div>
          <div className="flex gap-2">
            <Link to="/tables">
              <Button variant="secondary">Tables</Button>
            </Link>
            <Link to="/contests">
              <Button>Contests</Button>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
