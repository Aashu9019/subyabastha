import React, { useState } from 'react';
import type { 
  Rule, 
  RuleCondition, 
  RuleAction, 
  ConditionField, 
  ConditionOperator, 
  ActionType 
} from '../../types';
import { 
  Plus, 
  Trash2, 
  Save, 
  Folder, 
  Sparkles, 
  Layers, 
  PlaySquare, 
  ArrowLeft 
} from 'lucide-react';

interface RuleBuilderProps {
  initialRule?: Rule | null;
  onSaveRule: (rule: Rule) => void;
  onCancel: () => void;
  onSelectFolder: () => Promise<string | null>;
}

export const RuleBuilder: React.FC<RuleBuilderProps> = ({
  initialRule,
  onSaveRule,
  onCancel,
  onSelectFolder
}) => {
  const [ruleName, setRuleName] = useState(initialRule?.name || 'New Automation Rule');
  const [enabled, setEnabled] = useState(initialRule?.enabled ?? true);
  const [matchType, setMatchType] = useState<'ALL' | 'ANY'>(initialRule?.matchType || 'ALL');
  const [monitoredFolders, setMonitoredFolders] = useState<string[]>(initialRule?.monitoredFolders || []);
  
  const [conditions, setConditions] = useState<RuleCondition[]>(
    initialRule?.conditions || [
      { id: 'c_1', field: 'extension', operator: 'equals', value: 'pdf' }
    ]
  );

  const [actions, setActions] = useState<RuleAction[]>(
    initialRule?.actions || [
      { id: 'a_1', type: 'move', destination: 'C:/OrganizedFiles/{year}' }
    ]
  );

  const handleAddFolder = async () => {
    const folder = await onSelectFolder();
    if (folder && !monitoredFolders.includes(folder)) {
      setMonitoredFolders([...monitoredFolders, folder]);
    }
  };

  const handleRemoveFolder = (folder: string) => {
    setMonitoredFolders(monitoredFolders.filter(f => f !== folder));
  };

  const handleAddCondition = () => {
    setConditions([
      ...conditions,
      {
        id: 'c_' + Date.now(),
        field: 'name',
        operator: 'contains',
        value: ''
      }
    ]);
  };

  const handleRemoveCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  const handleUpdateCondition = (id: string, updates: Partial<RuleCondition>) => {
    setConditions(conditions.map(c => (c.id === id ? { ...c, ...updates } : c)));
  };

  const handleAddAction = () => {
    setActions([
      ...actions,
      {
        id: 'a_' + Date.now(),
        type: 'move',
        destination: 'C:/OrganizedFiles'
      }
    ]);
  };

  const handleRemoveAction = (id: string) => {
    setActions(actions.filter(a => a.id !== id));
  };

  const handleUpdateAction = (id: string, updates: Partial<RuleAction>) => {
    setActions(actions.map(a => (a.id === id ? { ...a, ...updates } : a)));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ruleToSave: Rule = {
      id: initialRule?.id || 'rule_' + Date.now(),
      name: ruleName,
      enabled,
      matchType,
      monitoredFolders,
      conditions,
      actions,
      stats: initialRule?.stats || { timesTriggered: 0, lastTriggered: null }
    };
    onSaveRule(ruleToSave);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fadeIn pb-12">
      {/* Top Header Controls */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Rules</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition-all active:scale-95"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="glow-btn px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/25 active:scale-95"
          >
            <Save className="w-4 h-4" />
            <span>Save Automation Rule</span>
          </button>
        </div>
      </div>

      {/* Main Settings Card */}
      <div className="p-6 rounded-2xl glass-panel space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="w-full sm:w-2/3">
            <label className="text-xs font-semibold text-slate-300 block mb-1">Rule Name</label>
            <input
              type="text"
              value={ruleName}
              onChange={(e) => setRuleName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-900/90 border border-slate-800 text-sm font-semibold text-white focus:outline-none focus:border-indigo-500 transition-all"
              placeholder="e.g. Sort Tax Invoices by Content Date"
              required
            />
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Rule Status</label>
              <button
                type="button"
                onClick={() => setEnabled(!enabled)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                  enabled
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}
              >
                {enabled ? 'Active' : 'Disabled'}
              </button>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">Match Criteria</label>
              <select
                value={matchType}
                onChange={(e) => setMatchType(e.target.value as 'ALL' | 'ANY')}
                className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-semibold text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">Match ALL Conditions (AND)</option>
                <option value="ANY">Match ANY Condition (OR)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Monitored Folders Section */}
        <div className="pt-4 border-t border-slate-800/80 space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-300 flex items-center gap-2">
              <Folder className="w-4 h-4 text-amber-400" />
              <span>Monitored Folders</span>
            </label>
            <button
              type="button"
              onClick={handleAddFolder}
              className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 active:scale-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Target Folder</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {monitoredFolders.length === 0 ? (
              <p className="text-xs text-slate-500 italic">No folder assigned. Click "Add Target Folder".</p>
            ) : (
              monitoredFolders.map((folder) => (
                <div
                  key={folder}
                  className="px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-center gap-2 font-mono"
                >
                  <span>{folder}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveFolder(folder)}
                    className="text-slate-500 hover:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Conditions Card */}
      <div className="p-6 rounded-2xl glass-panel space-y-4 border-indigo-500/20">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-indigo-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-indigo-400" />
            <span>IF Conditions</span>
          </h3>
          <button
            type="button"
            onClick={handleAddCondition}
            className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Condition</span>
          </button>
        </div>

        <div className="space-y-3">
          {conditions.map((cond) => (
            <div
              key={cond.id}
              className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
            >
              <div className="sm:col-span-4">
                <select
                  value={cond.field}
                  onChange={(e) => handleUpdateCondition(cond.id, { field: e.target.value as ConditionField })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
                >
                  <option value="extension">File Extension (e.g. pdf, png)</option>
                  <option value="name">File Name</option>
                  <option value="size">File Size (e.g. 5MB, 100KB)</option>
                  <option value="pdfContent">PDF Text Content</option>
                  <option value="pdfAuthor">PDF Author Meta</option>
                  <option value="textContent">Text File Content</option>
                  <option value="createdDate">Creation Date</option>
                  <option value="modifiedDate">Last Modified Date</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <select
                  value={cond.operator}
                  onChange={(e) => handleUpdateCondition(cond.id, { operator: e.target.value as ConditionOperator })}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
                >
                  <option value="equals">equals</option>
                  <option value="contains">contains</option>
                  <option value="starts_with">starts with</option>
                  <option value="ends_with">ends with</option>
                  <option value="regex">regex pattern</option>
                  <option value="greater_than">greater than</option>
                  <option value="less_than">less than</option>
                </select>
              </div>

              <div className="sm:col-span-4">
                <input
                  type="text"
                  value={cond.value}
                  onChange={(e) => handleUpdateCondition(cond.id, { value: e.target.value })}
                  placeholder="Target value..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200 font-mono"
                  required
                />
              </div>

              <div className="sm:col-span-1 flex justify-end">
                <button
                  type="button"
                  onClick={() => handleRemoveCondition(cond.id)}
                  className="p-2 text-slate-500 hover:text-rose-400 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions Card */}
      <div className="p-6 rounded-2xl glass-panel space-y-4 border-cyan-500/20">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-sm text-cyan-300 flex items-center gap-2">
            <PlaySquare className="w-4 h-4 text-cyan-400" />
            <span>THEN Actions</span>
          </h3>
          <button
            type="button"
            onClick={handleAddAction}
            className="text-xs font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Action</span>
          </button>
        </div>

        <div className="space-y-3">
          {actions.map((act) => (
            <div
              key={act.id}
              className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3"
            >
              <div className="flex items-center justify-between">
                <select
                  value={act.type}
                  onChange={(e) => handleUpdateAction(act.id, { type: e.target.value as ActionType })}
                  className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-semibold text-slate-200"
                >
                  <option value="move">Move File to Folder</option>
                  <option value="copy">Copy File to Folder</option>
                  <option value="rename">Rename File</option>
                  <option value="delete">Send to Recycle Bin</option>
                  <option value="notify">Send Desktop Notification</option>
                  <option value="script">Run CLI Command / Script</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleRemoveAction(act.id)}
                  className="p-1.5 text-slate-500 hover:text-rose-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {(act.type === 'move' || act.type === 'copy') && (
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Target Destination Folder</label>
                  <input
                    type="text"
                    value={act.destination || ''}
                    onChange={(e) => handleUpdateAction(act.id, { destination: e.target.value })}
                    placeholder="e.g. C:/Users/Documents/Invoices/{year}/{month}"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200"
                    required
                  />
                </div>
              )}

              {act.type === 'rename' && (
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Rename Pattern</label>
                  <input
                    type="text"
                    value={act.pattern || ''}
                    onChange={(e) => handleUpdateAction(act.id, { pattern: e.target.value })}
                    placeholder="e.g. Invoice_{extracted_date}_{name}.pdf"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono text-slate-200"
                    required
                  />
                </div>
              )}

              {act.type === 'notify' && (
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Notification Message</label>
                  <input
                    type="text"
                    value={act.notifyMessage || ''}
                    onChange={(e) => handleUpdateAction(act.id, { notifyMessage: e.target.value })}
                    placeholder="e.g. Organized document {name} to tax folder"
                    className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-200"
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="p-3.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs text-indigo-300 flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-slate-200">Dynamic Variable Tokens:</p>
            <p className="text-[11px] text-indigo-300 font-mono mt-1">
              {'{name}'}, {'{ext}'}, {'{date}'}, {'{extracted_date}'}, {'{year}'}, {'{month}'}, {'{pdf_author}'}, {'{counter:001}'}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
};
