/** Short explanations for terms that appear across the app. Keep each to one sentence. */
export const GLOSSARY = {
  lockfile: 'A file that records the exact version of every package a project uses, so the same install can be repeated.',
  pnpm: 'A package manager that stores each package once on disk and links it into projects, which saves space.',
  quarantine: 'Whittle’s holding area, where removed items wait for the number of days set in Settings and can be put back until then.',
} as const

export type TermKey = keyof typeof GLOSSARY
