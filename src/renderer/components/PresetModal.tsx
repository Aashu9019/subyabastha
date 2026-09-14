import React, { useState } from 'react';
import type { Rule } from '../../types';
import { Sparkles, Check, X, Folder, FolderInput, ArrowLeft, Info } from 'lucide-react';

interface PresetModalProps {
  isOpen: boolean;
  onClose: () => void;
  presets: Rule[];
  onImportPreset: (preset: Rule) => void;
  onSelectFolder: () => Promise<string | null>;
}

// Preset destinations are written relative to {downloads}; swap in the folder the user picked
function withSortFolder(destination: string, sortFolder: string) {
  return destination.replace(/^{downloads}/i, sortFolder.replace(/[\\/]+$/, ''));
}

function examplePath(preset: Rule, sortFolder: string) {
  const dest = preset.actions.find(a => a.type === 'move')?.destination || '';
  const firstExt = preset.conditions[0]?.value.split(',')[0].trim() || 'file';
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return withSortFolder(dest, sortFolder)
    .replace(/{ext}/gi, firstExt)
    .replace(/{year}-{month}/gi, month)
    .replace(/\//g, '\\');
}

export const PresetModal: React.FC<PresetModalProps> = ({
  isOpen,
  onClose,
  presets,
  onImportPreset,
  onSelectFolder
}) => {
  const [selected, setSelected] = useState<Rule | null>(null);
  const [watchFolder, setWatchFolder] = useState('');
  const [sortFolder, setSortFolder] = useState('');
  const [startNow, setStartNow] = useState(true);

  if (!isOpen) return null;

  const close = () => {
    setSelected(null);
    onClose();
  };

  const choosePreset = (preset: Rule) => {
    const downloads = preset.monitoredFolders[0] || '';
    setSelected(preset);
    setWatchFolder(downloads);
    setSortFolder(downloads);
    setStartNow(true);
  };

  const pickFolder = async (setter: (f: string) => void) => {
    const folder = await onSelectFolder();
    if (folder) setter(folder);
  };

  const confirmImport = () => {
    if (!selected || !watchFolder || !sortFolder) return;
    onImportPreset({
      ...selected,
      enabled: startNow,
      monitoredFolders: [watchFolder],
      actions: selected.actions.map(a => ({
        ...a,
        destination: a.destination ? withSortFolder(a.destination, sortFolder) : a.destination
      }))
    });
    close();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4 animate-fadeIn">
      <div className="w-full max-w-2xl rounded-2xl bg-slate-950 border border-indigo-500/30 shadow-2xl shadow-black/60 p-6 space-y-6 relative">
        <button
          onClick={close}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Sparkles className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {selected ? `Set up: ${selected.name}` : 'Preset Template Library'}
            </h2>
            <p className="text-xs text-slate-400">
              {selected
                ? 'Choose which folder to watch and where the sorted files should go.'
                : 'Pick a preset. Nothing runs until you choose its folders.'}
            </p>
          </div>
        </div>

        {!selected ? (
          <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">
            {presets.map((preset) => (
              <div
                key={preset.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 transition-all flex items-center justify-between gap-4"
              >
                <div className="space-y-1">
                  <h4 className="font-semibold text-xs text-white">{preset.name}</h4>
                  <p className="text-[11px] text-slate-400">
                    <span className="text-indigo-400 font-semibold">Files: </span>
                    {preset.conditions.map(c => c.value).join(', ')}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    <span className="text-cyan-400 font-semibold">Sorted into: </span>
                    <span className="font-mono">{examplePath(preset, 'your folder')}</span>
                  </p>
                </div>

                <button
                  onClick={() => choosePreset(preset)}
                  className="px-4 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 font-semibold text-xs flex items-center gap-1.5 shrink-0"
                >
                  <Check className="w-4 h-4" />
                  <span>Use Preset</span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <FolderField
              icon={<Folder className="w-4 h-4 text-amber-400" />}
              label="1. Folder to watch"
              hint="New files arriving here, and files already in it, will be checked against this preset."
              value={watchFolder}
              onBrowse={() => pickFolder(setWatchFolder)}
            />

            <FolderField
              icon={<FolderInput className="w-4 h-4 text-cyan-400" />}
              label="2. Where do you want the sorted files to go?"
              hint="Type and month folders are created inside this folder."
              value={sortFolder}
              onBrowse={() => pickFolder(setSortFolder)}
            />

            <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-indigo-300 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-slate-200">Example: a matching file downloaded this month goes to</p>
                <p className="font-mono text-[11px] text-cyan-300 break-all">{examplePath(selected, sortFolder)}</p>
                <p className="text-[11px] text-slate-400">You can change these folders later in Rules Engine, and undo any moves from the Undo Center.</p>
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={startNow}
                onChange={(e) => setStartNow(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-indigo-500"
              />
              <span>
                Start sorting now
                <span className="block text-[11px] text-slate-500">
                  Leave unticked to save the rule switched off and turn it on later.
                </span>
              </span>
            </label>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => setSelected(null)}
                className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to presets</span>
              </button>
              <button
                onClick={confirmImport}
                disabled={!watchFolder || !sortFolder}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs flex items-center gap-2 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                <span>{startNow ? 'Add Rule and Start Sorting' : 'Add Rule (Off)'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const FolderField: React.FC<{
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: string;
  onBrowse: () => void;
}> = ({ icon, label, hint, value, onBrowse }) => (
  <div className="space-y-1.5">
    <p className="text-xs font-semibold text-slate-200 flex items-center gap-2">
      {icon}
      <span>{label}</span>
    </p>
    <p className="text-[11px] text-slate-400">{hint}</p>
    <div className="flex items-center gap-2">
      <div className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-800 text-xs font-mono text-slate-200 truncate">
        {value || <span className="text-slate-500">No folder chosen</span>}
      </div>
      <button
        onClick={onBrowse}
        className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold shrink-0"
      >
        Browse...
      </button>
    </div>
  </div>
);
