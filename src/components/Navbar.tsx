import React from 'react';
import { UploadCloud, CalendarDays, Link2, Sparkles } from 'lucide-react';
import { hapticFeedback } from '../lib/telegram';

export type TabType = 'upload' | 'calendar' | 'integrations' | 'presets';

interface NavbarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  scheduledCount: number;
}

export const Navbar: React.FC<NavbarProps> = ({ activeTab, onTabChange, scheduledCount }) => {
  const tabs = [
    {
      id: 'upload' as TabType,
      label: 'Upload',
      icon: UploadCloud,
    },
    {
      id: 'calendar' as TabType,
      label: 'Calendar',
      icon: CalendarDays,
      badge: scheduledCount > 0 ? scheduledCount : undefined,
    },
    {
      id: 'integrations' as TabType,
      label: 'Integrations',
      icon: Link2,
    },
    {
      id: 'presets' as TabType,
      label: 'Presets',
      icon: Sparkles,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-[#17212B] border-t border-[#242F3D] px-4 sm:px-12 py-2 pb-safe">
      <div className="max-w-md mx-auto grid grid-cols-4 gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => {
                hapticFeedback.selection();
                onTabChange(tab.id);
              }}
              className={`relative flex flex-col items-center justify-center py-2 px-1 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'text-[#3390EC]'
                  : 'text-[#708499] hover:text-white'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 transition-transform ${isActive ? 'scale-110 stroke-[2.2]' : 'stroke-[1.8]'}`} />
                {tab.badge !== undefined && (
                  <span className="absolute -top-1.5 -right-2.5 bg-[#3390EC] text-white text-[10px] font-bold px-1.5 py-0.2 rounded-full min-w-[16px] text-center border-2 border-[#17212B] shadow-sm">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-widest mt-1.5 ${isActive ? 'text-[#3390EC]' : 'text-[#708499]'}`}>
                {tab.label}
              </span>
              {isActive && (
                <div className="w-1.5 h-1.5 bg-[#3390EC] rounded-full mt-1" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
