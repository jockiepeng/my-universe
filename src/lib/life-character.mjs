import { STAGES } from './life-journey.mjs';

// Original generated artwork: seven age columns, four walking/crawling frame rows.
// Kept in the repository, with no external image requests or generation at runtime.
export const CHARACTER_SHEET = `${(import.meta.env?.BASE_URL || '/').replace(/\/?$/, '/')}images/life/characters-v2.png`;
export function characterIndex(id) { return Math.max(0, STAGES.findIndex(stage => stage.id === id)); }
