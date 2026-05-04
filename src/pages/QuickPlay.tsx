import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Compass, Sparkles } from 'lucide-react';
import { ANALYTICS_EVENTS } from '../analytics/events';
import { trackEvent, trackEventOncePerSession } from '../api/analytics';
import { getLobbyActivationState, LobbyActivationState } from '../api/lobby';
import { quickSeat } from '../api/tables';
import { CribTableCard } from '../components/activation/CribTableCard';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { experienceFlags } from '../config/experienceFlags';
import { useAuthStore } from '../store/authStore';
import { buildGamePath } from '../utils/gamePath';

const QuickPlay: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [launchpad, setLaunchpad] = useState<LobbyActivationState | null>(null);
  const [status, setStatus] = useState<'routing' | 'fallback' | 'error'>('routing');

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const activationState = await getLobbyActivationState();
        if (cancelled) {
          return;
        }

        setLaunchpad(activationState);
        const isFirstTimeUser =
          experienceFlags.firstTimeUserSimplifiedFlow && !activationState.playerState.hasPlayedGame;

        if (isFirstTimeUser) {
          void trackEventOncePerSession(
            ANALYTICS_EVENTS.firstTimeUserDetected,
            { source: 'quick-play' },
            `first-time-user:${user?._id ?? 'anon'}`
          );
          void trackEventOncePerSession(
            ANALYTICS_EVENTS.firstTimeUserRoutedToQuickPlay,
            { source: 'quick-play' },
            `quick-play-route:${user?._id ?? 'anon'}`
          );
        }

        void trackEvent(ANALYTICS_EVENTS.joinTableAttempt, {
          source: 'quick-play-routing',
          firstTimeUser: isFirstTimeUser,
        });

        const result = await quickSeat({
          beginnerMode: experienceFlags.recommendedTableRouting ? isFirstTimeUser : true,
        });

        if (cancelled) {
          return;
        }

        navigate(
          buildGamePath(result.tableId, {
            entry: 'quick-play',
            quickPlayReason: result.reason,
          }),
          { replace: true }
        );
      } catch (error: any) {
        if (cancelled) {
          return;
        }

        if (error?.response?.status === 404) {
          setStatus('fallback');
          void trackEvent(ANALYTICS_EVENTS.joinTableFail, {
            source: 'quick-play-routing',
            reason: 'no_open_seat',
          });
          return;
        }

        setStatus('error');
        void trackEvent(ANALYTICS_EVENTS.joinTableFail, {
          source: 'quick-play-routing',
          reason: error?.response?.data?.message || 'routing_error',
        });
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [navigate, user?._id]);

  const handleFallbackEnter = (tableId: string) => {
    void trackEvent(ANALYTICS_EVENTS.tableCardClick, {
      source: 'quick-play-fallback',
      tableId,
    });
    void trackEvent(ANALYTICS_EVENTS.joinTableAttempt, {
      source: 'quick-play-fallback',
      tableId,
    });
    navigate(buildGamePath(tableId, { entry: 'quick-play-fallback' }));
  };

  if (status === 'routing') {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <section className="landing-spotlight w-full max-w-xl rounded-[32px] p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-amber-300/30 bg-amber-300/12">
            <Sparkles className="h-6 w-6 text-amber-100" />
          </div>
          <h1 className="mt-5 text-4xl rt-page-title">Finding your crib…</h1>
          <p className="mt-3 text-white/68">
            {launchpad?.playerState.hasPlayedGame
              ? 'Looking for the fastest live seat.'
              : 'Looking for the easiest seat to start your first game.'}
          </p>
          <div className="mt-6 flex justify-center">
            <Loader />
          </div>
        </section>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="mx-auto max-w-2xl">
        <section className="rt-panel-strong rounded-[28px] p-8 text-center">
          <h1 className="text-3xl rt-page-title">Quick Play hit a snag.</h1>
          <p className="mt-3 text-white/68">
            No instant crib opened. Browse the live room list and pick a seat.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => navigate('/tables')}>Browse Cribs</Button>
            <Button variant="secondary" onClick={() => navigate('/')}>Back Home</Button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rt-panel-strong rounded-[32px] p-6 md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-white/50">
              <Compass className="h-4 w-4" />
              Quick Play
            </div>
            <h1 className="mt-3 text-3xl rt-page-title">Pick from live cribs.</h1>
            <p className="mt-2 max-w-2xl text-sm text-white/68">
              These tables have open seats and active momentum.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/tables?focus=recommended')}>Browse Cribs</Button>
            <Button variant="secondary" onClick={() => navigate('/')}>Back Home</Button>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-3 md:grid-cols-2">
        {launchpad?.recommendedTables.map((item, index) => (
          <CribTableCard
            key={item.table._id}
            table={item.table}
            emphasized={index === 0}
            beginnerFriendly={item.beginnerFriendly}
            highlightLabel={index === 0 ? 'Recommended' : undefined}
            onEnter={(table) => handleFallbackEnter(table._id)}
          />
        ))}
      </section>
    </div>
  );
};

export default QuickPlay;
