import React from 'react';
import { 
  FolderSearch, 
  CheckCircle2, 
  Activity, 
  Plus, 
  ArrowRight,
  FolderPlus
} from 'lucide-react';
import type { Rule, JournalEntry } from '../../types';

interface DashboardProps {
  rules: Rule[];
  journal: JournalEntry[];
  onAddNewRule: () => void;
  onSelectFolderToWatch: (ruleId: string) => void;
}

export const Dashboard: React.FC<DashboardProps> = ({
  rules,
  journal,
  onAddNewRule,
  onSelectFolderToWatch
}) => {
  const activeRules = rules.filter(r => r.enabled);
  const totalMonitoredFolders = Array.from(
    new Set(activeRules.flatMap(r => r.monitoredFolders))
  );

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-100 tracking-tight">
            Dashboard Overview
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time file monitoring, automated execution rules, and live transaction log.
          </p>
        </div>

        <button
          onClick={onAddNewRule}
          className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>New Automation Rule</span>
        </button>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl glass-panel space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Monitored Folders</span>
            <FolderSearch className="w-4 h-4 text-slate-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{totalMonitoredFolders.length}</p>
        </div>

        <div className="p-4 rounded-xl glass-panel space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Active Rules</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{activeRules.length}</p>
        </div>

        <div className="p-4 rounded-xl glass-panel space-y-1">
          <div className="flex items-center justify-between text-slate-400">
            <span className="text-xs font-semibold">Total Executions</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <p className="text-2xl font-bold text-slate-100">{journal.length}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Rules & Watched Folders */}
        <div className="p-5 rounded-xl glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Active Rules & Watch Folders
            </h3>
            <span className="text-xs text-slate-500">{rules.length} rules</span>
          </div>

          <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
            {rules.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">No rules configured yet.</p>
            ) : (
              rules.map((rule) => (
                <div
                  key={rule.id}
                  className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800/80 hover:border-slate-700 transition-all space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-slate-200">{rule.name}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-semibold ${
                        rule.enabled
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-800 text-slate-500'
                      }`}
                    >
                      {rule.enabled ? 'Active' : 'Disabled'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                    <span className="truncate max-w-[240px] text-slate-400 font-mono text-[11px]">
                      📂 {rule.monitoredFolders.length > 0 ? rule.monitoredFolders.join(', ') : 'No folder assigned'}
                    </span>
                    <button
                      onClick={() => onSelectFolderToWatch(rule.id)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-[11px] flex items-center gap-1 transition-all"
                    >
                      <FolderPlus className="w-3 h-3 text-indigo-400" />
                      <span>+ Folder</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Real-time Activity Stream */}
        <div className="p-5 rounded-xl glass-panel space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400">
              Live Activity Stream
            </h3>
            <span className="text-xs text-slate-500">Latest actions</span>
          </div>

          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {journal.length === 0 ? (
              <div className="text-center py-10 text-slate-500 space-y-1">
                <p className="text-xs">No file actions recorded yet.</p>
                <p className="text-[11px] text-slate-600">Drop a file into a watched folder to see automation!</p>
              </div>
            ) : (
              journal.slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="p-3 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5 truncate max-w-[280px]">
                    <p className="font-medium text-slate-300 truncate text-[11px]">
                      {item.originalPath.split(/[\\/]/).pop()}
                    </p>
                    <p className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span className="font-semibold text-indigo-400">{item.actionType.toUpperCase()}</span>
                      <ArrowRight className="w-3 h-3 text-slate-600" />
                      <span className="truncate text-slate-400 font-mono">
                        {item.newPath ? item.newPath.split(/[\\/]/).pop() : 'Recycle Bin'}
                      </span>
                    </p>
                  </div>
                  <span className="text-[10px] text-slate-500 shrink-0 font-mono">
                    {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
