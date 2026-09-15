import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
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
import { Connection, openConnection } from './transport';
import { applyOptimistic, PendingAction } from './optimistic';
import { ClientMessage, LIMITS } from './protocol';

interface Identity {
  userId: string;
  token: string;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
const REACTION_TTL_MS = 3000;
/** Bezpiecznik: akcja bez potwierdzenia (np. starszy serwer) nie wisi w kolejce na zawsze. */
const PENDING_TIMEOUT_MS = 5000;

/**
 * Tożsamość nadaje serwer. Trzymamy ją per pokój, żeby wznowienie połączenia
 * trafiło we właściwy wpis uczestnika, a nie tworzyło nowego.
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
  // Identyfikator pochodzi z serwera, nie z losowania po stronie klienta.
  const [selfId, setSelfId] = useState<string>('');

  const [roomId, setRoomId] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('room') || '';
  });

  const [isJoined, setIsJoined] = useState(false);
  // Stan od serwera oraz własne akcje czekające na potwierdzenie (ack).
  // Wyświetlany pokój to stan serwera z nałożonymi akcjami — patrz optimistic.ts.
  const [serverRoom, setServerRoom] = useState<RoomState | null>(null);
  const [pending, setPending] = useState<PendingAction[]>([]);
  const room = useMemo(
    () =>
      serverRoom && pending.length > 0
        ? pending.reduce((r, p) => applyOptimistic(r, selfId, p.msg), serverRoom)
        : serverRoom,
    [serverRoom, pending, selfId]
  );
  const [isConnected, setIsConnected] = useState(false);
  const [reactions, setReactions] = useState<ReactionEvent[]>([]);

  // Modals state
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const connectionRef = useRef<Connection | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const reactionTimersRef = useRef<Set<number>>(new Set());

  /**
   * Stan połączenia trzymany w refach, nie w domknięciu.
   *
   * Poprzednio ws.onclose domykał się nad wartością isJoined z chwili tworzenia
   * callbacku — zawsze false, bo połączenie powstawało w tym samym cyklu co
   * setIsJoined(true). Automatyczne wznawianie nigdy się nie uruchamiało.
   */
  const isJoinedRef = useRef(false);
  const roomIdRef = useRef(roomId);
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

  /**
   * Wysyła akcję z numerem kolejnym i od razu nakłada ją lokalnie
   * (optimistic.ts). Serwer odsyła numer jako ack — wtedy akcja znika
   * z kolejki, a na ekranie zostaje już stan serwera.
   */
  const seqRef = useRef(0);
  const sendMessage = useCallback((msg: ClientMessage): boolean => {
    const seq = ++seqRef.current;
    if (!connectionRef.current?.send({ ...msg, seq })) return false;
    setPending((prev) => [...prev, { seq, msg }]);
    window.setTimeout(() => setPending((prev) => prev.filter((p) => p.seq !== seq)), PENDING_TIMEOUT_MS);
    return true;
  }, []);

  /** Potwierdzone przez serwer akcje schodzą z kolejki — obowiązuje jego stan. */
  const acknowledge = useCallback((ack: number) => {
    setPending((prev) => prev.filter((p) => p.seq > ack));
  }, []);

  const showReaction = useCallback((reaction: ReactionEvent) => {
    setReactions((prev) => [...prev, reaction]);
    const timer = window.setTimeout(() => {
      reactionTimersRef.current.delete(timer);
      setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
    }, REACTION_TTL_MS);
    reactionTimersRef.current.add(timer);
  }, []);

  // Własne reakcje pokazane od razu przy kliknięciu — ich echo z serwera pomijamy.
  const ownReactionEchoesRef = useRef<{ emoji: string; at: number }[]>([]);
  const reactionTimesRef = useRef<number[]>([]);
  const consumeOwnReactionEcho = useCallback((emoji: string): boolean => {
    const now = Date.now();
    const echoes = ownReactionEchoesRef.current.filter((e) => now - e.at < REACTION_TTL_MS);
    const index = echoes.findIndex((e) => e.emoji === emoji);
    if (index >= 0) echoes.splice(index, 1);
    ownReactionEchoesRef.current = echoes;
    return index >= 0;
  }, []);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimeoutRef.current !== null) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
  }, []);

  // Connect to the realtime server (WebSocket, a gdy sieć go blokuje — long-polling)
  const connect = useCallback(
    (targetRoomId: string) => {
      clearReconnectTimer();

      // Stare połączenie nie może wywołać ponownego łączenia — close() nie woła onClose.
      connectionRef.current?.close();
      // Nowe połączenie nie potwierdzi akcji wysłanych starym — zaczynamy od stanu serwera.
      setPending([]);

      const handleOpen = () => {
        setIsConnected(true);
        attemptRef.current = 0;

        const profile = userProfileRef.current;
        const identity = identityRef.current ?? loadIdentity(targetRoomId);

        connection.send({
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
        });
      };

      const handleMessage = (message: unknown) => {
        try {
          // Ramki serwera nie są otypowane po stronie klienta — tak jak wcześniej wynik JSON.parse.
          const data = message as any;

          switch (data.type) {
            case 'PONG':
              // Potwierdzenie keep-alive — nie niesie stanu.
              break;

            case 'IDENTITY': {
              const identity: Identity = { userId: data.userId, token: data.token };
              identityRef.current = identity;
              saveIdentity(targetRoomId, identity);
              setSelfId(identity.userId);
              break;
            }

            case 'ROOM_STATE':
            case 'STATE_UPDATE':
              setServerRoom(data.room);
              // Stan niesie potwierdzenie naszej akcji — zdejmujemy ją z kolejki
              // w tej samej aktualizacji, więc ekran nie mignie starym stanem.
              if (typeof data.ack === 'number') acknowledge(data.ack);
              break;

            case 'ACK':
              // Akcja obsłużona bez zmiany stanu (np. odrzucona) — jej odbicie znika.
              if (typeof data.ack === 'number') acknowledge(data.ack);
              break;

            case 'TIMER_TICK':
              setServerRoom((prev) => (prev ? { ...prev, timer: data.timer } : null));
              break;

            case 'TIMER_FINISHED':
              setServerRoom((prev) => (prev ? { ...prev, timer: data.timer } : null));
              soundEffects.playTimerBeep();
              break;

            case 'REACTION': {
              const reaction: ReactionEvent = data.reaction;
              // Własną reakcję pokazaliśmy już przy kliknięciu — echo z serwera pomijamy.
              if (reaction.userId === identityRef.current?.userId && consumeOwnReactionEcho(reaction.emoji)) break;
              showReaction(reaction);
              break;
            }

            case 'ERROR':
              console.warn('Serwer odrzucił akcję:', data.code, data.detail ?? '');
              break;
          }
        } catch (e) {
          console.error('Failed to handle server message:', e);
        }
      };

      const handleClose = () => {
        setIsConnected(false);
        if (!isJoinedRef.current) return;

        // Wykładniczy backoff zamiast stałych 2 sekund w nieskończoność.
        const attempt = attemptRef.current++;
        const delay = Math.min(RECONNECT_MAX_MS, RECONNECT_BASE_MS * 2 ** attempt);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connectRef.current(roomIdRef.current || targetRoomId);
        }, delay);
      };

      const connection = openConnection({
        onOpen: handleOpen,
        onMessage: handleMessage,
        onClose: handleClose,
      });
      connectionRef.current = connection;
    },
    [clearReconnectTimer, acknowledge, showReaction, consumeOwnReactionEcho]
  );

  // Najświeższa wersja funkcji dla ponowień wywoływanych z onClose.
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  /**
   * Powrót do karty lub odzyskanie sieci łączy natychmiast, bez czekania na
   * kolejny krok backoffu. Uśpiona karta potrafi wstrzymać timery, więc bez
   * tego użytkownik wracałby do martwego połączenia.
   */
  useEffect(() => {
    const reconnectIfDropped = () => {
      if (!isJoinedRef.current) return;
      if (document.visibilityState !== 'visible' && navigator.onLine === false) return;

      const connection = connectionRef.current;
      const isDown = !connection || connection.state === 'closed';

      if (isDown && roomIdRef.current) {
        attemptRef.current = 0;
        connect(roomIdRef.current);
      }
    };

    document.addEventListener('visibilitychange', reconnectIfDropped);
    window.addEventListener('online', reconnectIfDropped);
    return () => {
      document.removeEventListener('visibilitychange', reconnectIfDropped);
      window.removeEventListener('online', reconnectIfDropped);
    };
  }, [connect]);

  // Cleanup on unmount
  useEffect(() => {
    const reactionTimers = reactionTimersRef.current;
    return () => {
      isJoinedRef.current = false;
      connectionRef.current?.close();
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
    // Refy ustawiamy synchronicznie — onclose czyta je, zanim React przerysuje.
    isJoinedRef.current = true;
    roomIdRef.current = data.roomId;
    attemptRef.current = 0;

    // Update URL query string without reloading
    const newUrl = `${window.location.pathname}?room=${data.roomId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    connect(data.roomId);
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

    connectionRef.current?.close();
    connectionRef.current = null;

    reactionTimersRef.current.forEach((t) => clearTimeout(t));
    reactionTimersRef.current.clear();

    setIsJoined(false);
    setServerRoom(null);
    setPending([]);
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
    // Serwer przyjmuje wyłącznie role samodzielne; 'moderator' nadaje sam.
    sendMessage({ type: 'UPDATE_ROLE', role: newRole === 'observer' ? 'observer' : 'voter' });
  };

  const handleUpdateSettings = (settings: { autoReveal?: boolean; showAverage?: boolean; roomName?: string }) => {
    sendMessage({ type: 'UPDATE_SETTINGS', settings });
  };

  const handleSendReaction = (emoji: string) => {
    // Ten sam limit co na serwerze — reakcja pokazana lokalnie musi też dotrzeć do innych.
    const now = Date.now();
    reactionTimesRef.current = reactionTimesRef.current.filter((t) => now - t < LIMITS.reactionWindowMs);
    if (reactionTimesRef.current.length >= LIMITS.reactionBurst) return;
    if (!sendMessage({ type: 'SEND_REACTION', emoji })) return;
    reactionTimesRef.current.push(now);
    ownReactionEchoesRef.current.push({ emoji, at: now });
    showReaction({
      id: `local-${now}-${Math.random().toString(36).slice(2)}`,
      emoji,
      userId: selfId,
      userName: room?.participants[selfId]?.name ?? '',
      timestamp: now,
    });
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
            <div className="bg-amber-600/90 text-white text-sm font-semibold px-4 py-1.5 text-center shadow">
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
              revealPending={pending.some((p) => p.msg.type === 'REVEAL')}
              savePending={pending.some((p) => p.msg.type === 'COMPLETE_ROUND')}
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
              isRevealed={room.votingState === 'revealed'}
              isChanged={room.votingState === 'revealed' && !!me && me.vote !== me.revealedVote}
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
