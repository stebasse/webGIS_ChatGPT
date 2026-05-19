export function supportsFileSystemAccess() {
  return typeof window !== 'undefined' && 'showSaveFilePicker' in window && 'showOpenFilePicker' in window;
}

export async function saveTextFile({ suggestedName, text, mimeType = 'application/json' }) {
  if (supportsFileSystemAccess()) {
    const handle = await window.showSaveFilePicker({
      suggestedName,
      types: [{ description: mimeType, accept: { [mimeType]: [suggestedName.slice(suggestedName.lastIndexOf('.')) || '.json'] } }],
    });
    const writable = await handle.createWritable();
    await writable.write(new Blob([text], { type: mimeType }));
    await writable.close();
    return { handle };
  }
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = suggestedName;
  anchor.click();
  URL.revokeObjectURL(url);
  return { handle: null };
}
