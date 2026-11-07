export const STYLES = [
  'rounded',
  'outlined',
  'filled',
  'sharp',
  'two-tone',
  'hand-drawn',
  'riso',
  'pixel',
  'glass',
  'neon',
] as const

export type Style = (typeof STYLES)[number]

export const STYLE_NAMES: Record<Style, string> = {
  rounded: 'Rounded',
  outlined: 'Outlined',
  filled: 'Filled',
  sharp: 'Sharp',
  'two-tone': 'Two tone',
  'hand-drawn': 'Hand drawn',
  riso: 'Riso',
  pixel: 'Pixel',
  glass: 'Glass',
  neon: 'Neon',
}

export const FREE_CATEGORY = 'Interface Essential'
