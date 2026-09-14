import React, { useState } from 'react';
import { Sparkles, Check, Copy, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { Story } from '../types';

interface AiAssistantModalProps {
  story: Story;
  isOpen: boolean;
  onClose: () => void;
  onApplyCriteria: (criteriaText: string) => void;
  onApplyScore?: (score: string) => void;
}

interface AiAnalysisResult {
  summary: string;
  acceptanceCriteria: string[];
  technicalConsiderations: string[];
  suggestedStoryPoints: string;
  estimationReasoning: string;
}

export const AiAssistantModal: React.FC<AiAssistantModalProps> = ({
  story,
  isOpen,
  onClose,
  onApplyCriteria,
  onApplyScore,
}) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AiAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleAnalyze = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/ai/analyze-story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: story.title,
          description: story.description,
        }),
      });

      if (!res.ok) {
        throw new Error('Błąd podczas pobierania analizy AI');
      }

      const data = await res.json();
      setResult(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Wystąpił nieoczekiwany błąd');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    const text = `Podsumowanie:\n${result.summary}\n\nKryteria akceptacji:\n${result.acceptanceCriteria
      .map((c) => `- ${c}`)
      .join('\n')}\n\nWskazówki techniczne:\n${result.technicalConsiderations
      .map((c) => `- ${c}`)
      .join('\n')}\n\nSugerowane SP: ${result.suggestedStoryPoints} (${result.estimationReasoning})`;

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleApply = () => {
    if (!result) return;
    const criteriaText = `\n\n### Kryteria Akceptacji (AI):\n${result.acceptanceCriteria
      .map((c) => `- [ ] ${c}`)
      .join('\n')}\n\n### Kwestie Techniczne:\n${result.technicalConsiderations
      .map((c) => `- ${c}`)
      .join('\n')}`;

    onApplyCriteria(criteriaText);
    if (onApplyScore && result.suggestedStoryPoints) {
      onApplyScore(result.suggestedStoryPoints);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-2xl w-full p-6 shadow-2xl text-slate-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Asystent Agile AI (Gemini)</h3>
              <p className="text-xs text-slate-400">
                Automatyczny rozbiór historyjki, kryteria akceptacji i rekomendacja złożoności
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 text-sm"
          >
            ✕
          </button>
        </div>

        {/* Current Story Card */}
        <div className="my-4 p-3 bg-slate-950/80 rounded-xl border border-slate-800">
          <div className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wider mb-1">
            Analizowane zadanie:
          </div>
          <div className="text-sm font-bold text-white">{story.title}</div>
          {story.description && (
            <p className="text-xs text-slate-400 mt-1 line-clamp-2">{story.description}</p>
          )}
        </div>

        {/* Initial Trigger / Loading State */}
        {!result && !loading && (
          <div className="text-center py-8">
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
              Model przeanalizuje tytuł i opis zadania, wygeneruje brakujące kryteria akceptacji w
              stylu Scrum, wskaże przypadki brzegowe i zasugeruje estymatę Story Points.
            </p>
            <button
              onClick={handleAnalyze}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-xs px-5 py-2.5 rounded-xl shadow-lg transition transform hover:scale-105 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>Generuj analizę AI dla tego zadania</span>
            </button>
          </div>
        )}

        {loading && (
          <div className="text-center py-10 space-y-3">
            <Loader2 className="w-8 h-8 text-indigo-400 animate-spin mx-auto" />
            <p className="text-xs text-indigo-300 font-medium animate-pulse">
              Gemini analizuje architekturę, przypadki brzegowe i złożoność historyjki...
            </p>
          </div>
        )}

        {error && (
          <div className="p-3 bg-rose-950/50 border border-rose-800 rounded-lg text-rose-300 text-xs flex items-center gap-2 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 text-xs">
            {/* Summary */}
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
              <div className="font-semibold text-indigo-300 mb-1">Podsumowanie i cel biznesowy</div>
              <p className="text-slate-300 leading-relaxed">{result.summary}</p>
            </div>

            {/* Suggested Acceptance Criteria */}
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
              <div className="font-semibold text-emerald-300 mb-2">
                Sugerowane kryteria akceptacji (Acceptance Criteria)
              </div>
              <ul className="space-y-1.5 text-slate-300">
                {result.acceptanceCriteria.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-emerald-400 font-bold shrink-0">✓</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Technical Considerations */}
            <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800">
              <div className="font-semibold text-amber-300 mb-2">
                Wskazówki techniczne, integracje i ryzyka
              </div>
              <ul className="space-y-1.5 text-slate-300">
                {result.technicalConsiderations.map((c, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-400 font-bold shrink-0">•</span>
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Suggested Estimate */}
            <div className="p-3 bg-indigo-950/50 border border-indigo-800/80 rounded-lg flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-indigo-200">Sugerowana estymata (AI)</div>
                <div className="text-[11px] text-indigo-300 mt-0.5">{result.estimationReasoning}</div>
              </div>
              <div className="text-center shrink-0">
                <div className="text-2xl font-black font-mono text-white bg-indigo-600 px-3 py-1 rounded-lg">
                  {result.suggestedStoryPoints} SP
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg text-xs font-medium"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Skopiowano!' : 'Kopiuj treść'}</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleAnalyze}
                  className="text-slate-400 hover:text-white px-2 py-1 text-xs"
                >
                  Odśwież
                </button>

                <button
                  onClick={handleApply}
                  className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold px-4 py-1.5 rounded-lg text-xs cursor-pointer shadow"
                >
                  <span>Wklej do historyjki</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
