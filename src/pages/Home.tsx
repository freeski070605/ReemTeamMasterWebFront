import React, { useEffect, useMemo, useState } from 'react';
import { motion, type Variants } from 'framer-motion';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import client from '../api/client';
import { Table } from '../types/game';

const Home: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const [tables, setTables] = useState<Table[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const logoSrc = "/assets/logo.png";
  const splashSrc = "/assets/SplashPage.png";
  const displayFont = '"Oswald", "Gabarito", sans-serif';
  const bodyFont = '"Gabarito", "Oswald", sans-serif';
  const container: Variants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.12, delayChildren: 0.1 },
    },
  };

  const item: Variants = {
    hidden: { opacity: 0, y: 16 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] } },
  };

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await client.get<Table[]>('/tables');
        setTables(response.data || []);
      } catch (error) {
        console.error('Failed to load tables for home page', error);
        setTables([]);
      } finally {
        setTablesLoading(false);
      }
    };

    fetchTables();
  }, []);

  const featuredTable = useMemo(() => {
    if (tables.length === 0) return null;
    const sorted = [...tables].sort((a, b) => {
      if (a.status !== b.status) return a.status === 'in-game' ? -1 : 1;
      if (a.currentPlayerCount !== b.currentPlayerCount) return b.currentPlayerCount - a.currentPlayerCount;
      return b.stake - a.stake;
    });
    return sorted[0] || null;
  }, [tables]);

  const featuredName = featuredTable?.name || (featuredTable ? `Table ${featuredTable._id.slice(-4)}` : 'No Table');
  const featuredStake = featuredTable?.stake ?? 0;
  const featuredPlayers = featuredTable ? `${featuredTable.currentPlayerCount}/${featuredTable.maxPlayers}` : '--';
  const featuredSeatsOpen = featuredTable ? Math.max(featuredTable.maxPlayers - featuredTable.currentPlayerCount, 0) : 0;
  const featuredStatus = featuredTable?.status === 'in-game' ? 'In Progress' : 'Waiting';

  return (
    <div
      className="relative min-h-screen overflow-hidden text-white"
      style={{ fontFamily: bodyFont }}
    >
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(1200px 600px at 10% 10%, rgba(255,199,74,0.18), transparent 60%),' +
            'radial-gradient(900px 500px at 90% 10%, rgba(244,138,24,0.2), transparent 55%),' +
            'linear-gradient(180deg, #0a0b0d 0%, #151414 55%, #0a0b0d 100%)',
        }}
        aria-hidden
      />
      <div
        className="absolute inset-0 opacity-35"
        style={{
          backgroundImage: `url(${splashSrc})`,
          backgroundPosition: "80% 10%",
          backgroundRepeat: "no-repeat",
          backgroundSize: "min(900px, 85vw)",
          mixBlendMode: "screen",
          filter: "saturate(1.1) blur(0.4px)",
        }}
        aria-hidden
      />
      <div className="absolute inset-0 opacity-25 mix-blend-soft-light bg-[radial-gradient(circle_at_1px_1px,#ffffff_1px,transparent_0)] [background-size:26px_26px]" aria-hidden />

      <div className="relative z-10">
        <motion.header
          className="max-w-6xl mx-auto px-6 pt-10 flex items-center justify-between"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] }}
        >
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute -inset-2 rounded-full bg-yellow-400/20 blur-xl" />
              <img
                src={logoSrc}
                alt="ReemTeam logo"
                className="relative w-12 h-12 object-contain drop-shadow-[0_12px_30px_rgba(250,204,21,0.35)]"
              />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight" style={{ fontFamily: displayFont }}>
                ReemTeam
              </div>
              <div className="text-xs text-white/60 uppercase tracking-[0.3em]">Tonk Arena</div>
            </div>
          </div>
          <nav className="flex items-center gap-3 text-sm">
            {isAuthenticated ? (
              <>
                <span className="text-white/70">Welcome, {user?.username || 'Player'}</span>
                <Link className="px-4 py-2 rounded-full border border-white/15 hover:border-white/40 transition" to="/account">
                  Account
                </Link>
                <Link className="px-5 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-semibold hover:scale-[1.02] transition" to="/tables">
                  Enter Tables
                </Link>
              </>
            ) : (
              <>
                <Link className="px-4 py-2 rounded-full border border-white/15 hover:border-white/40 transition" to="/login">
                  Log In
                </Link>
                <Link className="px-5 py-2 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-semibold hover:scale-[1.02] transition" to="/register">
                  Create Account
                </Link>
              </>
            )}
          </nav>
        </motion.header>

        <main className="max-w-6xl mx-auto px-6 pb-20">
          <motion.section
            className="pt-16 md:pt-24 grid md:grid-cols-[1.1fr_0.9fr] gap-12 items-center"
            variants={container}
            initial="hidden"
            animate="show"
          >
            <motion.div variants={item}>
              <motion.div variants={item} className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full border border-white/15 bg-white/5 mb-6">
                <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                {tablesLoading ? 'Loading live tables...' : `${tables.length} live tables right now`}
              </motion.div>
              <motion.h1
                variants={item}
                className="text-4xl md:text-6xl font-semibold leading-tight"
                style={{ fontFamily: displayFont }}
              >
                High-stakes energy.
                <span className="text-yellow-300"> Street-smart Tonk.</span>
              </motion.h1>
              <motion.p variants={item} className="mt-5 text-white/70 text-lg leading-relaxed">
                Join a table, lock in your stake, and push your hand through live rounds with
                instant spreads, hits, and drops. Built for 2 to 4 players and tuned for pace.
              </motion.p>
              <motion.div variants={item} className="mt-8 flex flex-wrap gap-3">
                {isAuthenticated ? (
                  <Link className="px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-semibold hover:scale-[1.02] transition" to="/tables">
                    Find a Table
                  </Link>
                ) : (
                  <Link className="px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-semibold hover:scale-[1.02] transition" to="/register">
                    Get Started
                  </Link>
                )}
                <Link className="px-6 py-3 rounded-full border border-white/20 hover:border-white/50 transition" to="/login">
                  I Already Have an Account
                </Link>
              </motion.div>
              <motion.div variants={item} className="mt-10 flex flex-wrap items-center gap-4 text-sm text-white/70">
                {[
                  { label: "Real-time", sub: "Socket play" },
                  { label: "Secure", sub: "Wallet + payouts" },
                  { label: "Smart", sub: "AI ready" },
                ].map((chip) => (
                  <div key={chip.label} className="rounded-full border border-white/10 bg-black/30 px-4 py-2">
                    <div className="text-white text-sm font-semibold">{chip.label}</div>
                    <div className="text-white/50 text-xs">{chip.sub}</div>
                  </div>
                ))}
              </motion.div>
            </motion.div>

            <motion.div variants={item} className="relative">
              <div className="absolute -inset-6 rounded-[32px] bg-gradient-to-br from-yellow-400/20 to-orange-500/10 blur-2xl" />
              <div className="relative rounded-[32px] border border-white/10 bg-black/40 p-5 backdrop-blur-sm shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <div className="text-xs uppercase tracking-[0.25em] text-white/60">Featured Arena</div>
                  <div className="text-xs text-white/50">{featuredName}</div>
                </div>
                <div className="overflow-hidden rounded-2xl border border-white/10 bg-black/60">
                  <img src={splashSrc} alt="ReemTeam splash art" className="w-full h-56 object-cover" />
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-white/60">Table</div>
                    <div className="text-2xl font-semibold text-white">{featuredName}</div>
                    <div className="text-white/50">${featuredStake} stake</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-white/60">Players</div>
                    <div className="text-2xl font-semibold text-white">{featuredPlayers}</div>
                    <div className="text-white/50">{featuredSeatsOpen} seats open</div>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4">
                  <div className="text-white/60 mb-2">Status</div>
                  <div className="text-3xl font-semibold text-yellow-300">{featuredTable ? featuredStatus : 'No tables yet'}</div>
                  <div className="text-white/50 text-xs mt-2">
                    {featuredTable ? 'Join a table to jump into the next hand.' : 'Tables will appear here once created.'}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.section>

          <motion.section
            className="mt-16 md:mt-24 grid md:grid-cols-3 gap-6"
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            <motion.div variants={item} className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-sm">
              <div className="text-sm uppercase tracking-[0.2em] text-white/50">Gameplay</div>
              <div className="mt-3 text-xl font-semibold">Fast rounds, clean flows</div>
              <p className="mt-3 text-white/70">Automatic dealing, clear turn cues, and instant round resolution.</p>
            </motion.div>
            <motion.div variants={item} className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-sm">
              <div className="text-sm uppercase tracking-[0.2em] text-white/50">Wallet</div>
              <div className="mt-3 text-xl font-semibold">Deposit and withdraw</div>
              <p className="mt-3 text-white/70">Square checkout, tracked balances, and visible transaction history.</p>
            </motion.div>
            <motion.div variants={item} className="rounded-2xl border border-white/10 bg-black/40 p-6 backdrop-blur-sm">
              <div className="text-sm uppercase tracking-[0.2em] text-white/50">Skill</div>
              <div className="mt-3 text-xl font-semibold">AI when you need it</div>
              <p className="mt-3 text-white/70">Keep tables active even when players drop, no waiting around.</p>
            </motion.div>
          </motion.section>

          <motion.section
            className="mt-16 md:mt-24 rounded-3xl border border-white/10 bg-black/30 p-8 md:p-12 backdrop-blur-sm"
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.2 }}
          >
            <motion.div variants={item} className="text-sm uppercase tracking-[0.2em] text-white/50">How it works</motion.div>
            <motion.div variants={container} className="mt-6 grid md:grid-cols-3 gap-6 text-white/80">
              <motion.div variants={item} className="rounded-2xl border border-white/10 p-5">
                <div className="text-yellow-300 font-semibold">1. Pick a table</div>
                <p className="mt-2 text-white/70 text-sm">Choose your stake and join a live room.</p>
              </motion.div>
              <motion.div variants={item} className="rounded-2xl border border-white/10 p-5">
                <div className="text-yellow-300 font-semibold">2. Play the round</div>
                <p className="mt-2 text-white/70 text-sm">Draw, discard, spread, hit, or drop.</p>
              </motion.div>
              <motion.div variants={item} className="rounded-2xl border border-white/10 p-5">
                <div className="text-yellow-300 font-semibold">3. Get paid</div>
                <p className="mt-2 text-white/70 text-sm">Instant round payouts and tracked earnings.</p>
              </motion.div>
            </motion.div>
            <motion.div variants={item} className="mt-8 flex flex-wrap gap-3">
              {isAuthenticated ? (
                <Link className="px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-semibold hover:scale-[1.02] transition" to="/tables">
                  Jump In Now
                </Link>
              ) : (
                <Link className="px-6 py-3 rounded-full bg-gradient-to-r from-yellow-400 to-amber-500 text-black font-semibold hover:scale-[1.02] transition" to="/register">
                  Create Your Account
                </Link>
              )}
              <Link className="px-6 py-3 rounded-full border border-white/20 hover:border-white/50 transition" to="/login">
                View Login
              </Link>
            </motion.div>
          </motion.section>
        </main>
      </div>
    </div>
  );
};

export default Home;
