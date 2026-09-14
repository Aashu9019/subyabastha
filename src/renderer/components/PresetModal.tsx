import React from 'react';
import type { Rule } from '../../types';
import { Sparkles, Check, X } from 'lucide-react';

interface PresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  presets: Rule[];
  onImportPreset: (preset: Rule) => void;
}

export const PresetModal: React.FC<PresetModalProps> = ({
  isOpen,
  onClose,
  presets,
  onImportPreset
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-950 border border-indigo-500/30 shadow-2xl shadow-black/60 p-6 space-y-6 relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Preset Template Library</h2>
            <p className="text-xs text-slate-400">
              Imported rules watch your Downloads folder. You can change the folder after importing.
            </p>
          </div>
        </div>

        <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
          {presets.map((preset) => (
            <div
              key={preset.id}
              className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-all flex items-center justify-between gap-4"
            >
              <div className="space-y-1">
                <h4 className="font-semibold text-xs text-white">{preset.name}</h4>
                <p className="text-[11px] text-slate-400">
                  <span className="text-indigo-400 font-semibold">IF: </span>
                  {preset.conditions.map(c => `${c.field} ${c.operator} "${c.value}"`).join(' AND ')}
                </p>
                <p className="text-[11px] text-slate-400">
                  <span className="text-cyan-400 font-semibold">THEN: </span>
                  {preset.actions.map(a => a.type).join(' ➔ ')}
                </p>
              </div>

              <button
                onClick={() => {
                  onImportPreset(preset);
                  onClose();
                }}
                className="glow-btn px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-semibold text-xs flex items-center gap-1.5 shrink-0"
              >
                <Check className="w-4 h-4" />
                <span>Import Rule</span>
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
