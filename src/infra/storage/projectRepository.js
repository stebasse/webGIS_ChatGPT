const AUTOSAVE_KEY = 'stitch_gis_project_autosave_v1';

export async function saveAutosave(projectDocument) {
  localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(projectDocument));
}

export async function loadAutosave() {
  const raw = localStorage.getItem(AUTOSAVE_KEY);
  return raw ? JSON.parse(raw) : null;
}

export async function clearAutosave() {
  localStorage.removeItem(AUTOSAVE_KEY);
}
