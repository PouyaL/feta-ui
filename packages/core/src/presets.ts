import type { Style } from './styles'

export const PRESETS = [
  'draw',
  'pop',
  'wiggle',
  'spin',
  'bounce',
  'slide',
  'pulse',
  'shake',
  'blink',
  'float',
  'swap',
] as const

export type Preset = (typeof PRESETS)[number]

type Rule = { preset: Preset; words?: string[]; phrases?: string[][] }

// words: any single token matches. phrases: consecutive tokens must match in order.
// Source of truth: docs/ANIMATION.md §3. Order matters, first match wins.
export const presetRules: Rule[] = [
  { preset: 'spin', words: ['loading', 'refresh', 'reload', 'sync', 'settings', 'setting', 'gear', 'rotate'] },
  { preset: 'wiggle', words: ['bell', 'notification', 'alarm'] },
  { preset: 'shake', words: ['alert', 'error', 'warning', 'delete', 'trash', 'lock', 'cancel'] },
  { preset: 'blink', words: ['eye', 'view', 'preview'] },
  { preset: 'bounce', words: ['download', 'upload'], phrases: [['arrow', 'up'], ['arrow', 'down']] },
  { preset: 'slide', words: ['arrow', 'send', 'forward', 'next', 'previous', 'chevron'] },
  { preset: 'pulse', words: ['live', 'wifi', 'signal', 'record', 'broadcast', 'radar'] },
  { preset: 'float', words: ['cloud', 'weather', 'balloon', 'sun', 'moon', 'snow', 'rain'] },
  { preset: 'draw', words: ['check', 'checkmark', 'tick', 'chart', 'signature', 'pen', 'pencil', 'edit'] },
  { preset: 'pop', words: ['star', 'heart', 'favourite', 'like', 'add', 'plus', 'gift', 'badge'] },
]

/** Presets that only mean something on a two-state icon (DESIGN.md §2.1). Site-wide pickers leave them out. */
export const STATE_PRESETS: readonly Preset[] = ['swap']

export function matchPreset(icon: string): Preset | null {
  const tokens = icon.split('-').filter((t) => !/^\d+$/.test(t)) // drop numeric suffixes like -01
  for (const r of presetRules) {
    if (r.words?.some((w) => tokens.includes(w))) return r.preset
    if (r.phrases?.some((p) => tokens.some((_, i) => p.every((w, j) => tokens[i + j] === w)))) return r.preset
  }
  return null
}

/**
 * The suggestion stored in data/presets.json: a two-state icon suggests `swap`, since its second
 * state is its meaning; every other icon gets the whole word match from its name.
 */
export function suggestPreset(icon: string, twoState: boolean): Preset | null {
  return twoState ? 'swap' : matchPreset(icon)
}

/** Styles drawn as fills: `draw` traces their outlines, then fills in (ANIMATION.md §4). */
export const FILL_STYLES: readonly Style[] = ['filled', 'outlined', 'pixel']

export type PresetMap = Record<string, Preset | null>

/** Every icon draws on by default, for a consistent set (ANIMATION.md §3). */
export const DEFAULT_PRESET: Preset = 'draw'

/** The preset an icon plays unless the user picks another: a manual override, else `draw`. */
export function resolvePreset(icon: string, overrides: PresetMap): Preset {
  return overrides[icon] ?? DEFAULT_PRESET
}

/** Keyword suggestion from data/presets.json, offered as an option, never applied by default. */
export function suggestedPreset(icon: string, presets: PresetMap): Preset | null {
  return presets[icon] ?? null
}
