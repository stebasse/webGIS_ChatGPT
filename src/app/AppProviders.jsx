import { ProjectProvider } from '../state/project/ProjectContext.jsx';
import { LayerProvider } from '../state/layer/LayerContext.jsx';
import { DrawingProvider } from '../state/drawing/DrawingContext.jsx';
import { HistoryProvider } from '../state/history/HistoryContext.jsx';

export default function AppProviders({ children }) {
  return (
    <ProjectProvider>
      <LayerProvider>
        <DrawingProvider>
          <HistoryProvider>{children}</HistoryProvider>
        </DrawingProvider>
      </LayerProvider>
    </ProjectProvider>
  );
}
