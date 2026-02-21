import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import client from '../api/client';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { useAuthStore } from '../store/authStore';
import { Contest, Table, TournamentTicket } from '../types/game';
import {
  getContestDisplayName,
  getContestStatusLabel,
} from '../branding/modeCopy';

const ContestLobby: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();

  const stakeParam = Number(searchParams.get('stake'));
  const initialStakeFilter = Number.isFinite(stakeParam) && stakeParam > 0 ? stakeParam : 'all';

  const [contests, setContests] = useState<Contest[]>([]);
  const [tickets, setTickets] = useState<TournamentTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joiningContestId, setJoiningContestId] = useState<string | null>(null);
  const [stakeFilter, setStakeFilter] = useState<number | 'all'>(initialStakeFilter);
  const [selectedTicketByContest, setSelectedTicketByContest] = useState<Record<string, string>>({});
  const currentUserId = user?._id ?? null;

  const getParticipantCount = (contest: Contest): number => {
    return Array.isArray(contest.participants) ? contest.participants.length : 0;
  };

  const isContestFull = (contest: Contest): boolean => {
    return getParticipantCount(contest) >= contest.playerCount;
  };

  const isUserJoined = (contest: Contest): boolean => {
    if (!currentUserId) {
      return false;
    }
    return (contest.participants ?? []).some((participantId) => participantId === currentUserId);
  };

  const availableTickets = useMemo(() => {
    const now = Date.now();
    return tickets
      .filter((ticket) => !ticket.used && ticket.targetMode === 'USD_CONTEST')
      .filter((ticket) => new Date(ticket.expiresAt).getTime() > now)
      .sort((a, b) => new Date(a.expiresAt).getTime() - new Date(b.expiresAt).getTime());
  }, [tickets]);

  const filteredContests = useMemo(() => {
    return contests
      .filter((contest) => contest.mode === 'USD_CONTEST')
      .filter((contest) => {
        const joined = currentUserId
          ? (contest.participants ?? []).some((participantId) => participantId === currentUserId)
          : false;
        if (joined) {
          return contest.status === 'open' || contest.status === 'locked' || contest.status === 'in-progress';
        }
        return contest.status === 'open';
      })
      .filter((contest) => (stakeFilter === 'all' ? true : contest.entryFee === stakeFilter))
      .sort((a, b) => {
        if (a.entryFee !== b.entryFee) return a.entryFee - b.entryFee;
        return getParticipantCount(b) - getParticipantCount(a);
      });
  }, [contests, stakeFilter, currentUserId]);

  const stakeOptions = useMemo(() => {
    return Array.from(new Set(contests.map((contest) => contest.entryFee))).sort((a, b) => a - b);
  }, [contests]);

  const getPreferredTicketId = (contestId: string): string => {
    const selected = selectedTicketByContest[contestId];
    if (selected) {
      return selected;
    }
    return availableTickets[0]?._id ?? '';
  };

  const fetchLobbyData = async () => {
    try {
      setLoading(true);
      setError('');

      const [contestResponse, ticketResponse] = await Promise.all([
        client.get<Contest[]>('/contests'),
        client.get<TournamentTicket[]>('/tickets/my'),
      ]);

      const contestData = Array.isArray(contestResponse.data) ? contestResponse.data : [];
      setContests(contestData.filter((contest) => contest.mode === 'USD_CONTEST'));
      setTickets(Array.isArray(ticketResponse.data) ? ticketResponse.data : []);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not load cash crown contests.');
      setContests([]);
      setTickets([]);
    } finally {
      setLoading(false);
    }
  };

  const resolveTableForContest = async (contest: Contest): Promise<string> => {
    const tableResponse = await client.get<Table[]>('/tables');
    const allTables = Array.isArray(tableResponse.data) ? tableResponse.data : [];

    const candidates = allTables
      .filter((table) => table.mode === 'USD_CONTEST')
      .filter((table) => table.stake === contest.entryFee)
      .filter((table) => table.currentPlayerCount < table.maxPlayers)
      .filter((table) => !table.activeContestId || table.activeContestId === contest.contestId)
      .sort((a, b) => {
        const aBound = a.activeContestId === contest.contestId ? 1 : 0;
        const bBound = b.activeContestId === contest.contestId ? 1 : 0;
        if (aBound !== bBound) return bBound - aBound;
        if (a.status !== b.status) return a.status === 'waiting' ? -1 : 1;
        return b.currentPlayerCount - a.currentPlayerCount;
      });

    if (candidates.length === 0) {
      throw new Error('No joinable cash crown table is open for this tier right now.');
    }

    return candidates[0]._id;
  };

  const handleContestJoin = async (contest: Contest, joinMethod: 'usd' | 'ticket') => {
    if (!user?._id) {
      toast.error('Sign in to join cash crowns.');
      return;
    }

    try {
      setJoiningContestId(contest.contestId);
      let activeContest = contest;
      const alreadyJoined = isUserJoined(contest);

      if (!alreadyJoined) {
        if (isContestFull(contest)) {
          throw new Error('This cash crown is already full.');
        }

        if (joinMethod === 'ticket') {
          const ticketId = getPreferredTicketId(contest.contestId);
          if (!ticketId) {
            throw new Error('No eligible ticket is available for this cash crown.');
          }

          const response = await client.post(`/contests/${contest.contestId}/join`, {
            joinMethod: 'ticket',
            ticketId,
          });

          activeContest = response.data?.contest ?? activeContest;
          setTickets((prev) => prev.filter((ticket) => ticket._id !== ticketId));
        } else {
          const response = await client.post(`/contests/${contest.contestId}/join`, {
            joinMethod: 'usd',
          });
          activeContest = response.data?.contest ?? activeContest;
        }

        setContests((prev) =>
          prev.map((current) =>
            current.contestId === activeContest.contestId ? activeContest : current
          )
        );
      }

      const tableId = await resolveTableForContest(activeContest);
      navigate(`/game/${tableId}?contestId=${encodeURIComponent(activeContest.contestId)}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Could not join this cash crown.');
    } finally {
      setJoiningContestId(null);
    }
  };

  const getStatusClasses = (status: Contest['status']): string => {
    if (status === 'open') {
      return 'bg-emerald-500/20 text-emerald-200';
    }
    if (status === 'locked') {
      return 'bg-amber-500/20 text-amber-100';
    }
    if (status === 'in-progress') {
      return 'bg-sky-500/20 text-sky-100';
    }
    return 'bg-white/10 text-white/70';
  };

  useEffect(() => {
    void fetchLobbyData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-12rem)]">
        <Loader />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rt-panel-strong rounded-2xl p-8 text-center text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rt-panel-strong rounded-3xl p-7">
        <div className="text-xs uppercase tracking-[0.2em] text-white/50">Cash Crown Lobby</div>
        <h1 className="mt-2 text-4xl rt-page-title font-semibold">Lock Into Cash Crown Contests</h1>
        <p className="mt-2 text-white/65">
          Buy in with USD or redeem a satellite ticket. Payouts settle after placements return.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Open / Joined</div>
          <div className="mt-2 text-3xl rt-page-title">{filteredContests.length}</div>
        </div>
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Redeemable Tickets</div>
          <div className="mt-2 text-3xl rt-page-title">{availableTickets.length}</div>
        </div>
        <div className="rt-glass rounded-2xl p-4 flex flex-col justify-between">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Sync</div>
          <Button size="sm" variant="secondary" onClick={() => void fetchLobbyData()}>
            Refresh Crowns
          </Button>
        </div>
      </section>

      <section className="rt-panel-strong rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={stakeFilter === 'all' ? 'primary' : 'secondary'}
            onClick={() => setStakeFilter('all')}
          >
            All Buy-Ins
          </Button>
          {stakeOptions.map((stake) => (
            <Button
              key={stake}
              size="sm"
              variant={stakeFilter === stake ? 'primary' : 'secondary'}
              onClick={() => setStakeFilter(stake)}
            >
              ${stake} Crown
            </Button>
          ))}
        </div>
      </section>

      {filteredContests.length === 0 ? (
        <div className="rt-panel-strong rounded-2xl p-8 text-center text-white/70">
          No cash crowns match the current filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredContests.map((contest) => {
            const participantCount = getParticipantCount(contest);
            const contestFull = isContestFull(contest);
            const joined = isUserJoined(contest);
            const joining = joiningContestId === contest.contestId;
            const preferredTicketId = getPreferredTicketId(contest.contestId);

            return (
              <article key={contest.contestId} className="rt-panel-strong rounded-2xl p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-white/50">Crown ID</div>
                    <h2 className="mt-1 text-xl rt-page-title">{getContestDisplayName(contest.contestId)}</h2>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getStatusClasses(contest.status)}`}>
                    {getContestStatusLabel(contest.status)}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm mb-5">
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-white/50 text-xs uppercase tracking-[0.14em]">Buy-In</div>
                    <div className="mt-1 text-white rt-page-title text-lg">${contest.entryFee}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                    <div className="text-white/50 text-xs uppercase tracking-[0.14em]">Locked Pool</div>
                    <div className="mt-1 text-white rt-page-title text-lg">${contest.prizePool}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-white/5 p-3 col-span-2">
                    <div className="text-white/50 text-xs uppercase tracking-[0.14em]">Seats</div>
                    <div className="mt-1 text-white rt-page-title text-lg">
                      {participantCount}/{contest.playerCount}
                    </div>
                    {joined && (
                      <div className="mt-2 text-xs text-emerald-300">You are locked into this crown.</div>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <Button
                    className="w-full"
                    disabled={joining || (!joined && contestFull)}
                    onClick={() => void handleContestJoin(contest, 'usd')}
                  >
                    {joined ? 'Enter Crown Table' : contestFull ? 'Crown Full' : 'Buy In with USD'}
                  </Button>

                  {!joined && (
                    <>
                      <select
                        className="w-full rounded-xl border border-white/15 bg-black/35 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-300"
                        value={preferredTicketId}
                        onChange={(event) => {
                          const nextTicketId = event.target.value;
                          setSelectedTicketByContest((prev) => ({
                            ...prev,
                            [contest.contestId]: nextTicketId,
                          }));
                        }}
                        disabled={joining || availableTickets.length === 0}
                      >
                        <option value="">
                          {availableTickets.length === 0 ? 'No eligible tickets' : 'Pick a ticket to redeem'}
                        </option>
                        {availableTickets.map((ticket) => (
                          <option key={ticket._id} value={ticket._id}>
                            {`${ticket._id.slice(-6)} | expires ${new Date(ticket.expiresAt).toLocaleDateString()}`}
                          </option>
                        ))}
                      </select>

                      <Button
                        className="w-full"
                        variant="secondary"
                        disabled={joining || contestFull || !preferredTicketId}
                        onClick={() => void handleContestJoin(contest, 'ticket')}
                      >
                        Redeem Ticket
                      </Button>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ContestLobby;
