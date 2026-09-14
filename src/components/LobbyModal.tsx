import React, { useState, useEffect } from 'react';
import { Vote, Eye, ArrowRight } from 'lucide-react';
import { AVATAR_COLORS, SelfAssignableRole } from '../types';

interface LobbyModalProps {
  initialRoomId: string;
  onJoin: (data: {
    roomId: string;
    roomName?: string;
    name: string;
    role: SelfAssignableRole;
    avatarColor: string;
  }) => void;
}

export const LobbyModal: React.FC<LobbyModalProps> = ({ initialRoomId, onJoin }) => {
  const [name, setName] = useState(() => localStorage.getItem('poker_username') || '');
  const [roomId, setRoomId] = useState(() => initialRoomId || 'SPRINT-42');
  const [roomName, setRoomName] = useState('Planowanie Sprintu #42');
  const [role, setRole] = useState<SelfAssignableRole>('voter');
  const [avatarColor, setAvatarColor] = useState(
    () => localStorage.getItem('poker_avatar') || AVATAR_COLORS[0]
  );
  const [isCreatingNew, setIsCreatingNew] = useState(!initialRoomId);

  useEffect(() => {
    if (initialRoomId) {
      setRoomId(initialRoomId.toUpperCase());
      setIsCreatingNew(false);
    }
  }, [initialRoomId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    localStorage.setItem('poker_username', name.trim());
    localStorage.setItem('poker_avatar', avatarColor);

    const targetRoomId = (roomId.trim() || 'SPRINT-42').toUpperCase();

    onJoin({
      roomId: targetRoomId,
      roomName: isCreatingNew ? roomName.trim() : undefined,
      name: name.trim(),
      role,
      avatarColor,
    });
  };

  const generateNewRoomId = () => {
    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    setRoomId(`ROOM-${code}`);
    setRoomName(`Planning Sprint #${code}`);
    setIsCreatingNew(true);
  };

  return (
    <div className="fixed inset-0 bg-slate-950 flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl text-slate-200 my-8">
        {/* Logo and Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-indigo-500 items-center justify-center font-bold text-white shadow-xl shadow-indigo-500/20 text-xl mb-3">
            ♠
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            Planning Poker Live
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Zwinne szacowanie w czasie rzeczywistym dla zdalnych zespołów IT
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Room Choice Tabs */}
          <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => {
                setIsCreatingNew(false);
                if (!roomId) setRoomId('SPRINT-42');
              }}
              className={`flex-1 py-2 rounded-lg font-semibold transition cursor-pointer ${
                !isCreatingNew ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dołącz do pokoju
            </button>
            <button
              type="button"
              onClick={() => {
                generateNewRoomId();
              }}
              className={`flex-1 py-2 rounded-lg font-semibold transition cursor-pointer ${
                isCreatingNew ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              Stwórz nowy pokój
            </button>
          </div>

          {/* Room ID or Name */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              {isCreatingNew ? 'Nazwa sesji / sprintu' : 'ID pokoju'}
            </label>
            {isCreatingNew ? (
              <input
                type="text"
                value={roomName}
                onChange={(e) => setRoomName(e.target.value)}
                placeholder="np. Sprint Planning #42"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            ) : (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="np. SPRINT-42 lub DEMO"
                  required
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 font-mono text-sm text-white uppercase focus:outline-none focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          {/* User Display Name */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Nazwa użytkownika
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Imię, inicjały lub pseudonim"
              required
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
              autoFocus
            />
          </div>

          {/* Avatar Color Picker */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Kolor Twojego avatara</label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setAvatarColor(c)}
                  className={`w-7 h-7 rounded-full transition transform cursor-pointer ${
                    avatarColor === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900 scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Role Choice */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Twoja rola na spotkaniu</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRole('voter')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                  role === 'voter'
                    ? 'bg-indigo-950/60 border-indigo-500 text-white'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-white mb-1">
                  <Vote className="w-4 h-4 text-indigo-400" />
                  <span>Głosujący</span>
                </div>
                <p className="text-[11px] text-slate-400">Developer, QA, Inżynier biorący udział w estymacji</p>
              </button>

              <button
                type="button"
                onClick={() => setRole('observer')}
                className={`p-3 rounded-xl border text-left flex flex-col justify-between transition cursor-pointer ${
                  role === 'observer'
                    ? 'bg-amber-950/60 border-amber-500 text-white'
                    : 'bg-slate-950/40 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-semibold text-white mb-1">
                  <Eye className="w-4 h-4 text-amber-400" />
                  <span>Obserwator</span>
                </div>
                <p className="text-[11px] text-slate-400">Product Owner, Scrum Master, Gość (nie głosuje)</p>
              </button>
            </div>
          </div>

          {/* Submit button */}
          <button
            type="submit"
            disabled={!name.trim()}
            className="w-full mt-4 py-3 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 hover:from-indigo-500 hover:to-blue-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 cursor-pointer transition transform active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span>Wejdź do pokoju estymacji</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center text-[11px] text-slate-500">
          Wspiera skale: Fibonacci, Scrum Standard, T-Shirt, Potęgi 2 oraz Sekwencyjną.
        </div>
      </div>
    </div>
  );
};
