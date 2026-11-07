// Inline stroke icons (24×24). One file so every screen uses the same set.

const P = (d: string, size = 24, fill = false) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill={fill ? 'currentColor' : 'none'} stroke={fill ? 'none' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
);

export const Icon = {
  plus: (s = 28) => P('M12 5v14M5 12h14', s),
  cloud: (s = 24) => P('M7 18a4.5 4.5 0 0 1-.5-8.97A6 6 0 0 1 18 8.5a4.75 4.75 0 0 1-.5 9.5zM12 15V10m-2.5 2.5L12 10l2.5 2.5', s),
  bolt: (s = 24) => P('M13 2L4 14h7l-1 8 9-12h-7z', s, true),
  run: (s = 24) => P('M13 4a2 2 0 1 0 0-.01M8 21l3-6 3 2 1 4M6 12l3-4 4 1 3 3 3 1M11 15l-1-4', s),
  clock: (s = 24) => P('M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z', s),
  heart: (s = 24) => P('M12 20s-7-4.5-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.5-9 9-9 9z', s, true),
  watch: (s = 24) => P('M8 6V3h8v3M8 18v3h8v-3M7 6h10a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM12 9v3l2 1', s),
  file: (s = 24) => P('M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h4', s),
  pitch: (s = 24) => P('M4 4h16v16H4zM4 12h16M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4', s),
  up: (s = 24) => P('M12 20V5M6 11l6-6 6 6', s),
  down: (s = 24) => P('M12 4v15M6 13l6 6 6-6', s),
  chevron: (s = 20) => P('M15 6l-6 6 6 6', s),
  check: (s = 20) => P('M5 12l5 5 9-10', s),
};
