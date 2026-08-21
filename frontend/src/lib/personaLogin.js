// Single source of truth for POST /api/demo/persona-login's canonical
// persona keys. Backend (backend/extras.py CANONICAL_PERSONA_EMAILS) accepts
// ONLY these 9 lowercase keys — nothing else. Every persona-login caller
// (Demo.jsx, Auth.jsx, PublicNav.jsx) must funnel its local id/label through
// `toPersonaLoginKey` before sending it, so desktop and mobile entry points
// can never diverge onto a stale/legacy label again.
export const CANONICAL_PERSONA_KEYS = [
  "organizer",
  "promoter",
  "talent",
  "venue",
  "vendor",
  "workforce",
  "sponsor",
  "tenant",
  "audience",
];

// Known local id/label spelling variants -> canonical key. Extend here only
// — never re-invent a second mapping in a component file.
const PERSONA_KEY_ALIASES = {
  promotor: "promoter",
  worker: "workforce",
};

export function toPersonaLoginKey(idOrLabel) {
  const key = String(idOrLabel || "").trim().toLowerCase();
  return PERSONA_KEY_ALIASES[key] || key;
}
