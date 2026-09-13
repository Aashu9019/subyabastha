import React from 'react';
import { 
  LayoutDashboard, 
  SlidersHorizontal, 
  FlaskConical, 
  History, 
  Settings, 
  Sparkles
} from 'lucide-react';

export type TabType = 'dashboard' | 'rules' | 'simulator' | 'undo' | 'settings';

interface SidebarProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
  onOpenPresets: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  onOpenPresets
}) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'rules', label: 'Rules Engine', icon: SlidersHorizontal },
    { id: 'simulator', label: 'Dry-Run Simulator', icon: FlaskConical },
    { id: 'undo', label: '1-Click Undo Center', icon: History },
    { id: 'settings', label: 'App Settings', icon: Settings },
  ];

  return (
    <aside className="w-60 border-r border-slate-800/80 bg-slate-950/60 p-3.5 flex flex-col justify-between select-none shrink-0">
      <div className="space-y-6">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as TabType)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60 border border-transparent'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-400' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Preset Rules Card */}
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2.5">
          <div className="flex items-center gap-2 text-slate-200 font-semibold text-xs">
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Preset Templates</span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Import 1-click rules for clean downloads, invoices, and photos.
          </p>
          <button
            onClick={onOpenPresets}
            className="w-full py-1.5 px-3 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-semibold transition-all"
          >
            Browse Presets
          </button>
        </div>
      </div>

      {/* Clean Footer */}
      <div className="pt-3 border-t border-slate-800/80 text-center">
        <p className="text-[11px] font-medium text-slate-400">SuByabastha Pro</p>
        <p className="text-[10px] text-slate-500">by Aashutosh</p>
      </div>
    </aside>
  );
};
