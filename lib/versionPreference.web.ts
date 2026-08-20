import { SiteVersion, VERSION_STORAGE_KEY } from './siteVersion';

function isVersion(v: unknown): v is SiteVersion {
  return v === 'v2' || v === 'legacy';
}

/**
 * Synchronous on purpose. Every route is prerendered by Node during
 * `expo export`, so `window` may not exist; and localStorage may throw
 * outright when storage is blocked (Safari private browsing). Both cases
 * degrade to `null`, which callers read as "no stored preference".
 */
export function getVersionSync(): SiteVersion | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(VERSION_STORAGE_KEY);
    return isVersion(raw) ? raw : null;
  } catch {
    return null;
  }
}

export async function getVersion(): Promise<SiteVersion | null> {
  return getVersionSync();
}

export async function setVersion(v: SiteVersion): Promise<void> {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VERSION_STORAGE_KEY, v);
  } catch {
    // Storage blocked -- the switch still navigates, it just won't be remembered.
  }
}

/** No-op on web: getVersionSync already reads without awaiting anything. */
export async function hydrateVersionPreference(): Promise<void> {}
