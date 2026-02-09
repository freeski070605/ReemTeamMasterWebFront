import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import client from '../api/client';
import { Table } from '../types/game';
import { Button } from '../components/ui/Button';
import { Loader } from '../components/ui/Loader';
import { Users, DollarSign, Crown } from 'lucide-react';
import { Modal } from '../components/ui/Modal';

const TableSelect: React.FC = () => {
  const [tables, setTables] = useState<Table[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const navigate = useNavigate();

  const handleJoinClick = (table: Table) => {
    setSelectedTable(table);
    setIsModalOpen(true);
  };

  const handleConfirmJoin = () => {
    if (selectedTable) {
      navigate(`/game/${selectedTable._id}`);
    }
  };

  useEffect(() => {
    const fetchTables = async () => {
      try {
        const response = await client.get('/tables');
        // Sort tables by baseStake to ensure consistent order
        const sortedTables = response.data.sort((a: Table, b: Table) => a.stake - b.stake);
        setTables(sortedTables);
      } catch (err) {
        setError('Failed to load tables. Please try again.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTables();
  }, []);

  if (loading) return <div className="flex justify-center items-center h-screen"><Loader /></div>;
  if (error) return <div className="text-red-500 text-center mt-10 text-xl">{error}</div>;
  
  const stakes = Array.from(new Set(tables.map(t => t.stake))).sort((a,b) => a - b);

  return (
    <div className="min-h-screen text-white p-4 sm:p-6 md:p-8">
      <div
        className="fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 10% 10%, rgba(255,199,74,0.18), transparent 60%)," +
            "radial-gradient(900px 500px at 90% 10%, rgba(244,138,24,0.2), transparent 55%)," +
            "linear-gradient(180deg, #0a0b0d 0%, #151414 55%, #0a0b0d 100%)",
        }}
        aria-hidden
      />
      <header className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold text-white">
          Choose Your Arena
        </h1>
        <p className="text-white/60 mt-2 text-lg">Select a table and show your skill.</p>
      </header>
      
      <div className="space-y-12">
        {stakes.map(stake => (
          <div key={stake}>
            <div className="flex items-center mb-4">
              <Crown className="w-6 h-6 text-yellow-400 mr-3" />
              <h2 className="text-2xl font-bold text-gray-200">${stake} Stake Tables</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {tables.filter(table => table.stake === stake).map((table) => (
                <div key={table._id} className="bg-black/50 backdrop-blur-sm border border-white/10 rounded-2xl shadow-lg transition-all duration-300 hover:border-yellow-400/60 hover:shadow-yellow-400/10">
                  <div className="p-6">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold text-white">{table.name || `Table ${table._id.slice(-4)}`}</h3>
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${
                        table.status === 'in-game' 
                          ? 'bg-yellow-500/20 text-yellow-200' 
                          : 'bg-emerald-500/20 text-emerald-300'
                      }`}>
                        {table.status === 'in-game' ? 'In Progress' : 'Waiting'}
                      </span>
                    </div>

                    <div className="flex items-baseline text-yellow-300 mb-5">
                      <DollarSign className="w-6 h-6 mr-2" />
                      <span className="text-3xl font-bold">{table.stake}</span>
                       <span className="text-white/50 ml-2">Stake</span>
                    </div>

                    <div className="flex items-center text-white/60 mb-6">
                      <Users className="w-5 h-5 mr-3" />
                      <span>{table.currentPlayerCount} / {table.maxPlayers} Players</span>
                    </div>

                      <Button
                        className="w-full text-lg font-bold"
                        disabled={table.currentPlayerCount >= table.maxPlayers}
                        variant={table.currentPlayerCount >= table.maxPlayers ? "secondary" : "primary"}
                        onClick={() => handleJoinClick(table)}
                      >
                        {table.currentPlayerCount >= table.maxPlayers ? 'Table Full' : 'Join Table'}
                      </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        {tables.length === 0 && !loading && (
          <div className="text-center text-white/50 mt-16">
            <h2 className="text-2xl font-semibold mb-2">No Tables Available</h2>
            <p>Please check back in a moment.</p>
          </div>
        )}
      </div>

      {selectedTable && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onConfirm={handleConfirmJoin}
          title={`Join ${selectedTable.name}?`}
        >
          <p>Are you sure you want to join this table with a stake of ${selectedTable.stake}?</p>
        </Modal>
      )}
    </div>
  );
};

export default TableSelect;
