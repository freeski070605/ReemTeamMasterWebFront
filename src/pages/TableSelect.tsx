import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Coins, Crown, DollarSign, Users } from 'lucide-react';
import client from '../api/client';
import { Table } from '../types/game';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { Modal } from '../components/ui/Modal';
import {
  getModeBadge,
  getModeDescription,
  getStakeDisplay,
  getStakeTierHeading,
  getTableDisplayName,
} from '../branding/modeCopy';

const TableSelect: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const navigate = useNavigate();

  const fetchTables = async () => {
    try {
      setLoading(true);
      const response = await client.get<Table[]>('/tables');
      const sortedTables = response.data.sort((a, b) => a.stake - b.stake);
      setTables(sortedTables);
      setError('');
    } catch (err) {
      setError('Could not load crib tables right now. Try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchTables();
  }, []);

  const groupedByStake = useMemo(() => {
    const byStake = new Map<number, Table[]>();
    for (const table of tables) {
      const list = byStake.get(table.stake) ?? [];
      list.push(table);
      byStake.set(table.stake, list);
    }
    return Array.from(byStake.entries()).sort(([a], [b]) => a - b);
  }, [tables]);

  const metrics = useMemo(() => {
    const active = tables.filter((table) => table.status === 'in-game').length;
    const usd = tables.filter((table) => table.mode === 'USD_CONTEST').length;
    const rtc = tables.filter((table) => table.mode !== 'USD_CONTEST').length;
    return { active, usd, rtc };
  }, [tables]);

  const handleJoinClick = (table: Table) => {
    if (table.mode === 'USD_CONTEST') {
      navigate(`/contests?stake=${encodeURIComponent(String(table.stake))}`);
      return;
    }

    setSelectedTable(table);
    setIsModalOpen(true);
  };

  const handleConfirmJoin = () => {
    if (!selectedTable) return;
    navigate(`/game/${selectedTable._id}`);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-12rem)]">
        <Loader />
      </div>
    );
  }

  if (error) {
    return <div className="rt-panel-strong rounded-2xl p-8 text-center text-red-300">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <header className="rt-panel-strong rounded-3xl p-7">
        <div className="text-xs uppercase tracking-[0.2em] text-white/50">Crib Lobby</div>
        <h1 className="mt-2 text-4xl rt-page-title font-semibold">Choose Your Crib</h1>
        <p className="mt-2 text-white/65">
          RTC cribs run instantly. Cash Crown seats open through the contest lane.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button variant="secondary" onClick={() => navigate('/contests')}>
            Open Cash Crowns
          </Button>
          <Button onClick={() => void fetchTables()}>Reload Cribs</Button>
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Live Cribs</div>
          <div className="mt-2 text-3xl rt-page-title">{tables.length}</div>
        </div>
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">Hands Live</div>
          <div className="mt-2 text-3xl rt-page-title">{metrics.active}</div>
        </div>
        <div className="rt-glass rounded-2xl p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-white/50">RTC / Cash</div>
          <div className="mt-2 text-3xl rt-page-title">{metrics.rtc} / {metrics.usd}</div>
        </div>
      </section>

      <section className="space-y-8">
        {groupedByStake.map(([stake, stakeTables]) => (
          <div key={stake}>
            <div className="flex items-center gap-3 mb-4">
              <Crown className="w-5 h-5 text-amber-300" />
              <h2 className="text-2xl rt-page-title">{getStakeTierHeading(stake)}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {stakeTables.map((table) => {
                const isUsdTable = table.mode === 'USD_CONTEST';
                const isDisabled = !isUsdTable && table.currentPlayerCount >= table.maxPlayers;
                const tableName = getTableDisplayName(table);
                const stakeDisplay = getStakeDisplay(table.stake, table.mode);

                return (
                  <article key={table._id} className="rt-panel-strong rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xl rt-page-title">{tableName}</h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          table.status === 'in-game'
                            ? 'bg-amber-500/20 text-amber-100'
                            : 'bg-emerald-500/20 text-emerald-200'
                        }`}
                      >
                        {table.status === 'in-game' ? 'Hand Live' : 'Waiting'}
                      </span>
                    </div>

                    <div className="mt-3 inline-flex rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs text-white/70">
                      {getModeBadge(table.mode)}
                    </div>

                    <div className="mt-4 flex items-baseline text-amber-300">
                      {isUsdTable ? <DollarSign className="w-5 h-5 mr-1" /> : <Coins className="w-5 h-5 mr-1" />}
                      <span className="text-3xl rt-page-title">{stakeDisplay.amount}</span>
                      <span className="ml-2 text-sm text-white/60">{stakeDisplay.unit}</span>
                    </div>

                    <div className="mt-2 text-sm text-white/60">{getModeDescription(table.mode)}</div>

                    <div className="mt-4 flex items-center text-white/65 text-sm">
                      <Users className="w-4 h-4 mr-2" />
                      {table.currentPlayerCount}/{table.maxPlayers} seats
                    </div>

                    {isUsdTable && (
                      <div className="mt-4 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-xs text-amber-100">
                        Cash Crown rooms are contest-locked. Buy in or redeem from the crown lobby.
                      </div>
                    )}

                    <Button
                      className="mt-5 w-full"
                      disabled={isDisabled}
                      variant={isDisabled ? 'secondary' : 'primary'}
                      onClick={() => handleJoinClick(table)}
                    >
                      {isUsdTable
                        ? 'Go to Cash Crowns'
                        : table.currentPlayerCount >= table.maxPlayers
                          ? 'Crib Full'
                          : 'Pull Up'}
                    </Button>
                  </article>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      {tables.length === 0 && !loading && (
        <div className="rt-panel-strong rounded-2xl p-8 text-center text-white/55">
          No cribs are live right now.
        </div>
      )}

      {selectedTable && selectedTable.mode !== 'USD_CONTEST' && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmJoin}
          title={`Pull up to ${getTableDisplayName(selectedTable)}?`}
        >
          <p>Start a crib run at {getStakeTierHeading(selectedTable.stake)}.</p>
        </Modal>
      )}
    </div>
  );
};

export default TableSelect;
