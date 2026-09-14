import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Layers,
  Settings,
  Eye,
  Vote,
  Sparkles,
  ChevronDown,
} from 'lucide-react';
import { DeckType, DECK_LABELS, Participant, ParticipantRole, RoomState } from '../types';
import { soundEffects } from '../utils/audio';

interface HeaderProps {
  room: RoomState;
  selfId: string;
  onSendReaction: (emoji: string) => void;
  onUpdateTimer: (action: 'start' | 'pause' | 'reset' | 'set', duration?: number) => void;
  onChangeDeck: (deckType: DeckType) => void;
  onToggleRole: (newRole: ParticipantRole) => void;
  onOpenDrawer: (tab?: 'backlog' | 'history' | 'team') => void;
  onUpdateSettings: (settings: { autoReveal?: boolean; showAverage?: boolean; roomName?: string }) => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  selfId,
  onSendReaction,
  onUpdateTimer,
  onChangeDeck,
  onToggleRole,
  onOpenDrawer,
  onUpdateSettings,
}) => {
  const [copied, setCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(soundEffects.isEnabled());
  const [showDeckMenu, setShowDeckMenu] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [roomNameInput, setRoomNameInput] = useState(room.name);

  const me = room.participants[selfId];
  const isModerator = me?.role === 'moderator';

  const copyInviteLink = () => {
    const url = window.location.origin + window.location.pathname + '?room=' + room.id;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    });
  };

  const toggleSound = () => {
    const state = soundEffects.toggleSound();
    setSoundOn(state);
  };

  const handleNameSave = () => {
    if (roomNameInput.trim() && roomNameInput !== room.name) {
      onUpdateSettings({ roomName: roomNameInput.trim() });
    }
    setEditingName(false);
  };

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const quickReactions = ['👍', '🚀', '🤔', '☕', '💡', '🔥'];

  return (
    <header className="bg-slate-900/90 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-4 py-2.5 text-slate-100">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Branding & Room info */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-md text-sm">
              ♠
            </div>
            <div>
              {editingName ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    value={roomNameInput}
                    onChange={(e) => setRoomNameInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleNameSave()}
                    className="bg-slate-800 text-sm font-semibold text-white px-2 py-0.5 rounded border border-indigo-500 focus:outline-none"
                    autoFocus
                  />
                  <button
                    onClick={handleNameSave}
                    className="text-xs bg-indigo-600 hover:bg-indigo-500 px-2 py-1 rounded text-white font-medium"
                  >
                    Zapisz
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <h1
                    className={`text-sm md:text-base font-bold tracking-tight text-white ${
                      isModerator ? 'cursor-pointer hover:text-indigo-300' : ''
                    }`}
                    onClick={() => isModerator && setEditingName(true)}
                    title={isModerator ? 'Kliknij, aby zmienić nazwę' : undefined}
                  >
                    {room.name}
                  </h1>
                  <span className="text-xs font-mono bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded border border-slate-700">
                    {room.id.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                  {(Object.values(room.participants) as Participant[]).filter((p) => p.isConnected).length} w pokoju
                </span>
                <span>•</span>
                <span className="capitalize text-slate-300">
                  {DECK_LABELS[room.deckType]?.split(' ')[0] || room.deckType}
                </span>
              </div>
            </div>
          </div>

          {/* Copy link button */}
          <button
            onClick={copyInviteLink}
            className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-all ${
              copied
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Kopiuj link do pokoju"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span>{copied ? 'Skopiowano link!' : 'Zaproś zespół'}</span>
          </button>
        </div>

        {/* Center: Synced Timer & Quick Reactions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Countdown Timer */}
          <div className="flex items-center bg-slate-950/70 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 shadow-inner">
            <span
              className={`font-mono text-sm font-semibold tracking-wider mr-2 ${
                room.timer.remaining <= 10 && room.timer.isRunning ? 'text-amber-400 animate-pulse' : 'text-indigo-200'
              }`}
            >
              {formatTimer(room.timer.remaining)}
            </span>

            <div className="flex items-center gap-1">
              {room.timer.isRunning ? (
                <button
                  onClick={() => onUpdateTimer('pause')}
                  className="p-1 hover:bg-slate-800 rounded text-slate-300 hover:text-white"
                  title="Wstrzymaj timer"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => onUpdateTimer('start')}
                  className="p-1 hover:bg-slate-800 rounded text-emerald-400 hover:text-emerald-300"
                  title="Uruchom timer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              )}

              <button
                onClick={() => onUpdateTimer('reset')}
                className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white"
                title="Zresetuj timer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              {/* Quick preset selector */}
              <div className="hidden lg:flex items-center gap-1 ml-1 pl-1 border-l border-slate-800 text-[11px] text-slate-400">
                <button onClick={() => onUpdateTimer('set', 60)} className="hover:text-white px-1">
                  1m
                </button>
                <button onClick={() => onUpdateTimer('set', 90)} className="hover:text-white px-1">
                  1.5m
                </button>
                <button onClick={() => onUpdateTimer('set', 120)} className="hover:text-white px-1">
                  2m
                </button>
              </div>
            </div>
          </div>

          {/* Quick reactions */}
          <div className="hidden md:flex items-center gap-0.5 bg-slate-950/60 p-1 rounded-lg border border-slate-800/80">
            {quickReactions.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSendReaction(emoji)}
                className="w-7 h-7 flex items-center justify-center hover:bg-slate-800 rounded text-sm hover:scale-125 transition-transform"
                title={`Wyślij reakcję ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Actions & User Role Toggle */}
        <div className="flex items-center gap-2">
          {/* Deck selector dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDeckMenu(!showDeckMenu)}
              className="hidden sm:flex items-center gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-md"
            >
              <span>Talia: {room.deckType === 'modified_fibonacci' ? 'Scrum' : room.deckType}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showDeckMenu && (
              <div className="absolute right-0 mt-1.5 w-60 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-1 z-50">
                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-700">
                  Wybierz skalę estymacji
                </div>
                {(Object.keys(DECK_LABELS) as DeckType[]).map((type) => (
                  <button
                    key={type}
                    onClick={() => {
                      onChangeDeck(type);
                      setShowDeckMenu(false);
                    }}
                    className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-slate-700 ${
                      room.deckType === type ? 'text-indigo-300 font-semibold bg-indigo-950/40' : 'text-slate-200'
                    }`}
                  >
                    <span>{DECK_LABELS[type]}</span>
                    {room.deckType === type && <Check className="w-3.5 h-3.5 text-indigo-400" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Toggle Role (Voter vs Observer) */}
          {me && (
            <button
              onClick={() => onToggleRole(me.role === 'observer' ? 'voter' : 'observer')}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md transition-all ${
                me.role === 'observer'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
              }`}
              title={
                me.role === 'observer'
                  ? 'Obserwujesz (kliknij, by głosować)'
                  : 'Głosujesz (kliknij, by przejść w tryb obserwatora)'
              }
            >
              {me.role === 'observer' ? (
                <>
                  <Eye className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Obserwator</span>
                </>
              ) : (
                <>
                  <Vote className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Głosujący</span>
                </>
              )}
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 text-slate-300 hover:text-white"
            title={soundOn ? 'Dźwięki włączone (kliknij, aby wyciszyć)' : 'Dźwięki wyciszone'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Backlog & History Drawer Button */}
          <button
            onClick={() => onOpenDrawer('backlog')}
            className="flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-md shadow transition"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Backlog</span>
            <span className="bg-indigo-800 text-indigo-200 text-[10px] px-1.5 py-0.2 rounded-full">
              {room.stories.length}
            </span>
          </button>

          {/* Room Settings */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-md border border-slate-700 text-slate-400 hover:text-white"
            title="Ustawienia sesji"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Settings Modal */}
      {showSettingsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-md w-full p-5 shadow-2xl text-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-4">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-400" />
                Ustawienia sesji Planning Poker
              </h3>
              <button
                onClick={() => setShowSettingsModal(false)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Auto reveal */}
              <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <div>
                  <div className="font-semibold text-white">Automatyczne odkrywanie kart</div>
                  <div className="text-slate-400 text-[11px]">
                    Odkrywaj karty natychmiast, gdy wszyscy uprawnieni uczestnicy oddadzą głos.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={room.autoReveal}
                  onChange={(e) => onUpdateSettings({ autoReveal: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
                />
              </div>

              {/* Show average */}
              <div className="flex items-center justify-between p-3 bg-slate-950/60 rounded-lg border border-slate-800">
                <div>
                  <div className="font-semibold text-white">Pokazuj średnią arytmetyczną</div>
                  <div className="text-slate-400 text-[11px]">
                    Wyliczaj i wyświetlaj średnią arytmetyczną głosów po odkryciu kart.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={room.showAverage}
                  onChange={(e) => onUpdateSettings({ showAverage: e.target.checked })}
                  className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-800 border-slate-700"
                />
              </div>

              {/* Deck selector inside settings */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Skala estymacji (Deck)</label>
                <select
                  value={room.deckType}
                  onChange={(e) => onChangeDeck(e.target.value as DeckType)}
                  className="w-full bg-slate-800 text-white rounded-lg px-3 py-2 border border-slate-700 focus:outline-none focus:border-indigo-500"
                >
                  {(Object.keys(DECK_LABELS) as DeckType[]).map((type) => (
                    <option key={type} value={type}>
                      {DECK_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowSettingsModal(false)}
                className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg"
              >
                Gotowe
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
