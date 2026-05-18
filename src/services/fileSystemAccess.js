const isAbortError = (error) => error?.name === 'AbortError' || error?.code === 20;

export const isSecureFileSystemContext = () => (
  typeof window !== 'undefined' && Boolean(window.isSecureContext)
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

  try {
    if (typeof handle.queryPermission === 'function') {
      const current = await handle.queryPermission({ mode: 'readwrite' });
      if (current === 'granted') return true;
    }

    if (typeof handle.requestPermission === 'function') {
      const requested = await handle.requestPermission({ mode: 'readwrite' });
      return requested === 'granted';
    }
  } catch (error) {
    // Some WebViews expose the methods but throw when permission APIs are not fully implemented.
    console.warn('Permesso File System Access non verificabile:', error);
    return false;
  }

  return true;
};

export const chooseWritableDirectory = async () => {
  if (!canChooseDirectory()) return null;

  // Keep options minimal: several Chromium WebViews throw TypeError with startIn/mode.
  const handle = await window.showDirectoryPicker();
  const granted = await requestReadWritePermission(handle);
  if (!granted) {
    throw new Error('Permesso di scrittura non concesso per la cartella selezionata.');
  }
  return handle;
};

export const chooseWritableFile = async ({ suggestedName, description = 'Output file', accept } = {}) => {
  if (!canChooseOutputFile()) return null;

  const pickerOptions = {
    suggestedName,
    excludeAcceptAllOption: false,
  };

  if (accept && Object.keys(accept).length) {
    pickerOptions.types = [{ description, accept }];
  }

  // Do not pass startIn: it is unsupported in some WebViews and can make the button appear broken.
  const handle = await window.showSaveFilePicker(pickerOptions);
  const granted = await requestReadWritePermission(handle);
  if (!granted) {
    throw new Error('Permesso di scrittura non concesso per il file selezionato.');
  }
  return handle;
};

export const chooseOutputDirectory = async ({ suggestedName, description = 'Output file', accept } = {}) => {
  try {
    const directoryHandle = await chooseWritableDirectory();
    if (directoryHandle) {
      return {
        kind: 'directory',
        handle: directoryHandle,
        label: directoryHandle.name || 'Cartella selezionata',
      };
    }
  } catch (error) {
    if (isAbortError(error)) return null;
    console.warn('Selezione cartella non riuscita:', error);
  }

  try {
    const fileHandle = await chooseWritableFile({ suggestedName, description, accept });
    if (fileHandle) {
      return {
        kind: 'file',
        handle: fileHandle,
        label: fileHandle.name || suggestedName || 'File selezionato',
      };
    }
  } catch (error) {
    if (isAbortError(error)) return null;
    console.warn('Selezione file non riuscita:', error);
  }

  return {
    kind: 'download',
    handle: null,
    label: 'Download browser',
    unavailableReason: isSecureFileSystemContext()
      ? 'Il browser/WebView non espone un selettore di cartelle o file scrivibile.'
      : 'La scelta cartella richiede HTTPS oppure localhost.',
  };
};

export const chooseBestWritableTarget = chooseOutputDirectory;

export const writeTextToDirectory = async (directoryHandle, fileName, fileContent, fileMime = 'text/plain') => {
  if (!directoryHandle) throw new Error('Cartella di output non selezionata.');
  const granted = await requestReadWritePermission(directoryHandle);
  if (!granted) throw new Error('Permesso di scrittura non disponibile per la cartella selezionata.');

  const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([fileContent], { type: fileMime }));
  await writable.close();
};

export const writeTextToFileHandle = async (fileHandle, fileContent, fileMime = 'text/plain') => {
  if (!fileHandle) throw new Error('File di output non selezionato.');
  const granted = await requestReadWritePermission(fileHandle);
  if (!granted) throw new Error('Permesso di scrittura non disponibile per il file selezionato.');

  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([fileContent], { type: fileMime }));
  await writable.close();
};

export const downloadTextFileFallback = (filename, fileContent, fileMime = 'text/plain') => {
  if (typeof document === 'undefined') return;
  const blob = new Blob([fileContent], { type: fileMime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
};

export const fileSystemUnavailableMessage = 'Questo browser/WebView non permette a una web app di scegliere una cartella scrivibile. Verrà usato il salvataggio file, se disponibile, oppure il download standard.';
