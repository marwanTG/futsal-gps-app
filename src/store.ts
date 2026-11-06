// Local persistence in IndexedDB. Nothing leaves the device.

import { openDB, type IDBPDatabase } from 'idb';
import type { MatchSettings, ParsedTrack, PlayerProfile, Thresholds } from './analysis/types';

export interface Venue { name: string; bearing: number }

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  dbp ??= openDB('futsal-gps', 1, {
    upgrade(d) {
      d.createObjectStore('tracks', { keyPath: 'id' });
      d.createObjectStore('settings');
      d.createObjectStore('meta');
    },
  });
  return dbp;
}

async function safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch { return fallback; }
}

export const store = {
  loadTracks: () => safe(async () => (await (await db()).getAll('tracks')) as ParsedTrack[], []),
  saveTrack: (t: ParsedTrack) => safe(async () => { await (await db()).put('tracks', t); }, undefined),
  deleteTrack: (id: string) => safe(async () => { const d = await db(); await d.delete('tracks', id); await d.delete('settings', id); }, undefined),
  loadSettings: () => safe(async () => {
    const d = await db();
    const keys = (await d.getAllKeys('settings')) as string[];
    const vals = (await d.getAll('settings')) as MatchSettings[];
    return Object.fromEntries(keys.map((k, i) => [k, vals[i]])) as Record<string, MatchSettings>;
  }, {} as Record<string, MatchSettings>),
  saveSettings: (id: string, s: MatchSettings) => safe(async () => { await (await db()).put('settings', s, id); }, undefined),
  getMeta: <T>(key: string) => safe(async () => (await (await db()).get('meta', key)) as T | undefined, undefined),
  setMeta: (key: string, v: unknown) => safe(async () => { await (await db()).put('meta', v, key); }, undefined),
};

export type { Thresholds, PlayerProfile };
