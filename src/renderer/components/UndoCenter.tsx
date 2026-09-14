import React, { useState } from 'react';
import type { JournalEntry } from '../../types';
import { History, Undo2, CheckCircle, AlertTriangle } from 'lucide-react';

interface UndoCenterProps {
  journal: JournalEntry[];
  onUndoEntry: (id: string) => Promise<{ success: boolean; message: string }>;
  onUndoRule: (ruleId: string) => Promise<{ success: boolean; message: string }>;
  onRefresh: () => void;
}

const UNDOABLE = ['move', 'rename', 'copy'];

export const UndoCenter: React.FC<UndoCenterProps> = ({
  journal,
  onUndoEntry,
  onUndoRule,
  onRefresh
}) => {
  const [undoingId, setUndoingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ id: string; success: boolean; message: string } | null>(null);
  const [confirmRuleId, setConfirmRuleId] = useState<string | null>(null);

  // One row per rule that still has actions that can be undone
  const ruleGroups = Object.values(
    journal.reduce<Record<string, { ruleId: string; ruleName: string; count: number }>>((acc, e) => {
      if (e.undone || !UNDOABLE.includes(e.actionType)) return acc;
      acc[e.ruleId] ??= { ruleId: e.ruleId, ruleName: e.ruleName, count: 0 };
      acc[e.ruleId].count++;
      return acc;
    }, {})
  );

  const handleUndoRule = async (ruleId: string) => {
    setConfirmRuleId(null);
    setUndoingId(ruleId);
    setFeedback(null);
    try {
      const res = await onUndoRule(ruleId);
      setFeedback({ id: ruleId, success: res.success, message: res.message });
      onRefresh();
    } catch (err: any) {
      setFeedback({ id: ruleId, success: false, message: err.message });
    } finally {
      setUndoingId(null);
    }
  };

  const handleUndo = async (id: string) => {
    setUndoingId(id);
    setFeedback(null);
    try {
      const res = await onUndoEntry(id);
      setFeedback({ id, success: res.success, message: res.message });
      onRefresh();
    } catch (err: any) {
      setFeedback({ id, success: false, message: err.message });
    } finally {
      setUndoingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl glass-panel space-y-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">1-Click Undo Center</h2>
            <p className="text-xs text-slate-400">
              Revert any automated file movement, copy, or renaming with instant restore safety.
            </p>
          </div>
        </div>
      </div>

      {/* Bulk undo per rule */}
      {ruleGroups.length > 0 && (
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <div>
            <h3 className="font-bold text-sm text-white">Undo by Rule</h3>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Put back every file a rule moved, renamed, or copied, in one step.
            </p>
          </div>

          <div className="space-y-2">
            {ruleGroups.map((group) => (
              <div
                key={group.ruleId}
                className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
              >
                <div className="space-y-0.5">
                  <p className="font-semibold text-white">{group.ruleName}</p>
                  <p className="text-[11px] text-slate-400">{group.count} action(s) can be undone</p>
                  {feedback && feedback.id === group.ruleId && (
                    <p className={`text-[11px] ${feedback.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {feedback.message}
                    </p>
                  )}
                </div>

                {confirmRuleId === group.ruleId ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-300">Restore {group.count} file(s)?</span>
                    <button
                      onClick={() => handleUndoRule(group.ruleId)}
                      className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold"
                    >
                      Yes, undo all
                    </button>
                    <button
                      onClick={() => setConfirmRuleId(null)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmRuleId(group.ruleId)}
                    disabled={undoingId !== null}
                    className="px-4 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-semibold flex items-center gap-1.5 shrink-0 disabled:opacity-50"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    <span>{undoingId === group.ruleId ? 'Restoring...' : `Undo all ${group.count}`}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History Log Table */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-white">Execution Journal ({journal.length} entries)</h3>
          <button
            onClick={onRefresh}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300"
          >
            Refresh Journal
          </button>
        </div>

        {journal.length === 0 ? (
          <p className="text-xs text-slate-500 py-10 text-center">No file actions recorded yet.</p>
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {journal.map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">{item.ruleName}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase">
                      {item.actionType}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-mono">
                    <span className="text-slate-500">From:</span> {item.originalPath}
                  </p>
                  {item.newPath && (
                    <p className="text-[11px] text-slate-400 font-mono">
                      <span className="text-slate-500">To:</span> {item.newPath}
                    </p>
                  )}
                  <p className="text-[10px] text-slate-600">
                    {new Date(item.timestamp).toLocaleString()}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  {item.undone ? (
                    <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-semibold flex items-center gap-1">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Restored</span>
                    </span>
                  ) : item.actionType === 'move' || item.actionType === 'rename' || item.actionType === 'copy' ? (
                    <button
                      onClick={() => handleUndo(item.id)}
                      disabled={undoingId === item.id}
                      className="glow-btn px-4 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-semibold text-xs flex items-center gap-1.5 transition-all disabled:opacity-50"
                    >
                      <Undo2 className="w-3.5 h-3.5" />
                      <span>{undoingId === item.id ? 'Restoring...' : 'Undo Action'}</span>
                    </button>
                  ) : (
                    <span className="text-[11px] text-slate-500 italic">Undo Unavailable</span>
                  )}

                  {feedback && feedback.id === item.id && (
                    <p className={`text-[10px] ${feedback.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {feedback.message}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
