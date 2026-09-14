import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Edit2, Check } from 'lucide-react';
import { useDismissOnOutside } from '../hooks/useDismissOnOutside';

interface TopicBarProps {
  topic: string;
  round: number;
  onUpdateTopic: (topic: string) => void;
}

export const TopicBar: React.FC<TopicBarProps> = ({ topic, round, onUpdateTopic }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(topic);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(topic);
  }, [topic]);

  const handleSave = () => {
    const next = value.trim();
    // Bez zmiany nie ma po co rozsyłać stanu całego pokoju.
    if (next !== topic) onUpdateTopic(next);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setValue(topic);
    setIsEditing(false);
  };

  // Kliknięcie poza polem zatwierdza wpis — tak samo jak przycisk „Zapisz”.
  useDismissOnOutside(editRef, isEditing, handleSave);

  return (
    <div className="w-full max-w-4xl mx-auto my-2 px-2 sm:px-4">
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-2.5 sm:p-3 shadow-md flex items-center justify-between gap-3 backdrop-blur-xs">
        {/* Round Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-xs font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/80 px-2.5 py-1 rounded-lg select-none">
            Runda #{round}
          </span>
        </div>

        {/* Topic Display or Edit */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <div className="flex items-center gap-2" ref={editRef}>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSave();
                  if (e.key === 'Escape') handleCancel();
                }}
                placeholder="Wpisz temat, nazwę zadania lub link (opcjonalnie)..."
                className="w-full bg-slate-950 text-white text-xs sm:text-sm font-medium px-3 py-1.5 rounded-lg border border-indigo-500 focus:outline-none placeholder-slate-500"
                autoFocus
              />
              <button
                onClick={handleSave}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Zapisz</span>
              </button>
            </div>
          ) : (
            <div
              onClick={() => setIsEditing(true)}
              className="group flex items-center gap-2 cursor-pointer py-1 px-2 rounded-lg hover:bg-slate-800/60 transition min-w-0"
              title="Kliknij, aby zmienić temat lub nazwę estymowanego zadania"
            >
              <MessageSquare className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
              <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate group-hover:text-white">
                {topic ? topic : <span className="text-slate-500 font-normal italic">Kliknij tutaj, aby wpisać temat zadania (opcjonalnie)</span>}
              </span>
              <Edit2 className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
