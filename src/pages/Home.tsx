import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Clock3, DoorOpen, Play, Sparkles, Users } from 'lucide-react';
import { ANALYTICS_EVENTS } from '../analytics/events';
import { trackEvent, trackEventOncePerSession } from '../api/analytics';
import { getHomeOverview, HomeOverview } from '../api/home';
import { getLobbyActivationState, LobbyActivationState } from '../api/lobby';
import { QuickPlayReason } from '../api/tables';
import { CribTableCard } from '../components/activation/CribTableCard';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { experienceFlags } from '../config/experienceFlags';
import { useAuthStore } from '../store/authStore';
import {
  ActivationExperienceState,
  dismissLearnMore,
  getResumeGamePath,
  markPostFirstGamePromptSeen,
  markQuickPlayIntroSeen,
  readActivationExperience,
} from '../utils/activationExperience';
import { buildGamePath } from '../utils/gamePath';
import { formatRTCAmount } from '../utils/rtcCurrency';
import {
  getModeDescription,
  getStakeDisplay,
  getTableDisplayName,
} from '../branding/modeCopy';

const quickPlayReasonCopy: Record<QuickPlayReason, string> = {
  ready_to_start: 'Starts fastest with a live human waiting.',
  instant_ai_start: 'Starts instantly with AI fill already built into public cribs.',
  filling_fast: 'Already drawing players and close to motion.',
  live_open_seat: 'Open seat in a crib that is already moving.',
};

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { authReady, isAuthenticated, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<HomeOverview | null>(null);
  const [launchpad, setLaunchpad] = useState<LobbyActivationState | null>(null);
  const [localActivationState, setLocalActivationState] = useState<ActivationExperienceState | null>(null);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    let cancelled = false;
    setLoading(true);

    const load = async () => {
      try {
        if (isAuthenticated && experienceFlags.newPreGameLayout) {
          const activationState = await getLobbyActivationState();
          if (cancelled) {
            return;
          }
          setLaunchpad(activationState);
          setOverview(null);
          setLocalActivationState(readActivationExperience(user?._id));
          return;
        }

        const nextOverview = await getHomeOverview();
        if (cancelled) {
          return;
        }
        setOverview(nextOverview);
        setLaunchpad(null);
      } catch (error) {
        console.error('Failed to load home state', error);
        if (!cancelled) {
          setOverview(null);
          setLaunchpad(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [authReady, isAuthenticated, user?._id]);

  const activationState = useMemo(() => {
    const local = localActivationState ?? readActivationExperience(user?._id);
    const server = launchpad?.playerState;
    return {
      ...local,
      hasPlayedGame: !!server?.hasPlayedGame || local.hasPlayedGame,
      hasCompletedGame: !!server?.hasCompletedGame || local.hasCompletedGame,
      firstGameStartedAt: local.firstGameStartedAt ?? server?.lastStartedAt ?? null,
      firstGameCompletedAt: local.firstGameCompletedAt ?? server?.lastCompletedAt ?? null,
    };
  }, [launchpad?.playerState, localActivationState, user?._id]);

  const isFirstTimeUser =
    experienceFlags.firstTimeUserSimplifiedFlow && !activationState.hasPlayedGame;
  const resumePath = useMemo(() => getResumeGamePath(), []);
  const showPostFirstGamePrompt =
    !!localActivationState?.hasCompletedGame && !localActivationState.hasSeenPostFirstGamePrompt;

  useEffect(() => {
    if (!isAuthenticated || !launchpad) {
      return;
    }

    void trackEventOncePerSession(
      ANALYTICS_EVENTS.quickPlayImpression,
      { source: 'home', firstTimeUser: isFirstTimeUser },
      `quick-play-impression:${user?._id ?? 'anon'}`
    );

    if (isFirstTimeUser) {
      void trackEventOncePerSession(
        ANALYTICS_EVENTS.firstTimeUserDetected,
        { source: 'home' },
        `first-time-user:${user?._id ?? 'anon'}`
      );
    }

    if (activationState.hasCompletedGame) {
      void trackEventOncePerSession(
        ANALYTICS_EVENTS.returnAfterFirstGame,
        { source: 'home' },
        `return-after-first-game:${user?._id ?? 'anon'}`
      );
    }

    if (launchpad.quickPlay) {
      void trackEventOncePerSession(
        ANALYTICS_EVENTS.recommendedTableImpression,
        {
          source: 'home',
          tableId: launchpad.quickPlay.table._id,
          reason: launchpad.quickPlay.reason,
        },
        `recommended-home:${launchpad.quickPlay.table._id}`
      );
    }

    if (isFirstTimeUser && !activationState.hasSeenQuickPlayIntro) {
      setLocalActivationState(markQuickPlayIntroSeen(user?._id));
    }
  }, [
    activationState.hasCompletedGame,
    activationState.hasSeenQuickPlayIntro,
    isAuthenticated,
    isFirstTimeUser,
    launchpad,
    user?._id,
  ]);

  const handleQuickPlayClick = () => {
    void trackEvent(ANALYTICS_EVENTS.quickPlayClick, {
      source: 'home',
      firstTimeUser: isFirstTimeUser,
    });
    navigate('/quick-play');
  };

  const handleBrowseClick = () => {
    void trackEvent(ANALYTICS_EVENTS.browseCribsClick, { source: 'home' });
    navigate('/tables');
  };

  const handleHowToPlayClick = () => {
    void trackEvent(ANALYTICS_EVENTS.howToPlayClick, { source: 'home' });
    navigate('/how-to-play');
  };

  const handleInviteFriendsClick = () => {
    navigate('/tables?panel=private');
  };

  const handleResumeClick = () => {
    if (!resumePath) {
      return;
    }
    navigate(resumePath);
  };

  const handleEnterRecommendedTable = (tableId: string, source: string) => {
    void trackEvent(ANALYTICS_EVENTS.tableCardClick, { source, tableId });
    void trackEvent(ANALYTICS_EVENTS.joinTableAttempt, { source, tableId });
    navigate(buildGamePath(tableId, { entry: source }));
  };

  const handleDismissLearnMore = () => {
    setLocalActivationState(dismissLearnMore(user?._id));
  };

  const handleDismissPostFirstGamePrompt = () => {
    setLocalActivationState(markPostFirstGamePromptSeen(user?._id));
  };

  if (!authReady || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (isAuthenticated && launchpad && experienceFlags.newPreGameLayout) {
    return (
      <div className="space-y-6">
        {showPostFirstGamePrompt ? (
          <section className="rt-panel-strong rounded-[28px] border border-emerald-300/25 bg-[linear-gradient(135deg,rgba(8,35,30,0.96),rgba(13,15,19,0.96))] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-200/75">
                  First Crib Complete
                </div>
                <h2 className="mt-2 text-3xl rt-page-title">You’re in the game now.</h2>
                <p className="mt-2 max-w-2xl text-sm text-white/70">
                  That first hand is the hard part. Pull up again, browse more live cribs, or bring your own people in.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button onClick={handleQuickPlayClick}>Play Again</Button>
                <Button variant="secondary" onClick={handleBrowseClick}>Browse More Cribs</Button>
                <Button variant="ghost" onClick={handleDismissPostFirstGamePrompt}>Close</Button>
              </div>
            </div>
          </section>
        ) : null}

        <section className="landing-hero rt-panel-strong relative overflow-hidden rounded-[32px] border border-white/12 p-6 md:p-8">
          <div className="landing-hero__mesh pointer-events-none absolute inset-0 opacity-90" />
          <div className="relative z-10 grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
            <div className="max-w-3xl">
              <div className="inline-flex items-center rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/70">
                {isFirstTimeUser ? 'Start Here' : 'Back In Action'}
              </div>
              <h1 className="mt-5 text-4xl leading-[0.98] rt-page-title sm:text-5xl">
                {isFirstTimeUser ? 'Jump into a crib.' : 'Get seated fast.'}
              </h1>
              <p className="mt-4 max-w-2xl text-base text-white/76 sm:text-lg">
                {isFirstTimeUser
                  ? 'Fast hands. Live pressure. One tap finds the best open seat for your first game.'
                  : 'Pull up to the fastest live seat, browse the room list, or jump back into your last table.'}
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <Button size="lg" onClick={handleQuickPlayClick}>
                  <Play className="mr-2 h-4 w-4" />
                  Pull Up to a Crib
                </Button>
                <Button size="lg" variant="secondary" onClick={handleBrowseClick}>
                  Browse Cribs
                </Button>
                {resumePath ? (
                  <Button size="lg" variant="ghost" onClick={handleResumeClick}>
                    Rejoin Last Table
                  </Button>
                ) : null}
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleHowToPlayClick}
                  className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/76 transition hover:bg-white/[0.08] hover:text-white"
                >
                  How to Play
                </button>
                <button
                  type="button"
                  onClick={handleInviteFriendsClick}
                  className="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/76 transition hover:bg-white/[0.08] hover:text-white"
                >
                  Invite Friends
                </button>
              </div>

              {isFirstTimeUser && !activationState.hasDismissedLearnMore ? (
                <div className="mt-5 rounded-2xl border border-amber-300/25 bg-amber-300/10 p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-amber-100/80">First Game Tip</div>
                      <p className="mt-2 text-sm text-amber-50/90">
                        Quick Play finds the least-friction crib first. You can learn the deeper details after you’re seated.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={handleHowToPlayClick}>
                        Learn Later
                      </Button>
                      <Button size="sm" variant="ghost" onClick={handleDismissLearnMore}>
                        Hide
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-6 grid gap-3 sm:grid-cols-3">
                <div className="landing-stat-card rounded-2xl p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Live Cribs</div>
                  <div className="mt-2 text-3xl rt-page-title text-white">{launchpad.summary.activeTables}</div>
                </div>
                <div className="landing-stat-card rounded-2xl p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Open Seats</div>
                  <div className="mt-2 text-3xl rt-page-title text-white">{launchpad.summary.openSeats}</div>
                </div>
                <div className="landing-stat-card rounded-2xl p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Players Online</div>
                  <div className="mt-2 text-3xl rt-page-title text-white">{launchpad.summary.onlinePlayers}</div>
                </div>
              </div>
            </div>

            <aside className="landing-spotlight rounded-[28px] p-5 md:p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.2em] text-white/55">Quick Play Route</div>
                  <div className="mt-2 text-2xl rt-page-title text-white">
                    {launchpad.quickPlay ? 'Best seat right now' : 'No instant seat right now'}
                  </div>
                </div>
                <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                  Live
                </span>
              </div>

              {launchpad.quickPlay ? (
                <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                  <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Recommended Crib</div>
                  <div className="mt-2 text-2xl rt-page-title text-white">
                    {getTableDisplayName(launchpad.quickPlay.table)}
                  </div>
                  <p className="mt-2 text-sm text-white/70">
                    {quickPlayReasonCopy[launchpad.quickPlay.reason]}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="landing-stat-card rounded-2xl p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">Stake</div>
                      <div className="mt-2 text-lg rt-page-title text-white">
                        {getStakeDisplay(launchpad.quickPlay.table.stake, launchpad.quickPlay.table.mode).amount}
                      </div>
                    </div>
                    <div className="landing-stat-card rounded-2xl p-4">
                      <div className="text-[11px] uppercase tracking-[0.18em] text-white/48">Seats</div>
                      <div className="mt-2 text-lg rt-page-title text-white">
                        {launchpad.quickPlay.table.currentPlayerCount}/{launchpad.quickPlay.table.maxPlayers}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Button onClick={handleQuickPlayClick}>Take Me There</Button>
                    <Button
                      variant="secondary"
                      onClick={() => handleEnterRecommendedTable(launchpad.quickPlay!.table._id, 'home-recommended')}
                    >
                      Enter This Crib
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-black/20 p-5 text-sm text-white/68">
                  We couldn&apos;t find an instant seat. Browse the live room list and jump into the best crib manually.
                </div>
              )}

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
                <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/48">
                  <Clock3 className="h-4 w-4" />
                  Activation Goal
                </div>
                <p className="mt-3 text-sm text-white/68">
                  Shorten the path from app open to live seat. Everything below this hero is secondary to getting you into a game.
                </p>
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <button
            type="button"
            onClick={handleBrowseClick}
            className="rt-panel-strong rounded-[24px] border border-white/10 p-5 text-left transition hover:border-white/20 hover:bg-white/[0.03]"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50">
              <DoorOpen className="h-4 w-4" />
              Secondary Path
            </div>
            <h2 className="mt-3 text-2xl rt-page-title">Browse Cribs</h2>
            <p className="mt-2 text-sm text-white/68">See every live table, stakes, and seat count without burying quick play.</p>
          </button>
          <button
            type="button"
            onClick={handleHowToPlayClick}
            className="rt-panel-strong rounded-[24px] border border-white/10 p-5 text-left transition hover:border-white/20 hover:bg-white/[0.03]"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50">
              <BookOpen className="h-4 w-4" />
              Learn As Needed
            </div>
            <h2 className="mt-3 text-2xl rt-page-title">How to Play</h2>
            <p className="mt-2 text-sm text-white/68">Keep rules and terminology one tap away instead of leading the first screen.</p>
          </button>
          <button
            type="button"
            onClick={handleInviteFriendsClick}
            className="rt-panel-strong rounded-[24px] border border-white/10 p-5 text-left transition hover:border-white/20 hover:bg-white/[0.03]"
          >
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50">
              <Users className="h-4 w-4" />
              Returning Player Option
            </div>
            <h2 className="mt-3 text-2xl rt-page-title">Invite Friends</h2>
            <p className="mt-2 text-sm text-white/68">Private rooms stay available, but they no longer compete with the primary play action.</p>
          </button>
        </section>

        <section className="space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/48">Fastest Seats Right Now</div>
              <h2 className="mt-2 text-3xl rt-page-title">Live cribs worth opening first.</h2>
            </div>
            <Button variant="ghost" onClick={handleBrowseClick}>
              See Full Lobby
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <div className="grid gap-4 xl:grid-cols-3 md:grid-cols-2">
            {launchpad.recommendedTables.map((item, index) => (
              <CribTableCard
                key={item.table._id}
                table={item.table}
                emphasized={index === 0}
                beginnerFriendly={item.beginnerFriendly}
                highlightLabel={index === 0 ? 'Fastest Start' : undefined}
                ctaLabel={index === 0 ? 'Enter Recommended Crib' : undefined}
                onEnter={(table) => handleEnterRecommendedTable(table._id, 'home-recommended-list')}
              />
            ))}
          </div>
        </section>
      </div>
    );
  }

  const featuredTable = overview?.featuredTable ?? null;

  return (
    <div className="space-y-6">
      <section className="landing-hero rt-panel-strong relative overflow-hidden rounded-[32px] border border-white/12 p-6 md:p-8">
        <div className="landing-hero__mesh pointer-events-none absolute inset-0 opacity-90" />
        <div className="relative z-10 grid gap-6 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
          <div className="max-w-3xl">
            <div className="inline-flex items-center rounded-full border border-white/15 bg-black/25 px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/70">
              Play First
            </div>
            <h1 className="mt-5 text-4xl leading-[0.98] rt-page-title sm:text-5xl">
              Pull up and start playing.
            </h1>
            <p className="mt-4 max-w-2xl text-base text-white/76 sm:text-lg">
              ReemTeam should feel like a game client, not a page to read through. Sign in, find a crib fast, and get seated.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button size="lg" onClick={() => navigate('/quick-play')}>
                <Play className="mr-2 h-4 w-4" />
                Pull Up to a Crib
              </Button>
              <Button size="lg" variant="secondary" onClick={() => navigate('/tables')}>
                Browse Cribs
              </Button>
              <Button size="lg" variant="ghost" onClick={handleHowToPlayClick}>
                How to Play
              </Button>
            </div>
          </div>

          <aside className="landing-spotlight rounded-[28px] p-5 md:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-white/55">Live Now</div>
                <div className="mt-2 text-2xl rt-page-title text-white">What’s moving right now</div>
              </div>
              <span className="rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-emerald-200">
                Live
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="landing-stat-card rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Active Tables</div>
                <div className="mt-2 text-3xl rt-page-title text-white">{overview?.tableSummary.activeTables ?? 0}</div>
              </div>
              <div className="landing-stat-card rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">RTC Cribs</div>
                <div className="mt-2 text-3xl rt-page-title text-white">{overview?.tableSummary.rtcTables ?? 0}</div>
              </div>
              <div className="landing-stat-card rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Cash Crown</div>
                <div className="mt-2 text-3xl rt-page-title text-white">{overview?.contestSummary.openContests ?? 0}</div>
              </div>
              <div className="landing-stat-card rounded-2xl p-4">
                <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Featured Stake</div>
                <div className="mt-2 text-2xl rt-page-title text-white">
                  {featuredTable ? getStakeDisplay(featuredTable.stake, featuredTable.mode).amount : formatRTCAmount(1000)}
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="text-[11px] uppercase tracking-[0.18em] text-white/50">Featured Crib</div>
              <div className="mt-2 text-lg rt-page-title text-white">
                {featuredTable ? getTableDisplayName(featuredTable) : 'Reem Team Cash Crib'}
              </div>
              <p className="mt-2 text-sm text-white/68">
                {featuredTable ? getModeDescription(featuredTable.mode) : 'Continuous hands, live pressure, fast entry.'}
              </p>
            </div>
          </aside>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rt-panel-strong rounded-[24px] border border-white/10 p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50">
            <Sparkles className="h-4 w-4" />
            One Tap
          </div>
          <h2 className="mt-3 text-2xl rt-page-title">Quick Play first.</h2>
          <p className="mt-2 text-sm text-white/68">The strongest action is above the fold instead of buried under explainer cards.</p>
        </article>
        <article className="rt-panel-strong rounded-[24px] border border-white/10 p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50">
            <Clock3 className="h-4 w-4" />
            Faster Start
          </div>
          <h2 className="mt-3 text-2xl rt-page-title">Less browsing friction.</h2>
          <p className="mt-2 text-sm text-white/68">Players can still browse tables, but it no longer blocks the first game path.</p>
        </article>
        <article className="rt-panel-strong rounded-[24px] border border-white/10 p-5">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50">
            <BookOpen className="h-4 w-4" />
            Learn Later
          </div>
          <h2 className="mt-3 text-2xl rt-page-title">Read only when needed.</h2>
          <p className="mt-2 text-sm text-white/68">Rules, terminology, wallet, and deeper account surfaces stay accessible without crowding the launch path.</p>
        </article>
      </section>
    </div>
  );
};

export default Home;
