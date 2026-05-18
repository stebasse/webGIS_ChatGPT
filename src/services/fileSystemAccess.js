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


export const chooseDirectoryLabelFallback = async () => new Promise((resolve) => {
  if (typeof document === 'undefined') {
    resolve(null);
    return;
  }
  const input = document.createElement('input');
  input.type = 'file';
  input.multiple = true;
  input.style.position = 'fixed';
  input.style.left = '-9999px';
  input.style.top = '-9999px';
  input.setAttribute('webkitdirectory', '');
  input.setAttribute('directory', '');

  const cleanup = () => {
    input.removeEventListener('change', onChange);
    input.removeEventListener('cancel', onCancel);
    if (input.parentNode) input.parentNode.removeChild(input);
  };
  const onCancel = () => {
    cleanup();
    resolve(null);
  };
  const onChange = () => {
    const file = input.files?.[0];
    const relativePath = file?.webkitRelativePath || file?.name || '';
    const folderName = relativePath.includes('/') ? relativePath.split('/')[0] : 'Cartella selezionata';
    cleanup();
    resolve({ kind: 'readonly-directory', name: folderName });
  };

  input.addEventListener('change', onChange, { once: true });
  input.addEventListener('cancel', onCancel, { once: true });
  document.body.appendChild(input);
  input.click();
});

export const downloadTextFileFallback = (filename, fileContent, fileMime = 'text/plain') => {
  if (typeof document === 'undefined') return;
  const blob = new Blob([fileContent], { type: fileMime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const fileSystemUnavailableMessage = 'La scelta diretta della cartella non è supportata da questo browser/WebView. Se disponibile verrà aperto un selettore cartella di sola lettura; il salvataggio userà il file picker o il download standard.';
