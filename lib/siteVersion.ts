import type { Href } from 'expo-router';

/**
 * Which build of the site the visitor is looking at.
 *
 * Deliberately dependency-free at runtime (the only import is a type, which is
 * erased) so this module can be imported from app/+html.tsx, which is rendered
 * by Node at export time and cannot pull in react-native or expo modules.
 */
export type SiteVersion = 'v2' | 'legacy';
export type VersionTab = 'setup' | 'track';

export const DEFAULT_VERSION: SiteVersion = 'v2';
export const VERSION_STORAGE_KEY = 'wohl.siteVersion';

export const OTHER: Record<SiteVersion, SiteVersion> = {
  v2: 'legacy',
  legacy: 'v2',
};

export const LABEL: Record<SiteVersion, string> = {
  v2: 'Modern',
  legacy: 'Original',
};

/**
 * Written as string literals rather than a template literal on purpose --
 * `/${v}` widens to `string`, which fails typed-route checking.
 */
export function hrefFor(v: SiteVersion, tab: VersionTab = 'setup'): Href {
  if (v === 'legacy') {
    return tab === 'track' ? '/legacy/track' : '/legacy';
  }
  return tab === 'track' ? '/track' : '/';
}

export function versionFromPath(pathname: string): SiteVersion {
  return pathname === '/legacy' || pathname.startsWith('/legacy/') ? 'legacy' : 'v2';
}

export function tabFromPath(pathname: string): VersionTab {
  // Trailing slash tolerated so this stays consistent with versionFromPath:
  // Cloudflare Pages 308s /legacy to /legacy/, so a trailing slash is a real
  // shape this can see, and it would otherwise drop the visitor on Setup.
  const normalized = pathname.replace(/\/+$/, '');
  return normalized.endsWith('/track') ? 'track' : 'setup';
}
