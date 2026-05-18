import React from 'react';
import { t } from '../i18n';

const MapOverlay = ({ language = 'it' }) => {
  return (
    <div className="absolute top-8 left-8 flex flex-col gap-4 pointer-events-none">
      <div className="glass px-6 py-4 rounded-3xl pointer-events-auto">
        <h1 className="text-lg font-bold text-white tracking-tight">{t(language, 'mapEngine')}</h1>
        <p className="text-[10px] text-primary font-bold uppercase tracking-[0.2em] mt-1">{t(language, 'statusOperational')}</p>
      </div>
      
      <div className="glass p-4 rounded-2xl pointer-events-auto space-y-2">
        <div className="flex justify-between items-center gap-8">
          <span className="text-[10px] font-bold text-slate-500 uppercase">{t(language, 'latitude')}</span>
          <span className="text-xs font-mono text-white">45.4642° N</span>
        </div>
        <div className="flex justify-between items-center gap-8">
          <span className="text-[10px] font-bold text-slate-500 uppercase">{t(language, 'longitude')}</span>
          <span className="text-xs font-mono text-white">9.1900° E</span>
        </div>
        <div className="pt-2 border-t border-white/5 flex items-center gap-2">
           <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div>
           <span className="text-[10px] font-bold text-emerald-500 uppercase">{t(language, 'highPrecisionGps')}</span>
        </div>
      </div>
    </div>
  );
};

export default MapOverlay;
