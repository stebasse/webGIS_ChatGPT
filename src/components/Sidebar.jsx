import React from 'react';

const Sidebar = ({ title, children, isOpen, onClose }) => {
  return (
    <aside className={`fixed top-0 right-0 h-full w-[min(100vw,26rem)] glass border-l border-white/5 p-4 sm:p-6 lg:p-8 transition-transform duration-500 ease-in-out z-40 ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <div className="flex justify-between items-center mb-10">
        <h2 className="text-xl font-bold tracking-tight text-white uppercase tracking-widest">{title}</h2>
        <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg text-slate-400 hover:text-white">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="responsive-panel-scroll h-[calc(100%-80px)] space-y-6 lg:space-y-8 pr-1 sm:pr-2">
        {children}
      </div>
    </aside>
  );
};

export default Sidebar;
