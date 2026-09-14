import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import type { TabType } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { RuleBuilder } from './components/RuleBuilder';
import { DryRunSimulator } from './components/DryRunSimulator';
import { UndoCenter } from './components/UndoCenter';
import { PresetModal } from './components/PresetModal';
import type { Rule, JournalEntry, AppSettings, DryRunResult } from '../types';
import { SlidersHorizontal, Plus, Trash2, Edit3 } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [rules, setRules] = useState<Rule[]>([]);
  const [journal, setJournal] = useState<JournalEntry[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [presets, setPresets] = useState<Rule[]>([]);
  
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [processedCount, setProcessedCount] = useState<number>(0);
  const [editingRule, setEditingRule] = useState<Rule | null>(null);
  const [isBuildingRule, setIsBuildingRule] = useState<boolean>(false);
  const [isPresetModalOpen, setIsPresetModalOpen] = useState<boolean>(false);

  const api = (window as any).api;

  const loadAllData = async () => {
    if (!api) return;
    try {
      const [rList, jList, status, setts, prs] = await Promise.all([
        api.getRules(),
        api.getJournal(),
        api.getEngineStatus(),
        api.getSettings(),
        api.getPresets()
      ]);
      setRules(rList || []);
      setJournal(jList || []);
      if (status) {
        setIsRunning(status.isRunning);
        setProcessedCount(status.processedCount);
      }
      setSettings(setts || null);
      setPresets(prs || []);
    } catch (err) {
      console.error('Error loading app data:', err);
    }
  };

  useEffect(() => {
    loadAllData();
    const interval = setInterval(() => {
      loadAllData();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleEngine = async () => {
    if (!api) return;
    const nextState = !isRunning;
    const updated = await api.toggleEngine(nextState);
    setIsRunning(updated);
  };

  const handleSaveRule = async (ruleToSave: Rule) => {
    if (!api) return;
    await api.saveRule(ruleToSave);
    setIsBuildingRule(false);
    setEditingRule(null);
    loadAllData();
  };

  const handleDeleteRule = async (id: string) => {
    if (!api) return;
    await api.deleteRule(id);
    loadAllData();
  };

  const handleSelectFolderToWatch = async (ruleId: string) => {
    if (!api) return;
    const folder = await api.selectFolder();
    if (folder) {
      const rule = rules.find(r => r.id === ruleId);
      if (rule && !rule.monitoredFolders.includes(folder)) {
        const updatedRule = {
          ...rule,
          monitoredFolders: [...rule.monitoredFolders, folder]
        };
        await api.saveRule(updatedRule);
        loadAllData();
      }
    }
  };

  const handleImportPreset = async (preset: Rule) => {
    const newRule: Rule = {
      ...preset,
      id: 'rule_' + Date.now(),
      name: preset.name,
      stats: { timesTriggered: 0, lastTriggered: null }
    };
    await api.saveRule(newRule);
    loadAllData();
    setActiveTab('rules');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col antialiased selection:bg-indigo-500 selection:text-white">
      <Navbar
        isRunning={isRunning}
        onToggleEngine={handleToggleEngine}
        processedCount={processedCount}
        activeRulesCount={rules.filter(r => r.enabled).length}
      />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setIsBuildingRule(false);
            setEditingRule(null);
            setActiveTab(tab);
          }}
          onOpenPresets={() => setIsPresetModalOpen(true)}
        />

        <main className="flex-1 p-6 overflow-y-auto max-w-6xl mx-auto w-full">
          {isBuildingRule ? (
            <RuleBuilder
              initialRule={editingRule}
              onSaveRule={handleSaveRule}
              onCancel={() => {
                setIsBuildingRule(false);
                setEditingRule(null);
              }}
              onSelectFolder={() => api.selectFolder()}
            />
          ) : (
            <>
              {activeTab === 'dashboard' && (
                <Dashboard
                  rules={rules}
                  journal={journal}
                  onAddNewRule={() => {
                    setEditingRule(null);
                    setIsBuildingRule(true);
                  }}
                  onSelectFolderToWatch={handleSelectFolderToWatch}
                  onOpenPresets={() => setIsPresetModalOpen(true)}
                />
              )}

              {activeTab === 'rules' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <SlidersHorizontal className="w-5 h-5 text-indigo-400" />
                        <span>Rule Management Engine</span>
                      </h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Configure conditional filters and target actions for monitored directories.
                      </p>
                    </div>

                    <button
                      onClick={() => {
                        setEditingRule(null);
                        setIsBuildingRule(true);
                      }}
                      className="glow-btn px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-indigo-500/25"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create New Rule</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    {rules.length === 0 ? (
                      <div className="p-12 text-center glass-panel rounded-2xl space-y-3">
                        <SlidersHorizontal className="w-10 h-10 text-slate-600 mx-auto" />
                        <p className="text-sm font-semibold text-slate-300">No rules yet, so nothing is being sorted.</p>
                        <p className="text-xs text-slate-400 max-w-md mx-auto">
                          Start with a preset. You will choose which folder to watch and where the sorted files should go before anything moves.
                        </p>
                        <button
                          onClick={() => setIsPresetModalOpen(true)}
                          className="px-4 py-2 rounded-xl bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-semibold"
                        >
                          Browse Preset Rules
                        </button>
                      </div>
                    ) : (
                      rules.map((rule) => (
                        <div
                          key={rule.id}
                          className="p-5 rounded-2xl glass-panel hover:border-slate-700 transition-all space-y-4"
                        >
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-3">
                                <h3 className="font-bold text-sm text-white">{rule.name}</h3>
                                <span
                                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                                    rule.enabled
                                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-slate-800 text-slate-400'
                                  }`}
                                >
                                  {rule.enabled ? 'Active' : 'Disabled'}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">
                                Triggered <span className="text-indigo-400 font-semibold">{rule.stats.timesTriggered}</span> times
                              </p>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setEditingRule(rule);
                                  setIsBuildingRule(true);
                                }}
                                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white transition-colors"
                                title="Edit Rule"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
                                title="Delete Rule"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                              <p className="font-semibold text-indigo-400 text-[11px]">IF Conditions ({rule.matchType})</p>
                              {rule.conditions.map((c, i) => (
                                <p key={i} className="text-slate-300 font-mono text-[11px]">
                                  • {c.field} {c.operator} "{c.value}"
                                </p>
                              ))}
                            </div>

                            <div className="p-3 rounded-xl bg-slate-900/60 border border-slate-800/80 space-y-1">
                              <p className="font-semibold text-cyan-400 text-[11px]">THEN Actions</p>
                              {rule.actions.map((a, i) => (
                                <p key={i} className="text-slate-300 text-[11px]">
                                  • {a.type.toUpperCase()}: {a.destination || a.pattern || a.notifyMessage || 'Recycle Bin'}
                                </p>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {activeTab === 'simulator' && (
                <DryRunSimulator
                  rules={rules}
                  onSelectFolder={() => api.selectFolder()}
                  onRunDryRun={(folder) => api.dryRun(folder, rules)}
                />
              )}

              {activeTab === 'undo' && (
                <UndoCenter
                  journal={journal}
                  onUndoEntry={(id) => api.undoJournalEntry(id)}
                  onUndoRule={(ruleId) => api.undoRule(ruleId)}
                  onRefresh={loadAllData}
                />
              )}

              {activeTab === 'settings' && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="p-6 rounded-2xl glass-panel space-y-6">
                    <h2 className="text-lg font-bold text-white">Application Settings</h2>
                    <div className="space-y-4 max-w-lg">
                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                        <div>
                          <p className="text-xs font-semibold text-white">Start on Windows Startup</p>
                          <p className="text-[11px] text-slate-400">Launch in the tray when you sign in, so folders keep getting sorted</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings?.startOnBoot ?? true}
                          onChange={async (e) => {
                            if (api) setSettings(await api.saveSettings({ startOnBoot: e.target.checked }));
                          }}
                          className="w-4 h-4 accent-indigo-500"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                        <div>
                          <p className="text-xs font-semibold text-white">Minimize to Tray on Close</p>
                          <p className="text-[11px] text-slate-400">Keep file watcher running in background tray</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings?.minimizeToTray ?? true}
                          onChange={(e) => {
                            if (api) api.saveSettings({ minimizeToTray: e.target.checked });
                          }}
                          className="w-4 h-4 accent-indigo-500"
                        />
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-xl bg-slate-900/60 border border-slate-800">
                        <div>
                          <p className="text-xs font-semibold text-white">Windows Native Notifications</p>
                          <p className="text-[11px] text-slate-400">Show desktop toast when rules execute</p>
                        </div>
                        <input
                          type="checkbox"
                          checked={settings?.showNotifications ?? true}
                          onChange={(e) => {
                            if (api) api.saveSettings({ showNotifications: e.target.checked });
                          }}
                          className="w-4 h-4 accent-indigo-500"
                        />
                      </div>

                      <div className="pt-4 border-t border-slate-800/80">
                        <p className="text-xs text-slate-500">App Name: Subyabastha (फाइल सुव्यवस्था)</p>
                        <p className="text-xs text-slate-500">Author & Creator: Aashutosh</p>
                        <p className="text-xs text-slate-500">Build Version: v1.0.0 (x64)</p>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <PresetModal
        isOpen={isPresetModalOpen}
        onClose={() => setIsPresetModalOpen(false)}
        presets={presets}
        onImportPreset={handleImportPreset}
        onSelectFolder={() => api.selectFolder()}
      />
    </div>
  );
}
