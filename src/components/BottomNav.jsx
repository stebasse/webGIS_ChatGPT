import React from 'react';

const BottomNav = ({ activeTab, setActiveTab, onExport, selectedLayer, onAddFeature }) => {
  const tabs = [
    { id: 'explore', label: 'Esplora', icon: 'M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7' },
    { id: 'add-feature', label: 'Add Geom', icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0', isAction: true, special: true },
    { id: 'data-table', label: 'Data', icon: 'M4 6h16M4 12h16M4 18h16' },
    { id: 'settings', label: 'Settings', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z' }
  ];

  return (
    <nav className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom,0px))] sm:bottom-6 left-1/2 -translate-x-1/2 glass rounded-[1.5rem] sm:rounded-[2rem] px-1.5 sm:px-2 py-1.5 sm:py-2 flex gap-0.5 sm:gap-1 z-50 max-w-[calc(100vw-2rem)]">
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => {
            if (tab.id === 'add-feature') onAddFeature();
            else setActiveTab(tab.id);
          }}
          className={`px-2 sm:px-4 py-3 sm:py-4 rounded-[1rem] sm:rounded-[1.5rem] transition-all duration-300 flex items-center justify-center gap-1.5 sm:gap-2
            ${activeTab === tab.id 
              ? 'bg-primary text-white shadow-[0_10px_20px_rgba(0,191,255,0.3)]' 
              : tab.special
                ? 'bg-primary/20 text-primary border border-primary/30 hover:bg-primary/40 hover:text-white shadow-[0_0_15px_rgba(0,191,255,0.2)]'
                : 'text-slate-400 hover:text-white hover:bg-white/10'
            }
          `}
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d={tab.icon} />
          </svg>
          {(activeTab === tab.id || tab.isAction) && (
            <span className="font-bold text-[9px] sm:text-[10px] uppercase tracking-wider hidden xs:inline sm:inline">{tab.label}</span>
          )}
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;
