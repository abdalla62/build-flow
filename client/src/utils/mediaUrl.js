import { getApiBaseUrl } from '../lib/api';

/**
 * Build a browser URL for uploaded media paths like `/uploads/invoices/x.pdf`.
 * Absolute http(s) URLs are returned unchanged.
 */
export function mediaUrl(path) {
  if (!path) return '';
  const p = String(path).trim();
  if (!p) return '';
  if (/^https?:\/\//i.test(p)) return p;
  const normalized = p.startsWith('/') ? p : `/${p}`;
  const base = getApiBaseUrl();
  return base ? `${base}${normalized}` : normalized;
}

/** Open/download an uploaded file in a new tab (PDF opens in browser). */
export function openUploadedFile(path) {
  const url = mediaUrl(path);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}
