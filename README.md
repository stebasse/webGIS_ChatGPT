# WebGIS ChatGPT

WebGIS ChatGPT è una web app GIS mobile-first sviluppata con React, Vite e Leaflet. L'obiettivo è offrire uno strumento leggero per creare layer vettoriali, raccogliere geometrie sul campo, gestire CRS, consultare attributi ed esportare dati direttamente dal browser, anche su Android.

## Stato del progetto

Questa versione corrisponde al pacchetto di lavoro `webgis_app_latest.zip`.

Funzionalità principali disponibili:

- mappa interattiva Leaflet;
- sidebar TOC/layer list;
- creazione layer vettoriali;
- import di layer esistenti;
- layer attivo selezionabile;
- disegno di punti, linee, poligoni e mano libera;
- inserimento manuale di coordinate;
- gestione CRS progetto e CRS layer;
- trasformazione coordinate tramite proj4 quando disponibile;
- tabella attributi;
- export GeoJSON, JSON e CSV;
- salvataggio tramite File System Access API quando supportata;
- fallback con download browser quando il browser non permette accesso diretto al filesystem;
- interfaccia bilingue italiano/inglese;
- tema chiaro/scuro;
- smoke test automatico;
- build Vite pronta per deploy Vercel.

## Stack tecnico

- React 19
- Vite
- Leaflet
- React-Leaflet
- Proj4
- Proj4Leaflet
- Tailwind CSS v4
- Lucide React

## Struttura del progetto

```text
src/
├── app/
│   ├── AppProviders.jsx
│   └── viewRegistry.jsx
├── components/
│   ├── BottomNav.jsx
│   ├── MapOverlay.jsx
│   ├── OnboardingGuide.jsx
│   ├── Sidebar.jsx
│   └── Map/
├── config/
│   └── constants.js
├── domain/
│   └── gis/
│       ├── editingEngine.js
│       ├── featureEngine.js
│       ├── measurementEngine.js
│       ├── projectionEngine.js
│       ├── snapEngine.js
│       ├── spatialIndex.js
│       └── symbologyEngine.js
├── hooks/
├── infra/
│   ├── io/
│   └── storage/
├── map/
│   └── MapShell.jsx
├── services/
├── state/
│   ├── drawing/
│   ├── history/
│   ├── layer/
│   └── project/
├── views/
│   ├── AddDataMenu.jsx
│   ├── DataTableView.jsx
│   ├── ExploreHUD.jsx
│   ├── LayersView.jsx
│   ├── NewLayerView.jsx
│   ├── SettingsView.jsx
│   └── UploadView.jsx
├── App.jsx
├── i18n.js
├── index.css
└── main.jsx
```

## Installazione locale

Requisiti:

- Node.js 20 o superiore consigliato;
- npm.

Comandi:

```bash
npm install
npm run dev
```

La web app sarà disponibile sull'indirizzo mostrato da Vite, normalmente:

```text
http://localhost:5173
```

## Build produzione

```bash
npm run build
```

Il risultato viene generato nella cartella:

```text
dist/
```

## Test rapido

```bash
npm run smoke
```

Lo smoke test controlla che i file principali e la struttura base dell'app siano presenti e coerenti.

## Deploy consigliato

Workflow attuale:

1. scaricare o generare `webgis_app_latest.zip`;
2. decomprimere il pacchetto;
3. eseguire eventuale script/scorciatoia Termux;
4. fare push su GitHub;
5. lasciare che Vercel esegua il deploy automatico.

Repository di riferimento:

```text
stebasse/webGIS_ChatGPT
```

## Uso rapido

### Creare un layer

1. Aprire la TOC/layer list.
2. Toccare **Crea nuovo layer**.
3. Scegliere tipo geometria: punto, linea, poligono o tabella.
4. Inserire nome layer e schema attributi.
5. Scegliere destinazione output oppure lasciare il fallback download browser.
6. Toccare **Crea layer**.

Alla creazione viene mostrato un popup con il nome del layer e il percorso/target di salvataggio.

### Importare un layer

1. Aprire la TOC/layer list.
2. Toccare **Importa dati**.
3. Selezionare un file supportato.
4. Confermare CRS se non rilevato automaticamente.
5. Importare.

### Disegnare feature

1. Selezionare un layer attivo.
2. Aprire strumenti geometria.
3. Scegliere punto, linea, poligono o mano libera.
4. Toccare o trascinare sulla mappa.
5. Salvare/chiudere la feature quando richiesto.

### Esportare dati

1. Aprire la tabella attributi.
2. Filtrare il layer oppure lasciare **Tutti i layer**.
3. Toccare **Export**.
4. Scegliere nome file, formato, CRS e destinazione.
5. Confermare export.

Dopo l'export viene mostrato un popup con:

```text
Layer <nome> salvato al percorso <percorso>
```

## Note importanti su Android e browser mobile

Su Android il percorso reale del file può non essere visibile alla web app. Questo dipende dal browser e dalle limitazioni di sicurezza del sistema operativo.

Quando l'app mostra:

```text
Browser download/nome_file.geojson
```

significa che il file viene affidato al download standard del browser. Per trovarlo:

- aprire **File / Gestione file**;
- controllare **Download**;
- oppure aprire la cronologia download del browser.

La selezione diretta di una cartella è disponibile solo nei browser che supportano la File System Access API. In caso contrario viene usato il download browser.

## CRS

La web app gestisce:

- CRS progetto;
- CRS layer;
- CRS di export;
- trasformazioni coordinate se la definizione PROJ è disponibile.

EPSG comuni sono precaricati; altri CRS possono essere cercati o registrati quando disponibile.

## Export supportati

| Formato | Stato | Note |
|---|---:|---|
| GeoJSON | supportato | consigliato per uso GIS generico |
| JSON | supportato | struttura FeatureCollection |
| CSV | supportato | geometria serializzata in campo coordinate |
| KML | parziale | usato soprattutto in import/creazione iniziale |
| SHP | non diretto | richiede librerie dedicate o backend |
| GPKG | non diretto | richiede librerie dedicate o backend |
| GeoTIFF | non diretto | previsto per sviluppi futuri |

## Organizzazione del codice

La codebase è stata progressivamente separata in:

- componenti UI;
- view applicative;
- servizi browser/file;
- servizi GIS;
- dominio GIS puro;
- provider/reducer di stato;
- infrastruttura I/O.

`App.jsx` resta l'orchestratore principale, ma la logica è stata spostata progressivamente fuori dal componente monolitico.

## Roadmap tecnica

Priorità suggerite:

1. completare separazione `LayerManager` e `DrawingManager`;
2. introdurre undo/redo globale stabile;
3. aggiungere selezione feature sulla mappa;
4. aggiungere editing vertici;
5. introdurre snapping configurabile;
6. salvare e ricaricare progetto `.webgis`;
7. aggiungere simbologia avanzata e labeling;
8. migliorare import SHP/GPKG/GeoTIFF;
9. aggiungere test unitari sui servizi GIS;
10. aggiungere test E2E sui flussi principali.

## Script npm

```bash
npm run dev      # sviluppo locale
npm run build    # build produzione
npm run smoke    # controllo rapido struttura app
npm run lint     # lint, se configurato
```

## Troubleshooting

### Schermata nera o errore di avvio

L'app include un error boundary che mostra l'errore invece di lasciare una schermata nera. Usare il pulsante di cancellazione dati locali se lo stato salvato nel browser è corrotto.

### Non trovo il file esportato

Controllare:

- cartella Download del telefono;
- cronologia download del browser;
- eventuale cartella scelta tramite selettore file.

### Il browser non permette la scelta cartella

Non è un bug dell'app. Alcuni browser mobile non espongono la File System Access API. In quel caso WebGIS usa il download standard.

## Convenzione pacchetto

Ogni versione consegnata deve mantenere il nome:

```text
webgis_app_latest.zip
```

Questo evita confusione nel workflow Termux/GitHub/Vercel.
