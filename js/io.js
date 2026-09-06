/**
 * Export / import assembly configuration as JSON.
 */

import { deserializeAssembly, serializeAssembly } from './models.js';

export function exportAssembly(assembly) {
  const blob = new Blob([serializeAssembly(assembly)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(assembly.name || 'assembly')}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importAssembly(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(deserializeAssembly(reader.result));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

function sanitizeFilename(name) {
  return name.replace(/[^a-z0-9_-]/gi, '_').toLowerCase();
}

export function encodeAssemblyToUrl(assembly) {
  const json = serializeAssembly(assembly);
  const encoded = btoa(unescape(encodeURIComponent(json)));
  return `${location.origin}${location.pathname}#config=${encoded}`;
}

export function decodeAssemblyFromUrl() {
  const hash = location.hash.slice(1);
  const match = hash.match(/^config=(.+)$/);
  if (!match) return null;
  try {
    const json = decodeURIComponent(escape(atob(match[1])));
    return deserializeAssembly(json);
  } catch {
    return null;
  }
}
