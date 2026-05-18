export const isSecureFileSystemContext = () => (
  typeof window !== 'undefined' && (window.isSecureContext || window.location?.protocol === 'http:' || window.location?.hostname === 'localhost')
);

export const canChooseDirectory = () => (
  typeof window !== 'undefined' &&
  typeof window.showDirectoryPicker === 'function' &&
  isSecureFileSystemContext()
);

export const canChooseOutputFile = () => (
  typeof window !== 'undefined' &&
  typeof window.showSaveFilePicker === 'function' &&
  isSecureFileSystemContext()
);

export const requestReadWritePermission = async (handle) => {
  if (!handle) return false;
  if (typeof handle.queryPermission === 'function') {
    const current = await handle.queryPermission({ mode: 'readwrite' });
    if (current === 'granted') return true;
  }
  if (typeof handle.requestPermission === 'function') {
    const requested = await handle.requestPermission({ mode: 'readwrite' });
    return requested === 'granted';
  }
  return true;
};

export const chooseWritableDirectory = async () => {
  if (!canChooseDirectory()) return null;
  const handle = await window.showDirectoryPicker({ mode: 'readwrite', startIn: 'downloads' });
  const granted = await requestReadWritePermission(handle);
  if (!granted) throw new Error('Permesso di scrittura non concesso per la cartella selezionata.');
  return handle;
};

export const chooseWritableFile = async ({ suggestedName, description = 'Output file', accept }) => {
  if (!canChooseOutputFile()) return null;
  const handle = await window.showSaveFilePicker({
    suggestedName,
    types: [{ description, accept }],
    excludeAcceptAllOption: false,
    startIn: 'downloads',
  });
  const granted = await requestReadWritePermission(handle);
  if (!granted) throw new Error('Permesso di scrittura non concesso per il file selezionato.');
  return handle;
};

export const writeTextToDirectory = async (directoryHandle, fileName, fileContent, fileMime = 'text/plain') => {
  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([fileContent], { type: fileMime }));
  await writable.close();
};

export const writeTextToFileHandle = async (fileHandle, fileContent, fileMime = 'text/plain') => {
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([fileContent], { type: fileMime }));
  await writable.close();
};

export const fileSystemUnavailableMessage = 'La scelta diretta della cartella non è supportata da questo browser/WebView. Usa Chrome/Edge desktop in HTTPS oppure il salvataggio file/download standard.';
