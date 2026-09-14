import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DeckType,
  ParticipantRole,
  ReactionEvent,
  RoomState,
  Story,
} from './types';
import { Header } from './components/Header';
import { StoryBanner } from './components/StoryBanner';
import { PokerTable } from './components/PokerTable';
import { CardDeck } from './components/CardDeck';
import { BacklogDrawer } from './components/BacklogDrawer';
import { AiAssistantModal } from './components/AiAssistantModal';
import { LobbyModal } from './components/LobbyModal';
import { ReactionsOverlay } from './components/ReactionsOverlay';
import { soundEffects } from './utils/audio';

export default function App() {
  const [selfId, setSelfId] = useState<string>(() => {
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

  // Modals & Drawers state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'backlog' | 'history' | 'team'>('backlog');
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);

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

  // Connect WebSocket
  const connectSocket = useCallback(
    (targetRoomId: string) => {
      if (socketRef.current) {
        socketRef.current.close();
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}`;

      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
        // Send JOIN_ROOM immediately on connect
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
            case 'INIT_STATE':
            case 'STATE_UPDATE': {
              setRoom(data.room);
              break;
            }

            case 'PARTICIPANT_JOINED':
            case 'PARTICIPANT_LEFT': {
              if (data.room) setRoom(data.room);
              break;
            }

            case 'PARTICIPANT_VOTED': {
              setRoom((prev) => {
                if (!prev) return prev;
                const updated = { ...prev };
                const p = updated.participants[data.userId];
                if (p) {
                  p.vote = data.hasVoted ? (p.vote || '?') : null;
                }
                return updated;
              });
              break;
            }

            case 'PARTICIPANT_KICKED': {
              if (data.targetUserId === selfId) {
                alert('Zostałeś usunięty z tego pokoju przez moderatora.');
                setIsJoined(false);
                setRoom(null);
              } else if (data.room) {
                setRoom(data.room);
              }
              break;
            }

            case 'TIMER_TICK': {
              setRoom((prev) => {
                if (!prev) return prev;
                return {
                  ...prev,
                  timer: {
                    ...prev.timer,
                    remaining: data.remaining,
                  },
                };
              });
              break;
            }

            case 'TIMER_EXPIRED': {
              soundEffects.playTimerBeep();
              if (data.room) setRoom(data.room);
              break;
            }

            case 'REACTION': {
              setReactions((prev) => [...prev, data.reaction]);
              setTimeout(() => {
                setReactions((prev) => prev.filter((r) => r.id !== data.reaction.id));
              }, 3400);
              break;
            }
          }
        } catch (err) {
          console.error('Failed to parse incoming socket message:', err);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Automatic reconnection attempt
        if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = window.setTimeout(() => {
          if (isJoined) {
            connectSocket(targetRoomId);
          }
        }, 3000);
      };

      ws.onerror = (err) => {
        console.error('WebSocket encountered an error:', err);
      };
    },
    [selfId, isJoined]
  );

  // Clean up socket on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) socketRef.current.close();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

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

    connectSocket(data.roomId);
  };

  // Actions
  const handleSelectCard = (card: string | null) => {
    sendMessage({ type: 'VOTE', vote: card });
    // Optimistically update local participant vote
    setRoom((prev) => {
      if (!prev) return prev;
      const me = prev.participants[selfId];
      if (me) me.vote = card;
      return { ...prev };
    });
  };

  const handleRevealVotes = () => {
    sendMessage({ type: 'REVEAL_VOTES' });
  };

  const handleResetVoting = (nextStoryId?: string) => {
    sendMessage({ type: 'RESET_VOTING', nextStoryId });
  };

  const handleSetFinalScore = (storyId: string, score: string, advance: boolean) => {
    sendMessage({
      type: 'SET_FINAL_SCORE',
      storyId,
      finalScore: score,
      advanceToNext: advance,
    });
  };

  const handleChangeDeck = (deckType: DeckType) => {
    sendMessage({ type: 'SET_DECK', deckType });
  };

  const handleUpdateTimer = (action: 'start' | 'pause' | 'reset' | 'set', duration?: number) => {
    sendMessage({ type: 'UPDATE_TIMER', action, duration });
  };

  const handleSendReaction = (emoji: string) => {
    sendMessage({ type: 'SEND_REACTION', emoji });
  };

  const handleToggleRole = (newRole: ParticipantRole) => {
    sendMessage({ type: 'UPDATE_ROLE', targetUserId: selfId, role: newRole });
  };

  const handleUpdateStory = (story: Partial<Story> & { id: string }) => {
    sendMessage({ type: 'UPDATE_STORY', story });
  };

  const handleAddStory = (story: Partial<Story>) => {
    sendMessage({ type: 'ADD_STORY', story });
  };

  const handleDeleteStory = (storyId: string) => {
    sendMessage({ type: 'DELETE_STORY', storyId });
  };

  const handleSelectStory = (storyId: string) => {
    sendMessage({ type: 'SELECT_STORY', storyId });
  };

  const handleUpdateParticipantRole = (targetUserId: string, role: ParticipantRole) => {
    sendMessage({ type: 'UPDATE_ROLE', targetUserId, role });
  };

  const handleKickParticipant = (targetUserId: string) => {
    sendMessage({ type: 'KICK_PARTICIPANT', targetUserId });
  };

  const handleUpdateSettings = (settings: {
    autoReveal?: boolean;
    showAverage?: boolean;
    roomName?: string;
  }) => {
    sendMessage({ type: 'UPDATE_SETTINGS', ...settings });
  };

  const currentStory = room ? room.stories.find((s) => s.id === room.currentStoryId) || null : null;
  const me = room ? room.participants[selfId] : null;
  const isModerator = me?.role === 'moderator';

  // Find next queued story if available
  const hasNextStory = room
    ? room.stories.some((s) => s.status === 'queued' && s.id !== room.currentStoryId)
    : false;
  const nextStory = room ? room.stories.find((s) => s.status === 'queued') : null;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-indigo-500 selection:text-white font-sans antialiased">
      {/* Floating live team reactions */}
      <ReactionsOverlay reactions={reactions} />

      {/* Lobby Entry Modal if not joined */}
      {!isJoined && (
        <LobbyModal initialRoomId={roomId} onJoin={handleJoinLobby} />
      )}

      {/* Main App Experience */}
      {isJoined && room && (
        <>
          {/* Top Bar Header */}
          <Header
            room={room}
            selfId={selfId}
            onSendReaction={handleSendReaction}
            onUpdateTimer={handleUpdateTimer}
            onChangeDeck={handleChangeDeck}
            onToggleRole={handleToggleRole}
            onOpenDrawer={(tab) => {
              if (tab) setDrawerTab(tab);
              setIsDrawerOpen(true);
            }}
            onUpdateSettings={handleUpdateSettings}
          />

          {/* Connection status banner if reconnecting */}
          {!isConnected && (
            <div className="bg-amber-500/20 border-b border-amber-500/30 text-amber-300 text-xs px-4 py-1.5 text-center font-medium">
              Łączenie z serwerem pokoju w czasie rzeczywistym...
            </div>
          )}

          {/* Main Content Area */}
          <main className="flex-1 flex flex-col justify-between max-w-7xl w-full mx-auto px-4 py-2">
            {/* Active Story Details */}
            <StoryBanner
              story={currentStory}
              isModerator={isModerator}
              onOpenAiAssistant={() => setIsAiModalOpen(true)}
              onUpdateStory={handleUpdateStory}
              onNextStory={() => nextStory && handleSelectStory(nextStory.id)}
              hasNextStory={hasNextStory}
            />

            {/* Collaborative Poker Table */}
            <PokerTable
              room={room}
              selfId={selfId}
              onRevealVotes={handleRevealVotes}
              onResetVoting={handleResetVoting}
              onSetFinalScore={handleSetFinalScore}
              onSelectStory={handleSelectStory}
            />

            {/* Bottom Card Deck Hand */}
            <CardDeck
              cards={room.customDeck}
              selectedCard={me?.vote ?? null}
              role={me?.role || 'voter'}
              isRevealed={room.votingState === 'revealed'}
              onSelectCard={handleSelectCard}
              onSwitchToVoter={() => handleToggleRole('voter')}
            />
          </main>

          {/* Sprint Backlog & History Drawer */}
          <BacklogDrawer
            isOpen={isDrawerOpen}
            activeTab={drawerTab}
            onClose={() => setIsDrawerOpen(false)}
            onTabChange={setDrawerTab}
            room={room}
            selfId={selfId}
            onSelectStory={handleSelectStory}
            onAddStory={handleAddStory}
            onDeleteStory={handleDeleteStory}
            onUpdateRole={handleUpdateParticipantRole}
            onKickParticipant={handleKickParticipant}
          />

          {/* Gemini AI Story Assistant Modal */}
          {currentStory && (
            <AiAssistantModal
              story={currentStory}
              isOpen={isAiModalOpen}
              onClose={() => setIsAiModalOpen(false)}
              onApplyCriteria={(criteria) => {
                const updatedDesc = (currentStory.description || '') + criteria;
                handleUpdateStory({
                  id: currentStory.id,
                  description: updatedDesc,
                });
              }}
              onApplyScore={(suggestedScore) => {
                // If user wants to vote or adopt the score
                handleSelectCard(suggestedScore);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
