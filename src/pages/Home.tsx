import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import client from '../api/client';
import { trackEvent } from '../api/analytics';
import { createVipCheckout } from '../api/vip';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import { Contest, Table } from '../types/game';
import {
  getContestDisplayName,
  getContestStatusLabel,
  getModeDescription,
  getModeLabel,
  getStakeDisplay,
  getTableDisplayName,
} from '../branding/modeCopy';

type LeaderboardRanking = {
  rank: number;
  playerId: string;
  username: string;
  value: number;
  secondaryValue?: number;
};

type HomeLeaderboard = {
  metric: string;
  window: string;
  title: string;
  description: string;
  rankings: LeaderboardRanking[];
};

type HomeOverview = {
  generatedAt: string;
  tableSummary: {
    totalTables: number;
    activeTables: number;
    rtcTables: number;
    cashTables: number;
    privateTables: number;
  };
  contestSummary: {
    totalContests: number;
    openContests: number;
    liveContests: number;
    seatsFilled: number;
    totalSeats: number;
    totalPrizePool: number;
  };
  featuredTable: Table | null;
  featuredContest: Contest | null;
  leaderboards: {
    topEarners: HomeLeaderboard | null;
    mostReems: HomeLeaderboard | null;
    bestWinRate: HomeLeaderboard | null;
    longestStreak: HomeLeaderboard | null;
  };
};

const formatUsd = (value?: number | null) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value ?? 0);

const formatRtcFromStake = (stake?: number) => {
  if (typeof stake !== 'number' || !Number.isFinite(stake)) {
    return '25,000 RTC';
  }
  return (stake * 1000).toLocaleString('en-US');
};

const formatLeaderboardValue = (metric: string, value: number) => {
  if (metric === 'top_earners') return formatUsd(value);
  if (metric === 'best_win_rate') return `${value.toFixed(1)}%`;
  return Math.round(value).toLocaleString('en-US');
};

const Home: React.FC = () => {
  const [overview, setOverview] = useState<HomeOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [vipCheckoutLoading, setVipCheckoutLoading] = useState(false);
  const { isAuthenticated, user } = useAuthStore();
  const navigate = useNavigate();
  const isVip = !!user?.isVip;

  useEffect(() => {
    void trackEvent('home_view');

    const fetchOverview = async () => {
      try {
        const response = await client.get<HomeOverview>('/home/overview');
        setOverview(response.data ?? null);
      } catch (error) {
        console.error('Failed to load home overview', error);
        setOverview(null);
      } finally {
        setLoading(false);
      }
    };

    void fetchOverview();
  }, []);

  const handleVipCheckout = async () => {
    void trackEvent('home_cta_click', { cta: 'vip' });
    if (isVip) {
      navigate('/account');
      return;
    }
    if (!isAuthenticated) {
      navigate('/login', { state: { from: { pathname: '/' } } });
      return;
    }
    setVipCheckoutLoading(true);
    try {
      const checkoutUrl = await createVipCheckout();
      if (checkoutUrl) {
        window.location.href = checkoutUrl;
        return;
      }
      toast.error('Failed to start VIP checkout.');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Could not start VIP checkout.');
    } finally {
      setVipCheckoutLoading(false);
    }
  };

  const featuredTableSummary = useMemo(() => {
    const featuredTable = overview?.featuredTable;
    if (!featuredTable) {
      return {
        title: 'Crib 25,000 Reem Team Cash',
        label: 'Reem Team Cash Crib',
        buyIn: '25,000 RTC',
        seats: '0 / 4',
        description: 'The easiest place to learn the rhythm of a live ReemTeam table.',
      };
    }

    const stakeDisplay = getStakeDisplay(featuredTable.stake, featuredTable.mode);
    const isUsdTable = featuredTable.mode === 'USD_CONTEST' || featuredTable.mode === 'PRIVATE_USD_TABLE';

    return {
      title: getTableDisplayName(featuredTable),
      label: getModeLabel(featuredTable.mode),
      buyIn: isUsdTable ? `${stakeDisplay.amount} ${stakeDisplay.unit}` : `${formatRtcFromStake(featuredTable.stake)} RTC`,
      seats: `${featuredTable.currentPlayerCount} / ${featuredTable.maxPlayers}`,
      description: getModeDescription(featuredTable.mode),
    };
  }, [overview?.featuredTable]);

  const featuredContestSummary = useMemo(() => {
    const featuredContest = overview?.featuredContest;
    if (!featuredContest) {
      return {
        title: 'Cash Crown Spotlight',
        status: 'Open Seats',
        entry: '$10',
        prizePool: '$0',
        seats: '0 / 0',
      };
    }

    return {
      title: getContestDisplayName(featuredContest.contestId),
      status: getContestStatusLabel(featuredContest.status),
      entry: formatUsd(featuredContest.entryFee),
      prizePool: formatUsd(featuredContest.prizePool),
      seats: `${featuredContest.participants?.length ?? 0} / ${featuredContest.playerCount}`,
    };
  }, [overview?.featuredContest]);

  const leaderboardCards = useMemo(
    () =>
      [
        overview?.leaderboards.topEarners,
        overview?.leaderboards.mostReems,
        overview?.leaderboards.bestWinRate,
        overview?.leaderboards.longestStreak,
      ]
        .filter((board): board is HomeLeaderboard => !!board)
        .map((board) => ({
          ...board,
          champion: board.rankings[0] ?? null,
          runnerUps: board.rankings.slice(1, 4),
        })),
    [overview]
  );

  const glossary = [
    {
      term: 'RTC',
      meaning: 'Reem Team Cash. This is the in-app bankroll used in crib games and RTC lanes.',
    },
    {
      term: 'Crib',
      meaning: 'A live RTC table where hands keep moving and players can rotate in between rounds.',
    },
    {
      term: 'Reem',
      meaning: 'A premium win condition players chase and the moment most people remember.',
    },
    {
      term: 'Cash Crown',
      meaning: 'A real-money tournament lane with fixed entry, locked seats, and prize payouts.',
    },
  ];

  const featureCards = [
    {
      eyebrow: 'Start Here',
      title: 'Begin in RTC cribs',
      body: 'If you are new, this is the easiest place to learn the pace of the table, how turns work, and when to push for a win.',
    },
    {
      eyebrow: 'See What Is Live',
      title: 'Check the board and jump in',
      body: 'You can see who is winning, which tables are active, and where the action is before you choose where to sit.',
    },
    {
      eyebrow: 'Ready For More',
      title: 'Step into Cash Crown',
      body: 'When you want bigger pressure and real-money competition, Cash Crown gives you fixed seats, visible prize pools, and higher stakes.',
    },
  ];

  const newcomerSteps = [
    {
      step: '1',
      title: 'Learn the basics first',
      body: 'You should know what RTC, cribs, Reems, and Cash Crown mean before you sit down, so the page explains them right away.',
    },
    {
      step: '2',
      title: 'Pick the right place to start',
      body: 'Most players should begin in RTC cribs, then move into tournaments later once the game starts to feel natural.',
    },
    {
      step: '3',
      title: 'Follow the live action',
      body: 'The leaderboard and featured table show where the game is moving right now and who is playing well.',
    },
  ];

  const livePulse = {
    totalTables: overview?.tableSummary.totalTables ?? 0,
    activeTables: overview?.tableSummary.activeTables ?? 0,
    rtcTables: overview?.tableSummary.rtcTables ?? 0,
    cashTables: overview?.tableSummary.cashTables ?? 0,
    openContests: overview?.contestSummary.openContests ?? 0,
    liveContests: overview?.contestSummary.liveContests ?? 0,
    seatsFilled: overview?.contestSummary.seatsFilled ?? 0,
    totalSeats: overview?.contestSummary.totalSeats ?? 0,
    totalPrizePool: overview?.contestSummary.totalPrizePool ?? 0,
  };

  return (
    <div className="space-y-8 md:space-y-10">
      <section className="landing-hero account-reveal rt-landscape-compact-card relative overflow-hidden rounded-[32px] border border-white/12 p-6 md:p-10">
        <div className="landing-hero__mesh pointer-events-none absolute inset-0 opacity-90" />
        <div className="relative z-10 grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-start">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/70">
              Crib Smoke. Crown Stage.
            </div>
            <h1 className="mt-5 text-4xl leading-[0.98] rt-page-title sm:text-5xl xl:text-6xl">
              Welcome to ReemTeam.
            </h1>
            <p className="mt-5 max-w-2xl text-base text-white/76 sm:text-lg">
              Cribs are where players run everyday hands using Reem Team Cash. Pull up, learn the flow of the table,
              and build your stack.
            </p>
            <p className="mt-3 max-w-2xl text-base text-white/70 sm:text-lg">
              When you are ready for more pressure, step into Cash Crown Tournaments for fixed seats, real-money buy-ins,
              and prize pools.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <Link to="/tables" onClick={() => void trackEvent('home_cta_click', { cta: 'play_cribs' })}>
                <Button size="lg">Pull Up to Cribs</Button>
              </Link>
              <Link to="/contests" onClick={() => void trackEvent('home_cta_click', { cta: 'cash_crown' })}>
                <Button size="lg" variant="secondary">
                  View Cash Crown
                </Button>
              </Link>
              <Link to="/how-to-play" onClick={() => void trackEvent('home_cta_click', { cta: 'how_to_play' })}>
                <Button size="lg" variant="ghost">
                  How to Play ReemTeam
                </Button>
              </Link>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {glossary.map((item) => (
                <div key={item.term} className="landing-chip-card rounded-2xl p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200/90">{item.term}</div>
                  <p className="mt-2 text-sm text-white/74">{item.meaning}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="landing-spotlight rounded-[28px] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/55">Live Game Activity</div>
                <div className="mt-2 text-2xl rt-page-title text-white">
                  {loading ? 'Loading...' : 'What is running right now'}
                </div>
              </div>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                {loading ? 'Checking' : 'Updated'}
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="landing-stat-card rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Live Tables</div>
                <div className="mt-2 text-3xl rt-page-title text-white">{loading ? '--' : livePulse.activeTables}</div>
              </div>
              <div className="landing-stat-card rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Open Crowns</div>
                <div className="mt-2 text-3xl rt-page-title text-white">{loading ? '--' : livePulse.openContests}</div>
              </div>
              <div className="landing-stat-card rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">RTC Lanes</div>
                <div className="mt-2 text-3xl rt-page-title text-white">{loading ? '--' : livePulse.rtcTables}</div>
              </div>
              <div className="landing-stat-card rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Prize Pools</div>
                <div className="mt-2 text-3xl rt-page-title text-white">
                  {loading ? '--' : formatUsd(livePulse.totalPrizePool)}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Featured Table</div>
              <div className="mt-2 text-lg rt-page-title text-white">{featuredTableSummary.title}</div>
              <div className="mt-1 text-sm text-white/68">{featuredTableSummary.description}</div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-white/62">
                <span>{featuredTableSummary.label}</span>
                <span>Buy-in: {featuredTableSummary.buyIn}</span>
                <span>Seats: {featuredTableSummary.seats}</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {featureCards.map((card, index) => (
          <article
            key={card.title}
            className="account-reveal rt-landscape-compact-card rt-glass rounded-2xl p-6"
            style={{ animationDelay: `${60 + index * 70}ms` }}
          >
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">{card.eyebrow}</div>
            <h2 className="mt-3 text-2xl rt-page-title">{card.title}</h2>
            <p className="mt-3 text-sm leading-6 text-white/70">{card.body}</p>
          </article>
        ))}
      </section>

      <section className="account-reveal rt-landscape-compact-card rt-panel-strong rounded-[28px] p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Leaderboard</div>
            <h2 className="mt-2 text-3xl rt-page-title">The 7-day board is front and center.</h2>
            <p className="mt-3 max-w-2xl text-sm text-white/68">
              See who is winning, who is landing the most Reems, and who is on the best run this week.
            </p>
          </div>
          <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs uppercase tracking-[0.16em] text-white/58">
            {loading ? 'Syncing board...' : `Updated ${new Date(overview?.generatedAt ?? Date.now()).toLocaleDateString()}`}
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-4 md:grid-cols-2">
          {leaderboardCards.map((board) => (
            <article key={`${board.metric}-${board.window}`} className="landing-leaderboard-card rounded-[24px] p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">{board.window}</div>
                  <h3 className="mt-2 text-xl rt-page-title">{board.title}</h3>
                </div>
                <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-200">
                  Hot
                </span>
              </div>
              <p className="mt-3 text-sm text-white/64">{board.description}</p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="text-[11px] uppercase tracking-[0.16em] text-white/48">Current Leader</div>
                <div className="mt-2 flex items-end justify-between gap-4">
                  <div>
                    <div className="text-lg rt-page-title text-white">{board.champion?.username ?? 'No player yet'}</div>
                    <div className="mt-1 text-xs text-white/55">Rank #{board.champion?.rank ?? 1}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl rt-page-title text-white">
                      {board.champion ? formatLeaderboardValue(board.metric, board.champion.value) : '--'}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {board.runnerUps.map((player) => (
                  <div key={`${board.metric}-${player.playerId}-${player.rank}`} className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2.5 text-sm">
                    <span className="text-white/74">
                      #{player.rank} {player.username}
                    </span>
                    <span className="text-white/58">{formatLeaderboardValue(board.metric, player.value)}</span>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <article className="account-reveal rt-landscape-compact-card rt-panel-strong rounded-[28px] p-6 md:p-8">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">How ReemTeam Works</div>
          <h2 className="mt-2 text-3xl rt-page-title">Everything should make sense before your first hand.</h2>
          <div className="mt-6 grid gap-4">
            {newcomerSteps.map((item) => (
              <div key={item.step} className="flex gap-4 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-300/30 bg-amber-300/10 text-sm font-semibold text-amber-100">
                  {item.step}
                </div>
                <div>
                  <div className="text-lg rt-page-title text-white">{item.title}</div>
                  <p className="mt-2 text-sm leading-6 text-white/68">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/how-to-play" onClick={() => void trackEvent('home_cta_click', { cta: 'learn_rules' })}>
              <Button>Learn the Rules</Button>
            </Link>
            <Link to="/tables" onClick={() => void trackEvent('home_cta_click', { cta: 'browse_tables' })}>
              <Button variant="secondary">Browse Live Tables</Button>
            </Link>
          </div>
        </article>

        <article className="account-reveal rt-landscape-compact-card rt-glass rounded-[28px] p-6 md:p-8">
          <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Where To Start</div>
          <h2 className="mt-2 text-3xl rt-page-title">Choose the game that fits where you are right now.</h2>
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200/90">Best first stop</div>
              <div className="mt-2 text-xl rt-page-title text-white">RTC Cribs</div>
              <p className="mt-2 text-sm text-white/68">
                Continuous hands, easier repetition, and the cleanest place to learn table rhythm, spreads, hits, and drops.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200/90">Next step</div>
              <div className="mt-2 text-xl rt-page-title text-white">Cash Crown Tournaments</div>
              <p className="mt-2 text-sm text-white/68">
                Fixed entry, visible prize pools, and locked seats for players who want a more serious match.
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-amber-200/90">Private play</div>
              <div className="mt-2 text-xl rt-page-title text-white">VIP Private Rooms</div>
              <p className="mt-2 text-sm text-white/68">
                Invite-only hosted tables let you bring your own group in and play in a more controlled room.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <article className="account-reveal rt-landscape-compact-card rt-panel-strong rounded-[28px] p-6 md:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Featured Live Action</div>
              <h2 className="mt-2 text-2xl rt-page-title">{featuredTableSummary.title}</h2>
            </div>
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-white/60">
              {featuredTableSummary.label}
            </span>
          </div>
          <p className="mt-3 text-sm text-white/68">{featuredTableSummary.description}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="landing-stat-card rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">Buy-In</div>
              <div className="mt-2 text-lg rt-page-title text-white">{featuredTableSummary.buyIn}</div>
            </div>
            <div className="landing-stat-card rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">Seats</div>
              <div className="mt-2 text-lg rt-page-title text-white">{featuredTableSummary.seats}</div>
            </div>
            <div className="landing-stat-card rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">Live Tables</div>
              <div className="mt-2 text-lg rt-page-title text-white">{loading ? '--' : livePulse.totalTables}</div>
            </div>
          </div>
          <div className="mt-5">
            <Link to="/tables" onClick={() => void trackEvent('home_cta_click', { cta: 'featured_table' })}>
              <Button>Jump to Tables</Button>
            </Link>
          </div>
        </article>

        <article className="account-reveal rt-landscape-compact-card rt-glass rounded-[28px] p-6 md:p-8">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Cash Crown Spotlight</div>
              <h2 className="mt-2 text-2xl rt-page-title">{featuredContestSummary.title}</h2>
            </div>
            <span className="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.16em] text-amber-200">
              {featuredContestSummary.status}
            </span>
          </div>
          <p className="mt-3 text-sm text-white/68">
            If you want bigger pressure, this is where you can move from RTC tables into real-money tournament play.
          </p>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="landing-stat-card rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">Entry</div>
              <div className="mt-2 text-lg rt-page-title text-white">{featuredContestSummary.entry}</div>
            </div>
            <div className="landing-stat-card rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">Prize Pool</div>
              <div className="mt-2 text-lg rt-page-title text-white">{featuredContestSummary.prizePool}</div>
            </div>
            <div className="landing-stat-card rounded-2xl p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">Seats</div>
              <div className="mt-2 text-lg rt-page-title text-white">{featuredContestSummary.seats}</div>
            </div>
          </div>
          <div className="mt-5">
            <Link to="/contests" onClick={() => void trackEvent('home_cta_click', { cta: 'featured_contest' })}>
              <Button variant="secondary">View Cash Crown</Button>
            </Link>
          </div>
        </article>
      </section>

      <section className="account-reveal rt-landscape-compact-card rt-panel-strong rounded-[28px] p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Ready To Play</div>
            <h2 className="mt-2 text-3xl rt-page-title">Pick your lane and get into the game.</h2>
            <p className="mt-3 max-w-2xl text-sm text-white/68">
              Start in RTC cribs, check the leaderboard, or move into Cash Crown when you are ready for the bigger stage.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link to="/tables" onClick={() => void trackEvent('home_cta_click', { cta: 'bottom_play' })}>
              <Button size="lg">Play Now</Button>
            </Link>
            <Button size="lg" variant="secondary" onClick={handleVipCheckout} disabled={vipCheckoutLoading || isVip}>
              {isVip ? 'Manage VIP' : vipCheckoutLoading ? 'Starting VIP...' : 'Unlock VIP'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
