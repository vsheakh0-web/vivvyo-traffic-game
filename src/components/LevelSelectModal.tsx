import React, { useState } from 'react';
import { CheckCircle2, Lock, ShieldCheck, Star, Unlock, X } from 'lucide-react';
import { TOTAL_LEVELS } from '../game/levelGenerator';
import { runAllCoreGameplayTests } from '../tests/coreGameplay.test';

interface LevelSelectModalProps {
  isOpen: boolean;
  currentLevel: number;
  unlockedLevel: number;
  starsByLevel: Record<number, number>;
  qaUnlockAll: boolean;
  onSelectLevel: (levelNumber: number) => void;
  onToggleQaUnlockAll: () => void;
  onClose: () => void;
}

export const LevelSelectModal: React.FC<LevelSelectModalProps> = ({
  isOpen,
  currentLevel,
  unlockedLevel,
  starsByLevel,
  qaUnlockAll,
  onSelectLevel,
  onToggleQaUnlockAll,
  onClose,
}) => {
  const [testReport, setTestReport] = useState<{
    passed: number;
    failed: number;
    results: { name: string; passed: boolean; error?: string }[];
  } | null>(null);

  if (!isOpen) return null;

  const levels = Array.from({ length: TOTAL_LEVELS }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 select-none">
      <div className="w-full max-w-[430px] max-h-[88dvh] bg-slate-900 border-t sm:border border-slate-700 rounded-t-3xl sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">
              Transit Network · 100 Levels
            </h2>
            <p className="text-xs text-slate-400">
              Select any unlocked stop to play
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] rounded-xl bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-300"
            aria-label="Close Level Map"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* QA Controls Bar */}
        <div className="px-4 py-2.5 bg-slate-950/70 border-b border-slate-800 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onToggleQaUnlockAll}
            className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-colors ${
              qaUnlockAll
                ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                : 'bg-slate-800 border-slate-700 text-slate-300'
            }`}
          >
            <Unlock className="w-3.5 h-3.5" />
            <span>{qaUnlockAll ? 'All 100 Unlocked' : 'Unlock All 100'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const res = runAllCoreGameplayTests();
              setTestReport(res);
            }}
            className="min-h-[40px] px-3 py-1.5 rounded-xl bg-emerald-600/25 hover:bg-emerald-600/35 border border-emerald-500/60 text-emerald-300 text-xs font-semibold flex items-center gap-1.5"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Verify Core & 100 Levels</span>
          </button>
        </div>

        {/* Optional In-App Automated Test Suite Results */}
        {testReport && (
          <div className="px-4 py-2.5 bg-slate-950 border-b border-slate-800 max-h-44 overflow-y-auto text-xs">
            <div className="flex items-center justify-between font-bold text-emerald-400 mb-1.5">
              <span>
                Automated Test Suite: {testReport.passed}/
                {testReport.passed + testReport.failed} Passed
              </span>
              <button
                type="button"
                onClick={() => setTestReport(null)}
                className="text-slate-400 hover:text-white text-[11px]"
              >
                Hide
              </button>
            </div>
            <div className="space-y-1">
              {testReport.results.map((r, i) => (
                <div
                  key={i}
                  className="flex items-start gap-1.5 text-[11px] text-slate-300"
                >
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${
                      r.passed ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  />
                  <span>{r.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 100-Level Grid */}
        <div className="p-4 overflow-y-auto grid grid-cols-5 gap-2">
          {levels.map((lvl) => {
            const isUnlocked = qaUnlockAll || lvl <= unlockedLevel;
            const isCurrent = lvl === currentLevel;
            const stars = starsByLevel[lvl] || 0;

            return (
              <button
                key={lvl}
                type="button"
                disabled={!isUnlocked}
                onClick={() => {
                  onSelectLevel(lvl);
                  onClose();
                }}
                className={`min-h-[54px] rounded-xl border flex flex-col items-center justify-center p-1 transition-transform active:scale-95 ${
                  isCurrent
                    ? 'bg-amber-500/25 border-amber-400 text-white ring-2 ring-amber-400/60'
                    : isUnlocked
                    ? 'bg-slate-800 hover:bg-slate-750 border-slate-700 text-slate-100'
                    : 'bg-slate-900/50 border-slate-800/80 text-slate-600 opacity-60'
                }`}
              >
                <span className="text-xs font-bold tabular-nums">{lvl}</span>
                {isUnlocked ? (
                  <div className="flex items-center gap-0.5 mt-1">
                    {[1, 2, 3].map((s) => (
                      <Star
                        key={s}
                        className={`w-2.5 h-2.5 ${
                          s <= stars
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-600'
                        }`}
                      />
                    ))}
                  </div>
                ) : (
                  <Lock className="w-3 h-3 mt-1 text-slate-600" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
