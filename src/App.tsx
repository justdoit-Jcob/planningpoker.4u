import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DeckType,
  ParticipantRole,
  ReactionEvent,
  RoomState,
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

export default function App() {
  const [selfId] = useState<string>(() => {
    let id = sessionStorage.getItem('poker_self_id');
    if (!id) {
      id = 'user-' + Math.random().toString(36).substring(2, 9);
      sessionStorage.setItem('poker_self_id', id);
    }
    return id;
  });

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

  // User details saved upon joining
  const userProfileRef = useRef<{
    name: string;
    role: ParticipantRole;
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

  // Connect to WebSocket Server
  const connectWebSocket = useCallback(
    (targetRoomId: string) => {
      if (socketRef.current) {
        socketRef.current.close();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/ws`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Join room
        const profile = userProfileRef.current;
        ws.send(
          JSON.stringify({
            type: 'JOIN_ROOM',
            roomId: targetRoomId,
            roomName: profile.roomName,
            user: {
              id: selfId,
              name: profile.name || 'Developer',
              role: profile.role,
              avatarColor: profile.avatarColor,
            },
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          switch (data.type) {
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

            case 'REACTION':
              setReactions((prev) => [...prev, data.reaction]);
              setTimeout(() => {
                setReactions((prev) => prev.filter((r) => r.id !== data.reaction.id));
              }, 3000);
              break;
          }
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Reconnect after 2 seconds if joined
        if (isJoined) {
          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (targetRoomId) {
              connectWebSocket(targetRoomId);
            }
          }, 2000);
        }
      };

      ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
      };
    },
    [selfId, isJoined]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  // Handle joining room from Lobby
  const handleJoinLobby = (data: {
    roomId: string;
    roomName?: string;
    name: string;
    role: ParticipantRole;
    avatarColor: string;
  }) => {
    userProfileRef.current = {
      name: data.name,
      role: data.role,
      avatarColor: data.avatarColor,
      roomName: data.roomName,
    };
    setRoomId(data.roomId);
    setIsJoined(true);

    // Update URL query string without reloading
    const newUrl = `${window.location.pathname}?room=${data.roomId}`;
    window.history.pushState({ path: newUrl }, '', newUrl);

    connectWebSocket(data.roomId);
  };

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
    sendMessage({ type: 'UPDATE_ROLE', role: newRole });
  };

  const handleUpdateSettings = (settings: { autoReveal?: boolean; showAverage?: boolean; roomName?: string }) => {
    sendMessage({ type: 'UPDATE_SETTINGS', settings });
  };

  const handleSendReaction = (emoji: string) => {
    sendMessage({ type: 'SEND_REACTION', emoji });
  };

  // Participant info
  const myVote = room?.participants[selfId]?.vote || null;
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
              cards={room.customDeck && room.customDeck.length > 0 ? room.customDeck : ['0', '1', '2', '3', '5', '8', '13', '21', '?', '☕']}
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
