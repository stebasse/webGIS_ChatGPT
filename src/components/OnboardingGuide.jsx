import React, { useEffect, useMemo, useState } from 'react';

const STEPS = [
  {
    title: 'Benvenuto in WebGIS',
    text: 'Panoramica rapida degli strumenti principali prima di iniziare.',
    eyebrow: 'Passo 1 / 7',
    highlight: 'Navigazione inferiore',
    icon: 'M4 6h16M4 12h16M4 18h16'
  },
  {
    title: 'Modalità esplora',
    text: 'Muoviti nella mappa, attiva il GPS e ispeziona le geometrie.',
    eyebrow: 'Passo 2 / 7',
    highlight: 'Strumenti GPS, bussola e mappa base',
    icon: 'M12 2a7 7 0 017 7c0 5-7 13-7 13S5 14 5 9a7 7 0 017-7z'
  },
  {
    title: 'Layer',
    text: 'Crea, seleziona, attiva e gestisci i layer.',
    eyebrow: 'Passo 3 / 7',
    highlight: 'Sezione gestione layer',
    icon: 'M12 4l8 4-8 4-8-4 8-4zm0 8l8 4-8 4-8-4 8-4z'
  },
  {
    title: 'Aggiungi geometria',
    text: 'Usa + per acquisire punti o disegnare linee e poligoni.',
    eyebrow: 'Passo 4 / 7',
    highlight: 'Pulsante +, completa disegno e mano libera',
    icon: 'M12 5v14m7-7H5'
  },
  {
    title: 'Tabella dati',
    text: 'Visualizza, modifica ed esporta le feature raccolte.',
    eyebrow: 'Passo 5 / 7',
    highlight: 'Tabella attributi',
    icon: 'M4 6h16M4 10h16M4 14h16M4 18h16'
  },
  {
    title: 'Strumento misura',
    text: 'Misura distanze e aree direttamente sulla mappa.',
    eyebrow: 'Passo 6 / 7',
    highlight: 'Pulsante righello',
    icon: 'M3 17l6-6 4 4 8-8M5 19h14'
  },
  {
    title: 'Fatto',
    text: "Sei pronto per iniziare.",
    eyebrow: 'Passo 7 / 7',
    highlight: 'Inizia a esplorare',
    icon: 'M5 13l4 4L19 7'
  }
];

export default function OnboardingGuide({ onFinish }) {
  const [stepIndex, setStepIndex] = useState(0);
  const step = STEPS[stepIndex];
  const isFirst = stepIndex === 0;
  const isLast = stepIndex === STEPS.length - 1;

  const progress = useMemo(() => ((stepIndex + 1) / STEPS.length) * 100, [stepIndex]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onFinish();
      if (event.key === 'ArrowRight') setStepIndex(i => Math.min(STEPS.length - 1, i + 1));
      if (event.key === 'ArrowLeft') setStepIndex(i => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFinish]);

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6 bg-black/55 backdrop-blur-md pointer-events-auto animate-in">
      <div className="absolute inset-x-6 bottom-24 h-20 rounded-[2rem] border border-primary/50 bg-primary/10 shadow-[0_0_35px_rgba(0,191,255,0.35)] animate-pulse pointer-events-none hidden sm:block" />

      <div className="glass w-full max-w-lg rounded-[2rem] sm:rounded-[2.5rem] border border-white/20 shadow-2xl overflow-hidden">
        <div className="h-1 bg-white/10">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>

        <div className="p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-lg shadow-primary/10 flex-shrink-0">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={step.icon} />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-bold text-primary uppercase tracking-[0.25em] mb-2">{step.eyebrow}</p>
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight uppercase">{step.title}</h2>
            </div>
          </div>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed mb-5">{step.text}</p>

          <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 mb-6">
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest mb-1">In evidenza</p>
            <p className="text-xs font-bold text-white uppercase tracking-widest">{step.highlight}</p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              onClick={onFinish}
              className="px-4 py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white hover:bg-white/5 transition-all"
            >
              Salta
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setStepIndex(i => Math.max(0, i - 1))}
                disabled={isFirst}
                className="px-4 py-3 rounded-xl border border-white/10 text-[10px] font-bold uppercase tracking-widest text-white/70 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                Indietro
              </button>
              {isLast ? (
                <button
                  onClick={onFinish}
                  className="px-5 py-3 rounded-xl bg-primary text-white text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
                >
                  Inizia
                </button>
              ) : (
                <button
                  onClick={() => setStepIndex(i => Math.min(STEPS.length - 1, i + 1))}
                  className="px-5 py-3 rounded-xl bg-primary text-white text-[10px] font-bold uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-transform"
                >
                  Avanti
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
