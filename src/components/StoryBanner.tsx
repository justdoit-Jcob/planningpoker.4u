import React, { useState } from 'react';
import {
  Sparkles,
  ExternalLink,
  Edit3,
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  SkipForward,
  Bookmark,
} from 'lucide-react';
import { Story } from '../types';

interface StoryBannerProps {
  story: Story | null;
  isModerator: boolean;
  onOpenAiAssistant: () => void;
  onUpdateStory: (story: Partial<Story> & { id: string }) => void;
  onNextStory?: () => void;
  hasNextStory?: boolean;
}

export const StoryBanner: React.FC<StoryBannerProps> = ({
  story,
  isModerator,
  onOpenAiAssistant,
  onUpdateStory,
  onNextStory,
  hasNextStory,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(story?.title || '');
  const [description, setDescription] = useState(story?.description || '');
  const [issueKey, setIssueKey] = useState(story?.issueKey || '');
  const [notes, setNotes] = useState(story?.notes || '');
  const [url, setUrl] = useState(story?.url || '');

  // Keep local state in sync when active story changes
  React.useEffect(() => {
    if (story) {
      setTitle(story.title);
      setDescription(story.description || '');
      setIssueKey(story.issueKey || '');
      setNotes(story.notes || '');
      setUrl(story.url || '');
    }
  }, [story?.id]);

  if (!story) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 text-center max-w-4xl mx-auto my-4 text-slate-400">
        <p className="text-sm">Brak aktywnej historyjki do estymacji.</p>
        <p className="text-xs mt-1 text-slate-500">
          Wybierz zadanie z backlogu po prawej stronie lub dodaj nowe.
        </p>
      </div>
    );
  }

  const handleSave = () => {
    if (story) {
      onUpdateStory({
        id: story.id,
        title: title.trim() || story.title,
        description,
        issueKey: issueKey.trim(),
        notes,
        url: url.trim(),
      });
    }
    setIsEditing(false);
  };

  return (
    <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl shadow-lg max-w-5xl mx-auto my-3 overflow-hidden backdrop-blur-xs">
      {/* Top Banner Row */}
      <div className="p-3.5 sm:p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/60">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            {story.issueKey && (
              <span className="inline-flex items-center gap-1 font-mono text-xs font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 px-2 py-0.5 rounded">
                <Bookmark className="w-3 h-3 text-indigo-400" />
                {story.issueKey}
              </span>
            )}
            <span
              className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                story.status === 'estimated'
                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                  : 'bg-amber-950 text-amber-300 border border-amber-800'
              }`}
            >
              {story.status === 'estimated'
                ? `Zestymowano (${story.finalScore} SP)`
                : 'Aktualnie estymowane'}
            </span>

            {story.url && (
              <a
                href={story.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline"
              >
                <span>Jira / Issue</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          {isEditing ? (
            <div className="space-y-2 mt-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Klucz (np. PROJ-101)"
                  value={issueKey}
                  onChange={(e) => setIssueKey(e.target.value)}
                  className="w-32 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                />
                <input
                  type="text"
                  placeholder="Tytuł historyjki"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-sm font-semibold text-white"
                />
              </div>
              <textarea
                placeholder="Opis historyjki użytkownika (As a user, I want...)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-xs text-slate-200"
              />
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Link do zadania (opcjonalny URL)"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                />
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1 rounded"
                >
                  <Check className="w-3.5 h-3.5" />
                  Zapisz
                </button>
              </div>
            </div>
          ) : (
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight break-words">
              {story.title}
            </h2>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
          {/* AI Story Assistant Button */}
          <button
            onClick={onOpenAiAssistant}
            className="flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm border border-indigo-400/30 transition hover:scale-102 cursor-pointer"
            title="Przeanalizuj historyjkę z modelem Gemini AI"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>Asystent AI (Gemini)</span>
          </button>

          {isModerator && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-300 hover:text-white border border-slate-700"
              title="Edytuj historyjkę"
            >
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}

          {hasNextStory && onNextStory && (
            <button
              onClick={onNextStory}
              className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium px-2.5 py-1.5 rounded-lg border border-slate-700"
              title="Przejdź do kolejnego zadania"
            >
              <span>Następna</span>
              <SkipForward className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 hover:text-white border border-slate-700"
            title={expanded ? 'Zwiń szczegóły' : 'Rozwiń opis i notatki'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expandable Details & Notes Area */}
      {expanded && (
        <div className="p-4 bg-slate-950/40 border-t border-slate-800/60 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-indigo-400" />
              Opis / Kryteria akceptacji:
            </div>
            <p className="text-slate-300 whitespace-pre-wrap leading-relaxed bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              {story.description || 'Brak opisu dla tego zadania.'}
            </p>
          </div>

          <div>
            <div className="font-semibold text-slate-300 mb-1 flex items-center gap-1.5 justify-between">
              <span>Notatki ze spotkania (Live Scratchpad):</span>
            </div>
            <textarea
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                onUpdateStory({ id: story.id, notes: e.target.value });
              }}
              placeholder="Wspólne ustalenia, przypadki brzegowe, uwagi architektoniczne..."
              rows={4}
              className="w-full bg-slate-900/60 border border-slate-800/80 rounded-lg p-3 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 leading-relaxed"
            />
          </div>
        </div>
      )}
    </div>
  );
};
