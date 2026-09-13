import React from 'react';
import { Play, Pause, FolderSync, ShieldCheck, Activity } from 'lucide-react';

interface NavbarProps {
  isRunning: boolean;
  onToggleEngine: () => void;
  processedCount: number;
  activeRulesCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  isRunning,
  onToggleEngine,
  processedCount,
  activeRulesCount
}) => {
  return (
    <header className="h-14 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-40">
      {/* Clean Brand & Author Badge */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
          <FolderSync className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-2">
          <h1 className="font-bold text-sm text-slate-100 tracking-tight">SuByabastha Pro</h1>
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-slate-400 bg-slate-900 border border-slate-800 tracking-wide">
            by Aashutosh
          </span>
        </div>
      </div>

      {/* Clean Status Indicators */}
      <div className="flex items-center gap-4">
        <div className="hidden sm:flex items-center gap-3 text-xs">
          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">Active Rules:</span>
            <span className="font-semibold text-slate-200">{activeRulesCount}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-800 text-slate-300">
            <Activity className="w-3.5 h-3.5 text-indigo-400" />
            <span className="text-slate-400">Processed:</span>
            <span className="font-semibold text-slate-200">{processedCount} files</span>
          </div>
        </div>

        {/* Engine Toggle Button */}
        <button
          onClick={onToggleEngine}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-all active:scale-95 ${
            isRunning
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
          }`}
        >
          {isRunning ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <Pause className="w-3.5 h-3.5" />
              <span>Engine Running</span>
            </>
          ) : (
            <>
              <Play className="w-3.5 h-3.5" />
              <span>Engine Paused</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
