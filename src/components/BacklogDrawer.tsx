import React, { useState } from 'react';
import {
  Layers,
  History,
  Users,
  Plus,
  Trash2,
  Play,
  CheckCircle2,
  Download,
  Copy,
  Check,
  ExternalLink,
  Shield,
  UserX,
  FileSpreadsheet,
} from 'lucide-react';
import { Participant, ParticipantRole, RoomState, Story } from '../types';

interface BacklogDrawerProps {
  isOpen: boolean;
  activeTab: 'backlog' | 'history' | 'team';
  onClose: () => void;
  onTabChange: (tab: 'backlog' | 'history' | 'team') => void;
  room: RoomState;
  selfId: string;
  onSelectStory: (storyId: string) => void;
  onAddStory: (story: Partial<Story>) => void;
  onDeleteStory: (storyId: string) => void;
  onUpdateRole: (targetUserId: string, role: ParticipantRole) => void;
  onKickParticipant: (targetUserId: string) => void;
}

export const BacklogDrawer: React.FC<BacklogDrawerProps> = ({
  isOpen,
  activeTab,
  onClose,
  onTabChange,
  room,
  selfId,
  onSelectStory,
  onAddStory,
  onDeleteStory,
  onUpdateRole,
  onKickParticipant,
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBatchImport, setShowBatchImport] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newKey, setNewKey] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [batchText, setBatchText] = useState('');
  const [copiedExport, setCopiedExport] = useState(false);

  if (!isOpen) return null;

  const me = room.participants[selfId];
  const isModerator = me?.role === 'moderator';

  const handleCreateStory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    onAddStory({
      title: newTitle.trim(),
      issueKey: newKey.trim() || undefined,
      description: newDesc.trim() || '',
      url: newUrl.trim() || undefined,
    });

    setNewTitle('');
    setNewKey('');
    setNewDesc('');
    setNewUrl('');
    setShowAddForm(false);
  };

  const handleBatchImport = () => {
    if (!batchText.trim()) return;
    const lines = batchText.split('\n').map((l) => l.trim()).filter(Boolean);

    lines.forEach((line) => {
      // Check if line starts with an issue key like PROJ-123: Title
      const match = line.match(/^([A-Z0-9]+-\d+)[:\s]+(.*)$/i);
      if (match) {
        onAddStory({
          issueKey: match[1].toUpperCase(),
          title: match[2].trim() || match[1],
        });
      } else {
        onAddStory({
          title: line,
        });
      }
    });

    setBatchText('');
    setShowBatchImport(false);
  };

  const estimatedStories = room.stories.filter((s) => s.status === 'estimated');
  const totalPoints = estimatedStories.reduce((acc, s) => {
    const num = parseFloat(s.finalScore || '0');
    return acc + (isNaN(num) ? 0 : num);
  }, 0);

  // CSV Export
  const exportCsv = () => {
    let csv = 'Klucz,Tytuł,Estymata (SP),Status,Kolejka\n';
    room.stories.forEach((s) => {
      const key = `"${(s.issueKey || '').replace(/"/g, '""')}"`;
      const title = `"${s.title.replace(/"/g, '""')}"`;
      const score = `"${s.finalScore || ''}"`;
      const status = `"${s.status}"`;
      csv += `${key},${title},${score},${status}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `planning-poker-${room.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  // Markdown Export
  const exportMarkdown = () => {
    let md = `# Raport Planning Poker: ${room.name} (${new Date().toLocaleDateString()})\n\n`;
    md += `**Łączna liczba Story Points:** ${totalPoints} SP\n\n`;
    md += `| Klucz | Zadanie | Estymata | Status |\n`;
    md += `| :--- | :--- | :--- | :--- |\n`;

    room.stories.forEach((s) => {
      const key = s.issueKey || '—';
      const score = s.finalScore ? `**${s.finalScore} SP**` : '—';
      md += `| ${key} | ${s.title} | ${score} | ${s.status} |\n`;
    });

    navigator.clipboard.writeText(md).then(() => {
      setCopiedExport(true);
      setTimeout(() => setCopiedExport(false), 2000);
    });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xs" onClick={onClose} />

      <div className="absolute inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 shadow-2xl flex flex-col text-slate-200">
          {/* Drawer Header & Tabs */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/70">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-base text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-indigo-400" />
                <span>Panel sprintu</span>
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm"
              >
                ✕
              </button>
            </div>

            {/* Tab navigation */}
            <div className="flex rounded-lg bg-slate-900 p-1 border border-slate-800 text-xs font-semibold">
              <button
                onClick={() => onTabChange('backlog')}
                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                  activeTab === 'backlog'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Backlog ({room.stories.length})</span>
              </button>

              <button
                onClick={() => onTabChange('history')}
                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                  activeTab === 'history'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Raport ({estimatedStories.length})</span>
              </button>

              <button
                onClick={() => onTabChange('team')}
                className={`flex-1 py-1.5 rounded-md flex items-center justify-center gap-1.5 transition ${
                  activeTab === 'team'
                    ? 'bg-indigo-600 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Zespół ({Object.keys(room.participants).length})</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Backlog */}
          {activeTab === 'backlog' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Add story actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-xs font-semibold shadow"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Dodaj zadanie</span>
                </button>

                <button
                  onClick={() => setShowBatchImport(!showBatchImport)}
                  className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 px-3 rounded-lg text-xs font-medium border border-slate-700"
                >
                  <span>Import wielu</span>
                </button>
              </div>

              {/* Add form */}
              {showAddForm && (
                <form
                  onSubmit={handleCreateStory}
                  className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs"
                >
                  <div className="font-semibold text-white">Nowe zadanie do estymacji</div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Klucz (np. PROJ-102)"
                      value={newKey}
                      onChange={(e) => setNewKey(e.target.value)}
                      className="w-32 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                    />
                    <input
                      type="text"
                      placeholder="Tytuł zadania *"
                      value={newTitle}
                      onChange={(e) => setNewTitle(e.target.value)}
                      required
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                    />
                  </div>
                  <textarea
                    placeholder="Opis / kryteria akceptacji..."
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    rows={2}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-white"
                  />
                  <input
                    type="text"
                    placeholder="Link do zadania (URL)"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1.5 text-white"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowAddForm(false)}
                      className="px-3 py-1 text-slate-400 hover:text-white"
                    >
                      Anuluj
                    </button>
                    <button
                      type="submit"
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold"
                    >
                      Dodaj do kolejki
                    </button>
                  </div>
                </form>
              )}

              {/* Batch Import form */}
              {showBatchImport && (
                <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="font-semibold text-white">Wklej listę zadań (jedno na linijkę)</div>
                  <p className="text-slate-400 text-[11px]">
                    Obsługuje format &quot;PROJ-123: Nazwa zadania&quot; lub same tytuły.
                  </p>
                  <textarea
                    placeholder={'PROJ-101: System powiadomień email\nPROJ-102: Refaktor formularza checkout\nPoprawa walidacji NIP'}
                    value={batchText}
                    onChange={(e) => setBatchText(e.target.value)}
                    rows={4}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 font-mono text-white"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => setShowBatchImport(false)}
                      className="px-3 py-1 text-slate-400 hover:text-white"
                    >
                      Anuluj
                    </button>
                    <button
                      onClick={handleBatchImport}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-semibold"
                    >
                      Zaimportuj zadania
                    </button>
                  </div>
                </div>
              )}

              {/* Stories list */}
              <div className="space-y-2">
                {room.stories.map((s, idx) => {
                  const isActive = s.id === room.currentStoryId;

                  return (
                    <div
                      key={s.id}
                      className={`p-3 rounded-xl border transition-all text-xs ${
                        isActive
                          ? 'bg-indigo-950/40 border-indigo-500/60 shadow-md ring-1 ring-indigo-500/40'
                          : 'bg-slate-950/50 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-1">
                            {s.issueKey && (
                              <span className="font-mono text-[10px] font-bold bg-slate-800 text-indigo-300 px-1.5 py-0.5 rounded">
                                {s.issueKey}
                              </span>
                            )}
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                                s.status === 'active'
                                  ? 'bg-indigo-900/80 text-indigo-300'
                                  : s.status === 'estimated'
                                  ? 'bg-emerald-900/80 text-emerald-300'
                                  : 'bg-slate-800 text-slate-400'
                              }`}
                            >
                              {s.status === 'active'
                                ? 'Aktywne'
                                : s.status === 'estimated'
                                ? `${s.finalScore} SP`
                                : 'W kolejce'}
                            </span>
                          </div>
                          <div className="font-semibold text-white truncate">{s.title}</div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {!isActive && (
                            <button
                              onClick={() => onSelectStory(s.id)}
                              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded"
                              title="Wybierz jako aktualne zadanie do głosowania"
                            >
                              <Play className="w-3.5 h-3.5 fill-current" />
                            </button>
                          )}
                          <button
                            onClick={() => onDeleteStory(s.id)}
                            className="p-1.5 hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 rounded"
                            title="Usuń zadanie"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: History & Export */}
          {activeTab === 'history' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* Summary card */}
              <div className="p-4 bg-gradient-to-br from-indigo-950/70 to-slate-950 rounded-xl border border-indigo-900/40 text-center">
                <div className="text-xs text-indigo-300 font-medium">Zestymowane zadania w sprincie</div>
                <div className="text-3xl font-black text-white font-mono my-1">
                  {totalPoints} <span className="text-sm font-sans font-normal text-indigo-300">SP</span>
                </div>
                <div className="text-xs text-slate-400">
                  {estimatedStories.length} z {room.stories.length} zadań ukończonych
                </div>
              </div>

              {/* Export buttons */}
              <div className="flex gap-2">
                <button
                  onClick={exportCsv}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-xs font-semibold border border-slate-700 transition"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Pobierz CSV</span>
                </button>

                <button
                  onClick={exportMarkdown}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-lg text-xs font-semibold border border-slate-700 transition"
                >
                  {copiedExport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedExport ? 'Skopiowano!' : 'Kopiuj Markdown'}</span>
                </button>
              </div>

              {/* History list */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Zakończone estymacje
                </div>
                {estimatedStories.length === 0 ? (
                  <p className="text-xs text-slate-500 py-4 text-center">
                    Brak ukończonych estymacji. Zatwierdź wynik po odkryciu kart, aby pojawił się tutaj.
                  </p>
                ) : (
                  estimatedStories.map((s) => (
                    <div
                      key={s.id}
                      className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-indigo-400 font-bold">{s.issueKey || 'Zadanie'}</span>
                        <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold px-2 py-0.5 rounded font-mono">
                          {s.finalScore} SP
                        </span>
                      </div>
                      <div className="font-medium text-white">{s.title}</div>
                      {s.completedAt && (
                        <div className="text-[10px] text-slate-500">
                          {new Date(s.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 3: Team / Participants Management */}
          {activeTab === 'team' && (
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
                Połączeni uczestnicy ({Object.keys(room.participants).length})
              </div>

              {(Object.values(room.participants) as Participant[]).map((p) => {
                const isMe = p.id === selfId;

                return (
                  <div
                    key={p.id}
                    className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-xs flex items-center justify-between gap-2"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-3 h-3 rounded-full shrink-0"
                        style={{ backgroundColor: p.avatarColor }}
                      />
                      <div className="min-w-0">
                        <div className="font-semibold text-white truncate flex items-center gap-1">
                          <span>{p.name}</span>
                          {isMe && <span className="text-[10px] text-indigo-300">(Ty)</span>}
                        </div>
                        <div className="text-[10px] text-slate-400 flex items-center gap-1">
                          <span className="capitalize">{p.role}</span>
                          <span>•</span>
                          <span className={p.isConnected ? 'text-emerald-400' : 'text-slate-500'}>
                            {p.isConnected ? 'Aktywny' : 'Rozłączony'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Role switcher / moderator controls */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isModerator && !isMe ? (
                        <select
                          value={p.role}
                          onChange={(e) => onUpdateRole(p.id, e.target.value as ParticipantRole)}
                          className="bg-slate-900 border border-slate-700 text-xs text-white rounded px-2 py-1"
                        >
                          <option value="voter">Głosujący</option>
                          <option value="observer">Obserwator</option>
                          <option value="moderator">Scrum Master</option>
                        </select>
                      ) : (
                        <span className="text-[11px] font-semibold text-slate-400 px-2 py-1 bg-slate-900 rounded">
                          {p.role === 'moderator' ? 'Scrum Master' : p.role === 'observer' ? 'Obserwator' : 'Głosujący'}
                        </span>
                      )}

                      {isModerator && !isMe && (
                        <button
                          onClick={() => onKickParticipant(p.id)}
                          className="p-1 hover:bg-rose-950 text-slate-500 hover:text-rose-400 rounded"
                          title="Usuń uczestnika z pokoju"
                        >
                          <UserX className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
