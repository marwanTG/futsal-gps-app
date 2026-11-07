import { createContext, useContext } from 'react';
import type { MatchAnalysis, MatchSettings, ParsedTrack, PlayerProfile, Sprint, Thresholds } from '../analysis/types';
import type { Venue } from '../store';
import type { Account, SyncState } from '../cloud';

export interface AppCtx {
  tracks: ParsedTrack[];
  settings: Record<string, MatchSettings>;
  setSetting: (id: string, patch: Partial<MatchSettings>) => void;
  analyses: MatchAnalysis[];
  selected: MatchAnalysis | null;
  selectedId: string | null;
  setSelectedId: (id: string) => void;
  thresholds: Thresholds;
  setThresholds: (t: Thresholds) => void;
  profile: PlayerProfile;
  setProfile: (p: PlayerProfile) => void;
  venues: Venue[];
  includeUnconfirmed: boolean;
  setIncludeUnconfirmed: (v: boolean) => void;
  /** Matches that may be used for directional stats. */
  dirMatches: MatchAnalysis[];
  openSprint: (s: Sprint) => void;
  highlightSprint: string | null;
  addFiles: (files: File[]) => Promise<void>;
  openWizard: (id: string) => void;
  goMatches: () => void;
  goField: () => void;
  /** Opens the system file picker for GPX files. */
  pickFiles: () => void;
  removeTrack: (id: string) => void;
  /** Online account (null = this phone only). */
  account: Account | null;
  syncState: SyncState;
  signIn: (a: Account) => Promise<void>;
  /** Resolves false when unsaved changes could not be sent (no internet). */
  signOut: () => Promise<boolean>;
}

export const Ctx = createContext<AppCtx>(null as unknown as AppCtx);
export const useApp = () => useContext(Ctx);
export const sprintKey = (s: Sprint) => `${s.matchId}-${s.index}`;
