import * as SQLite from 'expo-sqlite';

import { SiteVersion, VERSION_STORAGE_KEY } from './siteVersion';

/**
 * Deliberately a separate database file from lib/database.native.ts's
 * tracker.db: this read must not be ordered behind initDatabase(), and a
 * future "clear my data" action should be free to drop the user's tracking
 * data without also forgetting which version of the site they prefer.
 */
let db: SQLite.SQLiteDatabase | null = null;
let cached: SiteVersion | null = null;

function isVersion(v: unknown): v is SiteVersion {
  return v === 'v2' || v === 'legacy';
}

function open(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('prefs.db');
    db.execSync('CREATE TABLE IF NOT EXISTS prefs (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  }
  return db;
}

/** Answers from the module cache, so it returns null until hydrate() has run. */
export function getVersionSync(): SiteVersion | null {
  return cached;
}

export async function getVersion(): Promise<SiteVersion | null> {
  try {
    const row = open().getFirstSync(
      'SELECT value FROM prefs WHERE key = ?',
      [VERSION_STORAGE_KEY]
    ) as { value: string } | null;
    cached = isVersion(row?.value) ? (row!.value as SiteVersion) : null;
  } catch {
    cached = null;
  }
  return cached;
}

export async function setVersion(v: SiteVersion): Promise<void> {
  cached = v;
  try {
    open().runSync(
      'INSERT INTO prefs (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [VERSION_STORAGE_KEY, v]
    );
  } catch {
    // Preference just won't survive a relaunch.
  }
}

/** Populates the cache once at startup so getVersionSync() can answer instantly. */
export async function hydrateVersionPreference(): Promise<void> {
  await getVersion();
}
