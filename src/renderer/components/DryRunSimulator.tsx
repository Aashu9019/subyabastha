import React, { useState } from 'react';
import type { Rule, DryRunResult } from '../../types';
import { FlaskConical, Play, Folder, FileCheck, AlertCircle } from 'lucide-react';

interface DryRunSimulatorProps {
  rules: Rule[];
  onSelectFolder: () => Promise<string | null>;
  onRunDryRun: (folder: string) => Promise<DryRunResult[]>;
}

export const DryRunSimulator: React.FC<DryRunSimulatorProps> = ({
  rules,
  onSelectFolder,
  onRunDryRun
}) => {
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [results, setResults] = useState<DryRunResult[] | null>(null);

  const handlePickFolder = async () => {
    const folder = await onSelectFolder();
    if (folder) setTargetFolder(folder);
  };

  const handleExecuteSimulator = async () => {
    if (!targetFolder) return;
    setIsRunning(true);
    try {
      const res = await onRunDryRun(targetFolder);
      setResults(res);
    } catch (err) {
      console.error('Simulator error:', err);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <FlaskConical className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Rule Dry-Run Simulator</h2>
            <p className="text-xs text-slate-400">
              Simulate rule matches on any folder without altering or moving actual files.
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
          <div className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-800">
            <Folder className="w-4 h-4 text-amber-400 shrink-0" />
            <input
              type="text"
              value={targetFolder}
              onChange={(e) => setTargetFolder(e.target.value)}
              placeholder="Select folder to test..."
              className="w-full bg-transparent text-xs text-slate-200 focus:outline-none font-mono"
            />
            <button
              onClick={handlePickFolder}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 shrink-0"
            >
              Browse
            </button>
          </div>

          <button
            onClick={handleExecuteSimulator}
            disabled={!targetFolder || isRunning}
            className="glow-btn w-full sm:w-auto px-6 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-500 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/25 shrink-0 disabled:opacity-50"
          >
            <Play className="w-4 h-4 fill-white" />
            <span>{isRunning ? 'Simulating...' : 'Run Simulator'}</span>
          </button>
        </div>
      </div>

      {/* Results Section */}
      {results && (
        <div className="p-6 rounded-2xl glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              <span>Simulation Matches ({results.length} files affected)</span>
            </h3>
          </div>

          {results.length === 0 ? (
            <div className="p-8 text-center text-slate-500 space-y-2">
              <AlertCircle className="w-8 h-8 mx-auto text-slate-600" />
              <p className="text-xs">No files matched your active rules in this folder.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {results.map((res, i) => (
                <div
                  key={i}
                  className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-semibold text-indigo-300 truncate">
                      {res.filePath.split(/[\\/]/).pop()}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                      Matched: {res.matchedRules.join(', ')}
                    </span>
                  </div>

                  <div className="space-y-1 pt-1 border-t border-slate-800/60 text-xs">
                    {res.proposedActions.map((act, idx) => (
                      <p key={idx} className="text-slate-400 text-[11px] flex items-center gap-2">
                        <span className="font-semibold text-cyan-400 uppercase text-[10px]">
                          [{act.type}]
                        </span>
                        <span>{act.details}</span>
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
