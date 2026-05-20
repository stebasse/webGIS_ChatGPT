import { t } from '../i18n';

export default function AddDataMenu({ setActiveTab, language = 'it' }) {
  return (
    <div className="app-page app-page-narrow justify-center animate-in fade-in duration-500 pointer-events-auto">
      <h2 className="text-3xl font-bold text-white uppercase tracking-[0.3em] mb-16">{t(language, 'addDataToProject')}</h2>
      <div className="flex gap-10">
         <button 
           onClick={() => setActiveTab('new-layer')}
           className="glass p-12 rounded-[3rem] border border-white/10 hover:border-primary transition-all group flex flex-col items-center gap-6"
         >
            <div className="w-20 h-20 bg-primary/10 rounded-[2rem] flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
               <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            </div>
            <div className="text-center">
               <h3 className="text-xl font-bold text-white uppercase tracking-widest">{t(language, 'createLayer')}</h3>
               <p className="text-[10px] text-slate-500 font-bold uppercase mt-2 tracking-widest">{t(language, 'defineNewVectorSchema')}</p>
            </div>
         </button>

         <button 
           onClick={() => setActiveTab('upload')}
           className="glass p-12 rounded-[3rem] border border-white/10 hover:border-primary transition-all group flex flex-col items-center gap-6"
         >
            <div className="w-20 h-20 bg-emerald-500/10 rounded-[2rem] flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
               <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            </div>
            <div className="text-center">
               <h3 className="text-xl font-bold text-white uppercase tracking-widest">{t(language, 'uploadLayer')}</h3>
               <p className="text-[10px] text-slate-500 font-bold uppercase mt-2 tracking-widest">{t(language, 'importShpKmlGeojson')}</p>
            </div>
         </button>
      </div>
      <button onClick={() => setActiveTab('layers')} className="mt-12 text-[10px] font-bold text-slate-500 uppercase tracking-[0.3em] hover:text-white transition-colors">{t(language, 'backToLayers')}</button>
    </div>
  );
}
