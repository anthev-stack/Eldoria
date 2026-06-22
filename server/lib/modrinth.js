import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getModrinthInstanceMeta } from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const MODRINTH_DOWNLOAD_DIR = path.join(__dirname, '..', 'data', 'downloads');
export const MODRINTH_STORED_FILE = path.join(MODRINTH_DOWNLOAD_DIR, 'eldoria-instance.mrpack');

const ALLOWED_EXT = /\.(mrpack|zip)$/i;

export function isAllowedModrinthFilename(name) {
  return ALLOWED_EXT.test(String(name ?? ''));
}

export function ensureDownloadDir() {
  fs.mkdirSync(MODRINTH_DOWNLOAD_DIR, { recursive: true });
}

export function modrinthFileExists() {
  return fs.existsSync(MODRINTH_STORED_FILE);
}

export function saveModrinthFile(buffer) {
  ensureDownloadDir();
  fs.writeFileSync(MODRINTH_STORED_FILE, buffer);
}

export function deleteModrinthFile() {
  if (modrinthFileExists()) {
    fs.unlinkSync(MODRINTH_STORED_FILE);
  }
}

export function getPublicModrinthInfo() {
  const meta = getModrinthInstanceMeta();
  const hasFile = modrinthFileExists();

  if (hasFile) {
    return {
      available: true,
      source: 'upload',
      downloadUrl: '/api/modrinth/download',
      filename: meta?.originalName ?? 'eldoria-instance.mrpack',
      size: meta?.size ?? null,
      updatedAt: meta?.uploadedAt ?? null,
    };
  }

  if (meta?.externalUrl) {
    return {
      available: true,
      source: 'url',
      downloadUrl: meta.externalUrl,
      filename: null,
      size: null,
      updatedAt: meta?.updatedAt ?? null,
    };
  }

  return {
    available: false,
    source: null,
    downloadUrl: null,
    filename: null,
    size: null,
    updatedAt: null,
  };
}
