import { lazy } from 'react';

export const LazyViews = {
  ExploreHUD: lazy(() => import('../views/ExploreHUD.jsx')),
  LayersView: lazy(() => import('../views/LayersView.jsx')),
  AddDataMenu: lazy(() => import('../views/AddDataMenu.jsx')),
  NewLayerView: lazy(() => import('../views/NewLayerView.jsx')),
  UploadView: lazy(() => import('../views/UploadView.jsx')),
  DataTableView: lazy(() => import('../views/DataTableView.jsx')),
  SettingsView: lazy(() => import('../views/SettingsView.jsx')),
};
