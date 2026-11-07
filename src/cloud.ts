// Online copy of each player's matches in Supabase, so data survives a wiped
// browser and opens on any phone through the player's personal link.
//
// The local IndexedDB copy (store.ts) stays the main copy: the app works the
// same with no internet, and cloud writes that fail are queued and retried.

import type { MatchSettings, ParsedTrack, PlayerProfile, Thresholds } from './analysis/types';
import { IN_ARTIFACT } from './env';

const BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** False in the claude.ai build and when no Supabase project is configured. */
export const CLOUD_ON = !IN_ARTIFACT && !!BASE && !!KEY;

export interface Account { token: string; name: string; email?: string | null }

export interface CloudData {
  name: string;
  email: string | null;
  matches: { id: string; track: ParsedTrack; settings: MatchSettings | null }[];
  meta: { profile?: Partial<PlayerProfile>; thresholds?: Partial<Thresholds> };
}

// ---------- Account kept in localStorage (the store.ts copy is a backup) ----------

const ACCOUNT_KEY = 'futsal-account';

export function readAccount(): Account | null {
  try { const v = localStorage.getItem(ACCOUNT_KEY); return v ? (JSON.parse(v) as Account) : null; } catch { return null; }
}
export function writeAccount(a: Account | null) {
  try { if (a) localStorage.setItem(ACCOUNT_KEY, JSON.stringify(a)); else localStorage.removeItem(ACCOUNT_KEY); } catch { /* ignore */ }
}

/** Token from a personal link (?p=...), if the page was opened through one. */
export function tokenFromUrl(): string | null {
  try {
    const p = new URLSearchParams(location.search).get('p');
    return p && /^[0-9a-f-]{36}$/i.test(p) ? p.toLowerCase() : null;
  } catch { return null; }
}

export function personalLink(token: string) {
  return `${location.origin}${location.pathname}?p=${token}`;
}

/** Puts the personal link in the address bar, so a bookmark or home-screen icon keeps it. */
export function showLinkInAddressBar(token: string) {
  try { history.replaceState(null, '', personalLink(token)); } catch { /* ignore */ }
}

// ---------- Low-level calls ----------

async function call<T>(path: string, body: unknown, bearer?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    // New "sb_publishable_" keys go only in apikey; a user login goes in Authorization.
    headers: { apikey: KEY!, 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { const j = JSON.parse(text); msg = j.msg ?? j.message ?? j.error_description ?? text; } catch { /* keep text */ }
    throw new Error(msg || `HTTP ${res.status}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}
const rpc = <T>(fn: string, args: object, bearer?: string) => call<T>(`/rest/v1/rpc/${fn}`, args, bearer);

// ---------- Sign up / sign in ----------

export async function signUpByName(name: string): Promise<Account> {
  const token = await rpc<string>('create_player', { p_name: name.trim() });
  return { token, name: name.trim() };
}

const PENDING_NAME = 'futsal-pending-name';

/**
 * Emails a sign-in link (Supabase creates the login if new). Tapping it opens
 * the app with the login in the URL, handled by finishLoginFromUrl().
 * The typed name is kept here in case the link opens in this same browser.
 */
export async function sendEmailLink(email: string, name: string) {
  try { localStorage.setItem(PENDING_NAME, name.trim()); } catch { /* ignore */ }
  const back = `${location.origin}${location.pathname}`;
  await call(`/auth/v1/otp?redirect_to=${encodeURIComponent(back)}`, { email: email.trim(), create_user: true });
}

async function playerForLogin(accessToken: string, name = ''): Promise<Account> {
  const rows = await rpc<{ token: string; name: string; email: string | null }[]>('email_player', { p_name: name.trim() }, accessToken);
  if (!rows?.length) throw new Error('no player');
  return { token: rows[0].token, name: rows[0].name, email: rows[0].email };
}

// ---------- Google (Gmail) sign-in ----------

/** Sends the page to Google; Supabase brings the player back here with a login in the URL. */
export function signInWithGoogle() {
  const back = `${location.origin}${location.pathname}`;
  location.href = `${BASE}/auth/v1/authorize?provider=google&redirect_to=${encodeURIComponent(back)}`;
}

/**
 * After the return from Google or from the email link: reads the login from
 * the URL (#access_token=...), removes it from the address bar, and finds or
 * creates the player. Returns null when the page was not opened that way.
 */
export async function finishLoginFromUrl(): Promise<Account | 'failed' | null> {
  const h = new URLSearchParams(location.hash.slice(1));
  const at = h.get('access_token');
  if (!at && !h.get('error')) return null;
  try { history.replaceState(null, '', `${location.pathname}${location.search}`); } catch { /* ignore */ }
  if (!at) return 'failed';
  let name = '';
  try { name = localStorage.getItem(PENDING_NAME) ?? ''; localStorage.removeItem(PENDING_NAME); } catch { /* ignore */ }
  try { return await playerForLogin(at, name); } catch { return 'failed'; }
}

/** Google blocks sign-in inside the Instagram / Facebook / TikTok built-in browsers. */
export const IN_APP_BROWSER = typeof navigator !== 'undefined'
  && /Instagram|FBAN|FBAV|FB_IAB|TikTok|musical_ly|Snapchat|Line\//i.test(navigator.userAgent);

export const pull = (token: string) => rpc<CloudData>('pull', { p_token: token });

// ---------- Writes with a retry queue ----------

type Job = (
  | { kind: 'match'; id: string; withTrack: boolean }
  | { kind: 'delete'; id: string }
  | { kind: 'meta'; key: 'profile' | 'thresholds' }
) & { seq?: number };

const QUEUE_KEY = 'futsal-cloud-queue';
const jobKey = (j: Job) => (j.kind === 'meta' ? `meta:${j.key}` : `${j.kind}:${j.id}`);

function readQueue(): Job[] {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Job[]; } catch { return []; }
}
function writeQueue(q: Job[]) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(q)); } catch { /* ignore */ }
}
export function clearQueue() { writeQueue([]); }

/** Ids that have local changes not yet saved online (cloud must not overwrite them). */
export function pendingIds(): Set<string> {
  return new Set(readQueue().map(jobKey));
}

/** Reads the current local values when a job runs, so a retry always sends the latest. */
export interface LocalSource {
  track: (id: string) => Promise<ParsedTrack | undefined>;
  settings: (id: string) => Promise<MatchSettings | undefined>;
  profile: () => Promise<PlayerProfile | undefined>;
  thresholds: () => Promise<Thresholds | undefined>;
}

export type SyncState = 'off' | 'saving' | 'ok' | 'offline';

export class Sync {
  private timers = new Map<string, number>();
  private running = false;
  constructor(private token: string, private src: LocalSource, private onState: (s: SyncState) => void) {}

  /** Queue a job. Settings edits are delayed 1.5 s so fast slider moves send once. */
  push(job: Job, delayMs = 0) {
    const k = jobKey(job);
    const old = readQueue();
    // keep "with track" if an earlier upload of this match has not gone out yet
    if (job.kind === 'match' && old.some((j) => jobKey(j) === k && j.kind === 'match' && j.withTrack)) job = { ...job, withTrack: true };
    const delId = job.kind === 'delete' ? job.id : null;
    // drop the older copy of this job; a delete also cancels a pending upload of the same match
    const kept = old.filter((j) => jobKey(j) !== k && !(delId && j.kind === 'match' && j.id === delId));
    writeQueue([...kept, { ...job, seq: Date.now() + Math.random() }]);
    this.onState('saving');
    clearTimeout(this.timers.get(k));
    this.timers.set(k, window.setTimeout(() => this.flush(), delayMs));
  }

  /** Sends every queued job in order. Stops at the first failure and keeps the rest. */
  async flush() {
    if (this.running) return;
    this.running = true;
    try {
      let q = readQueue();
      while (q.length) {
        const job = q[0];
        await this.run(job);
        // drop exactly the job we sent; a newer copy queued meanwhile stays
        const now = readQueue();
        const i = now.findIndex((j) => j.seq === job.seq && jobKey(j) === jobKey(job));
        if (i >= 0) now.splice(i, 1);
        writeQueue(now);
        q = now;
      }
      this.onState('ok');
    } catch {
      this.onState('offline');
    } finally {
      this.running = false;
    }
  }

  private async run(job: Job) {
    const t = this.token;
    if (job.kind === 'delete') return rpc('delete_match', { p_token: t, p_id: job.id });
    if (job.kind === 'meta') {
      const value = job.key === 'profile' ? { ...(await this.src.profile()), healthNotes: undefined } : await this.src.thresholds();
      if (!value) return;
      return rpc('save_meta', { p_token: t, p_key: job.key, p_value: value });
    }
    const track = job.withTrack ? await this.src.track(job.id) : undefined;
    if (job.withTrack && !track) return; // removed locally before it went out
    return rpc('save_match', { p_token: t, p_id: job.id, p_track: track ?? null, p_settings: (await this.src.settings(job.id)) ?? null });
  }
}
