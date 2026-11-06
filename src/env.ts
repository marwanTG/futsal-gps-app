// Build target. The claude.ai artifact build blocks external images (satellite
// tiles) and file downloads, so those features are hidden there.
export const IN_ARTIFACT = import.meta.env.VITE_TARGET === 'artifact';
