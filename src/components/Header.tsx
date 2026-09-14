import React, { useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Copy,
  Check,
  Volume2,
  VolumeX,
  Settings,
  Eye,
  Vote,
  ChevronDown,
  History,
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
  onOpenHistory: () => void;
  onOpenParticipants: () => void;
  onOpenSettings: () => void;
  onUpdateSettings: (settings: { autoReveal?: boolean; showAverage?: boolean; roomName?: string }) => void;
}

export const Header: React.FC<HeaderProps> = ({
  room,
  selfId,
  onSendReaction,
  onUpdateTimer,
  onChangeDeck,
  onToggleRole,
  onOpenHistory,
  onOpenParticipants,
  onOpenSettings,
  onUpdateSettings,
}) => {
  const [copied, setCopied] = useState(false);
  const [soundOn, setSoundOn] = useState(soundEffects.isEnabled());
  const [showDeckMenu, setShowDeckMenu] = useState(false);
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

  const quickReactions = ['👍', '🚀', '🤔', '☕', '🔥'];

  const connectedCount = (Object.values(room.participants) as Participant[]).filter(
    (p) => p.isConnected
  ).length;

  return (
    <header className="bg-slate-900/95 backdrop-blur-md border-b border-slate-800 sticky top-0 z-40 px-3 sm:px-4 py-2 sm:py-2.5 text-slate-100">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-2.5 sm:gap-3">
        {/* Top / Left: Branding & Room Info & Share */}
        <div className="w-full md:w-auto flex items-center justify-between md:justify-start gap-2 sm:gap-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center font-bold text-white shadow-md text-sm shrink-0">
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
                    className="bg-slate-800 text-xs sm:text-sm font-semibold text-white px-2 py-0.5 rounded border border-indigo-500 focus:outline-none"
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
                    className={`text-xs sm:text-sm md:text-base font-bold tracking-tight text-white ${
                      isModerator ? 'cursor-pointer hover:text-indigo-300' : ''
                    }`}
                    onClick={() => isModerator && setEditingName(true)}
                    title={isModerator ? 'Kliknij, aby zmienić nazwę' : undefined}
                  >
                    {room.name}
                  </h1>
                  <span className="text-[10px] sm:text-xs font-mono bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded border border-slate-700">
                    {room.id.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-[11px] text-slate-400">
                <button
                  onClick={onOpenParticipants}
                  className="flex items-center gap-1 hover:text-indigo-300 transition"
                  title="Kliknij, aby zobaczyć listę zespołu"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse"></span>
                  <span>{connectedCount} online</span>
                </button>
                <span>•</span>
                <span className="capitalize text-slate-300">
                  {DECK_LABELS[room.deckType]?.split(' ')[0] || room.deckType}
                </span>
              </div>
            </div>
          </div>

          {/* Quick invite button */}
          <button
            onClick={copyInviteLink}
            className={`min-h-[38px] flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all shrink-0 cursor-pointer ${
              copied
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
            }`}
            title="Kopiuj link z zaproszeniem dla zespołu"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
            <span className="hidden xs:inline">{copied ? 'Skopiowano link!' : 'Zaproś'}</span>
          </button>
        </div>

        {/* Center: Synced Timer & Quick Reactions */}
        <div className="w-full md:w-auto flex items-center justify-between md:justify-center gap-2 sm:gap-3">
          {/* Countdown Timer */}
          <div className="flex items-center bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1 text-slate-200 shadow-inner">
            <span
              className={`font-mono text-xs sm:text-sm font-semibold tracking-wider mr-2 ${
                room.timer.remaining <= 10 && room.timer.isRunning ? 'text-amber-400 animate-pulse' : 'text-indigo-200'
              }`}
            >
              {formatTimer(room.timer.remaining)}
            </span>

            <div className="flex items-center gap-1">
              {room.timer.isRunning ? (
                <button
                  onClick={() => onUpdateTimer('pause')}
                  className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1.5 hover:bg-slate-800 rounded text-slate-300 hover:text-white cursor-pointer"
                  title="Wstrzymaj timer"
                >
                  <Pause className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => onUpdateTimer('start')}
                  className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1.5 hover:bg-slate-800 rounded text-emerald-400 hover:text-emerald-300 cursor-pointer"
                  title="Uruchom timer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                </button>
              )}

              <button
                onClick={() => onUpdateTimer('reset')}
                className="min-h-[32px] min-w-[32px] flex items-center justify-center p-1.5 hover:bg-slate-800 rounded text-slate-400 hover:text-white cursor-pointer"
                title="Zresetuj timer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>

              <div className="hidden sm:flex items-center gap-1 ml-1 pl-1 border-l border-slate-800 text-[11px] text-slate-400">
                <button onClick={() => onUpdateTimer('set', 60)} className="hover:text-white px-1 py-0.5">
                  1m
                </button>
                <button onClick={() => onUpdateTimer('set', 90)} className="hover:text-white px-1 py-0.5">
                  1.5m
                </button>
                <button onClick={() => onUpdateTimer('set', 120)} className="hover:text-white px-1 py-0.5">
                  2m
                </button>
              </div>
            </div>
          </div>

          {/* Quick reactions */}
          <div className="flex items-center gap-0.5 bg-slate-950/60 p-1 rounded-xl border border-slate-800/80">
            {quickReactions.map((emoji) => (
              <button
                key={emoji}
                onClick={() => onSendReaction(emoji)}
                className="w-8 h-8 min-h-[32px] min-w-[32px] flex items-center justify-center hover:bg-slate-800 rounded-lg text-sm sm:text-base hover:scale-125 transition-transform active:scale-90 cursor-pointer"
                title={`Wyślij reakcję ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        {/* Right: Controls & History */}
        <div className="w-full md:w-auto flex items-center justify-end gap-1.5 sm:gap-2">
          {/* Deck selector dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowDeckMenu(!showDeckMenu)}
              className="min-h-[38px] flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-2.5 py-1.5 rounded-lg cursor-pointer"
            >
              <span>{room.deckType === 'modified_fibonacci' ? 'Scrum' : room.deckType}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showDeckMenu && (
              <div className="absolute right-0 mt-1.5 w-60 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 z-50">
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
              className={`min-h-[38px] flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg transition-all cursor-pointer ${
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
                  <span className="hidden sm:inline">Widz</span>
                </>
              ) : (
                <>
                  <Vote className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="hidden sm:inline">Głosuję</span>
                </>
              )}
            </button>
          )}

          {/* History modal button */}
          <button
            onClick={onOpenHistory}
            className="min-h-[38px] flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-slate-700 transition cursor-pointer"
            title="Historia zakończonych rund"
          >
            <History className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden sm:inline">Historia</span>
            {room.history.length > 0 && (
              <span className="bg-indigo-900 text-indigo-300 text-[10px] px-1.5 py-0.2 rounded-full font-mono">
                {room.history.length}
              </span>
            )}
          </button>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-300 hover:text-white cursor-pointer"
            title={soundOn ? 'Dźwięki włączone' : 'Dźwięki wyciszone'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
          </button>

          {/* Room Settings */}
          <button
            onClick={onOpenSettings}
            className="min-h-[38px] min-w-[38px] flex items-center justify-center p-2 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 text-slate-400 hover:text-white cursor-pointer"
            title="Ustawienia pokoju"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
