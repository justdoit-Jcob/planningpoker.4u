import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DECK_PRESETS,
  DeckType,
  ParticipantRole,
  ReactionEvent,
  RoomState,
  SelfAssignableRole,
} from './types';
import { Header } from './components/Header';
import { TopicBar } from './components/TopicBar';
import { PokerTable } from './components/PokerTable';
import { CardDeck } from './components/CardDeck';
import { LobbyModal } from './components/LobbyModal';
import { HistoryModal } from './components/HistoryModal';
import { ParticipantsModal } from './components/ParticipantsModal';
import { SettingsModal } from './components/SettingsModal';
import { ReactionsOverlay } from './components/ReactionsOverlay';
import { soundEffects } from './utils/audio';

interface Identity {
  userId: string;
  token: string;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const REACTION_TTL_MS = 3000;

/**
 * Tożsamość nadaje serwer (P0-4). Trzymamy ją per pokój, żeby wznowienie
 * połączenia trafiło we właściwy wpis uczestnika, a nie tworzyło nowego.
 */
function identityStorageKey(roomId: string): string {
  return `poker_identity_${roomId}`;
}

function loadIdentity(roomId: string): Identity | null {
  try {
    const raw = sessionStorage.getItem(identityStorageKey(roomId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (typeof parsed.userId === 'string' && typeof parsed.token === 'string') {
      return { userId: parsed.userId, token: parsed.token };
    }
  } catch {
    // Brak dostępu do sessionStorage lub uszkodzony wpis — startujemy na czysto.
  }
  return null;
}

function saveIdentity(roomId: string, identity: Identity): void {
  try {
    sessionStorage.setItem(identityStorageKey(roomId), JSON.stringify(identity));
  } catch {
    // Brak trwałości tożsamości jest do przeżycia — po odświeżeniu wejdziemy jako nowy uczestnik.
  }
}

export default function App() {
  // Identyfikator pochodzi teraz z serwera, nie z losowania po stronie klienta.
  const [selfId, setSelfId] = useState<string>('');

  const [roomId, setRoomId] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room') || '';
  });

  const [isJoined, setIsJoined] = useState(false);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);

  // Modals state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reactionTimersRef = useRef<Set<number>>(new Set());

  /**
   * Stan połączenia trzymany w refach, nie w domknięciu.
   *
   * Poprzednio ws.onclose domykał się nad wartością isJoined z chwili tworzenia
   * callbacku — zawsze false, bo połączenie powstawało w tym samym cyklu co
   * setIsJoined(true). Automatyczne wznawianie nigdy się nie uruchamiało (P1-1).
   */
  const isJoinedRef = useRef(false);
  const attemptRef = useRef(0);
  const identityRef = useRef<Identity | null>(null);
  const connectRef = useRef<(targetRoomId: string) => void>(() => {});

  // User details saved upon joining
  const userProfileRef = useRef<{
    name: string;
    role: SelfAssignableRole;
    avatarColor: string;
    roomName?: string;
  }>({
    name: '',
    role: 'voter',
    avatarColor: '#3B82F6',
  });

  // Send message over WebSocket
  const sendMessage = useCallback((msg: object) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Connect to WebSocket Server
  const connectWebSocket = useCallback(
    (targetRoomId: string) => {
      clearReconnectTimer();

      if (socketRef.current) {
        // Stare połączenie nie może wywołać ponownego łączenia.
        socketRef.current.onclose = null;
        socketRef.current.close();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        attemptRef.current = 0;

        const profile = userProfileRef.current;
        const identity = identityRef.current ?? loadIdentity(targetRoomId);

        ws.send(
          JSON.stringify({
            type: 'JOIN_ROOM',
            roomId: targetRoomId,
            roomName: profile.roomName,
            user: {
              name: profile.name || 'Developer',
              role: profile.role,
              avatarColor: profile.avatarColor,
            },
            // Wznowienie istniejącego wpisu wymaga podpisanego tokenu.
            ...(identity ? { resume: identity } : {}),
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
            case 'IDENTITY': {
              const identity: Identity = { userId: data.userId, token: data.token };
              identityRef.current = identity;
              saveIdentity(targetRoomId, identity);
              setSelfId(identity.userId);
              break;
            }

            case 'ROOM_STATE':
            case 'STATE_UPDATE':
              setRoom(data.room);
              break;

            case 'TIMER_TICK':
              setRoom((prev) => (prev ? { ...prev, timer: data.timer } : null));
              break;

            case 'TIMER_FINISHED':
              setRoom((prev) => (prev ? { ...prev, timer: data.timer } : null));
              soundEffects.playTimerBeep();
              break;

            case 'REACTION': {
              const reaction: ReactionEvent = data.reaction;
              setReactions((prev) => [...prev, reaction]);
              const timer = window.setTimeout(() => {
                reactionTimersRef.current.delete(timer);
                setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
              }, REACTION_TTL_MS);
              reactionTimersRef.current.add(timer);
              break;
            }

            case 'ERROR':
              console.warn('Serwer odrzucił akcję:', data.code, data.detail ?? '');
              break;
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        if (!isJoinedRef.current) return;

        // Wykładniczy backoff zamiast stałych 2 sekund w nieskończoność.
        const attempt = attemptRef.current++;
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectRef.current(targetRoomId);
        }, delay);
      };

      ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
      };
    },
    [clearReconnectTimer]
  );

  // Najświeższa wersja funkcji dla ponowień wywoływanych z onclose.
  useEffect(() => {
    connectRef.current = connectWebSocket;
  }, [connectWebSocket]);

  // Cleanup on unmount
  useEffect(() => {
    const reactionTimers = reactionTimersRef.current;
    return () => {
      isJoinedRef.current = false;
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
      if (reconnectTimeoutRef.current !== null) clearTimeout(reconnectTimeoutRef.current);
      reactionTimers.forEach((t) => clearTimeout(t));
      reactionTimers.clear();
    };
  }, []);

  // Handle joining room from Lobby
  const handleJoinLobby = (data: {
    roomId: string;
    roomName?: string;
    name: string;
    role: SelfAssignableRole;
    avatarColor: string;
  }) => {
    userProfileRef.current = {
      name: data.name,
      role: data.role,
      avatarColor: data.avatarColor,
      roomName: data.roomName,
    };
    identityRef.current = loadIdentity(data.roomId);

    setRoomId(data.roomId);
    setIsJoined(true);
    // Ref ustawiamy synchronicznie — onclose czyta go, zanim React przerysuje.
    isJoinedRef.current = true;
    attemptRef.current = 0;

    // Update URL query string without reloading
    const newUrl = `${window.location.pathname}?room=${data.roomId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    connectWebSocket(data.roomId);
  };

  /**
   * Wyjście z pokoju z powrotem do lobby.
   *
   * To rozłączenie na życzenie, więc musi zdjąć flagę isJoined w refie ZANIM
   * zamknie gniazdo — inaczej onclose potraktowałby je jak awarię sieci
   * i zacząłby wznawiać połączenie w tle.
   *
   * Tożsamość w sessionStorage zostaje nietknięta: powrót do tego samego
   * pokoju wznowi dotychczasowy wpis uczestnika zamiast tworzyć nowy.
   */
  const handleGoHome = useCallback(() => {
    isJoinedRef.current = false;
    attemptRef.current = 0;
    clearReconnectTimer();

    if (socketRef.current) {
      socketRef.current.onclose = null;
      socketRef.current.close();
      socketRef.current = null;
    }

    reactionTimersRef.current.forEach((t) => clearTimeout(t));
    reactionTimersRef.current.clear();

    setIsJoined(false);
    setRoom(null);
    setIsConnected(false);
    setReactions([]);

    // Adres wraca do postaci bez pokoju, żeby odświeżenie nie wrzuciło z powrotem.
    window.history.pushState({ path: window.location.pathname }, '', window.location.pathname);
  }, [clearReconnectTimer]);

  // Voting Actions
  const handleVote = (card: string) => {
    sendMessage({ type: 'VOTE', card });
  };

  const handleReveal = () => {
    sendMessage({ type: 'REVEAL' });
  };

  const handleReset = () => {
    sendMessage({ type: 'RESET_ROUND' });
  };

  const handleCompleteRound = (score: string) => {
    sendMessage({ type: 'COMPLETE_ROUND', score });
  };

  const handleUpdateTopic = (topic: string) => {
    sendMessage({ type: 'UPDATE_TOPIC', topic });
  };

  const handleClearHistory = () => {
    sendMessage({ type: 'CLEAR_HISTORY' });
  };

  const handleUpdateTimer = (action: 'start' | 'pause' | 'reset' | 'set', duration?: number) => {
    sendMessage({ type: 'TIMER_ACTION', action, duration });
  };

  const handleChangeDeck = (deckType: DeckType) => {
    sendMessage({ type: 'CHANGE_DECK', deckType });
  };

  const handleToggleRole = (newRole: ParticipantRole) => {
    // Serwer przyjmuje wyłącznie role samodzielne; 'moderator' nadaje sam (P0-2).
    sendMessage({ type: 'UPDATE_ROLE', role: newRole === 'observer' ? 'observer' : 'voter' });
  };

  const handleUpdateSettings = (settings: { autoReveal?: boolean; showAverage?: boolean; roomName?: string }) => {
    sendMessage({ type: 'UPDATE_SETTINGS', settings });
  };

  const handleSendReaction = (emoji: string) => {
    sendMessage({ type: 'SEND_REACTION', emoji });
  };

  // Participant info
  const myVote = room?.participants[selfId]?.vote ?? null;
  const me = room?.participants[selfId];
  const userRole = me?.role || 'voter';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Floating live reaction particles */}
      <ReactionsOverlay reactions={reactions} />

      {/* Lobby Modal (If not entered yet) */}
      {!isJoined && (
        <LobbyModal initialRoomId={roomId} onJoin={handleJoinLobby} />
      )}

      {/* Main App Content */}
      {isJoined && room && (
        <div className="flex-1 flex flex-col">
          {/* Header with room info, timer, scale selector, online counter */}
          <Header
            room={room}
            selfId={selfId}
            onGoHome={handleGoHome}
            onSendReaction={handleSendReaction}
            onUpdateTimer={handleUpdateTimer}
            onChangeDeck={handleChangeDeck}
            onToggleRole={handleToggleRole}
            onOpenHistory={() => setIsHistoryOpen(true)}
            onOpenParticipants={() => setIsParticipantsOpen(true)}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onUpdateSettings={handleUpdateSettings}
          />

          {/* Connection banner if offline */}
          {!isConnected && (
            <div className="bg-amber-600/90 text-white text-xs font-semibold px-4 py-1.5 text-center shadow">
              Utracono połączenie z serwerem. Ponawianie próby łączenia...
            </div>
          )}

          {/* Simple Estimation Topic Bar */}
          <TopicBar
            topic={room.topic}
            round={room.round}
            onUpdateTopic={handleUpdateTopic}
          />

          {/* Poker Table Oval with Cards and Controls */}
          <main className="flex-1 flex flex-col items-center justify-center p-2 sm:p-4">
            <PokerTable
              room={room}
              selfId={selfId}
              onReveal={handleReveal}
              onReset={handleReset}
              onCompleteRound={handleCompleteRound}
              onInvite={() => {
                const url = window.location.origin + window.location.pathname + '?room=' + room.id;
                navigator.clipboard.writeText(url);
              }}
            />

            {/* Voting Deck Carousel */}
            <CardDeck
              cards={room.customDeck && room.customDeck.length > 0 ? room.customDeck : DECK_PRESETS.fibonacci}
              selectedVote={myVote}
              onVote={handleVote}
              disabled={room.votingState === 'revealed'}
              userRole={userRole}
            />
          </main>

          {/* History Modal */}
          <HistoryModal
            isOpen={isHistoryOpen}
            history={room.history || []}
            onClose={() => setIsHistoryOpen(false)}
            onClearHistory={handleClearHistory}
          />

          {/* Participants Modal */}
          <ParticipantsModal
            isOpen={isParticipantsOpen}
            participants={Object.values(room.participants)}
            selfId={selfId}
            onClose={() => setIsParticipantsOpen(false)}
          />

          {/* Settings Modal */}
          <SettingsModal
            isOpen={isSettingsOpen}
            room={room}
            onClose={() => setIsSettingsOpen(false)}
            onChangeDeck={handleChangeDeck}
            onUpdateSettings={handleUpdateSettings}
          />
        </div>
      )}
    </div>
  );
}
