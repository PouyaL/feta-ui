// Shared by the React Native components. Values mirror components/tokens.css.
// Needs React 19, so React Native 0.78 or newer: components take `ref` as a normal prop.
// Ported from the web source, behaviour tested (tools/native) and run on the iOS Simulator (tools/native-app).
// Skia is not a dependency: every component draws with react-native-svg and Reanimated.
import { AccessibilityInfo, Linking, useColorScheme } from 'react-native'
import { useEffect, useRef, useState } from 'react'

export const space = { 0: 0, 0.5: 2, 1: 4, 1.5: 6, 2: 8, 2.5: 10, 3: 12, 3.5: 14, 4: 16, 4.5: 18, 5: 20, 6: 24, 7: 28, 8: 32, 10: 40, 12: 48, 14: 56 } as const

export const radius = { xs: 2, sm: 4, md: 6, lg: 8, field: 10, xl: 12, control: 14, '2xl': 16, card: 18, panel: 20, tray: 22, frame: 24, sheet: 28, full: 9999 } as const

const LIGHT = {
  canvas: '#ffffff', surface: '#ffffff', subtle: '#fafafa', muted: '#f4f4f5', inverse: '#18181b',
  textPrimary: '#18181b', textSecondary: '#71717a', textTertiary: '#a1a1aa', textQuaternary: '#d4d4d8', textInverse: '#ffffff',
  ink4: 'rgba(0,0,0,0.04)', ink5: 'rgba(0,0,0,0.05)', ink8: 'rgba(0,0,0,0.08)', ink10: 'rgba(0,0,0,0.1)',
  onSolid: '#ffffff', danger: '#ef4444', success: '#10b981', warning: '#f97316', info: '#0ea5e9', accent: '#0ea5e9',
}

const DARK: typeof LIGHT = {
  canvas: '#09090b', surface: '#18181b', subtle: '#18181b', muted: '#27272a', inverse: '#f4f4f5',
  textPrimary: '#f4f4f5', textSecondary: '#a1a1aa', textTertiary: '#71717a', textQuaternary: '#52525b', textInverse: '#18181b',
  ink4: 'rgba(255,255,255,0.04)', ink5: 'rgba(255,255,255,0.05)', ink8: 'rgba(255,255,255,0.08)', ink10: 'rgba(255,255,255,0.1)',
  onSolid: '#ffffff', danger: '#ef4444', success: '#10b981', warning: '#fb923c', info: '#38bdf8', accent: '#38bdf8',
}

export type Colors = typeof LIGHT

/** Gradient accents. The same in Light and Dark. */
export const accent = {
  onSolid: '#ffffff',
  emerald: { from: '#34d399', to: '#059669', deep: '#047857' },
  violet: { from: '#a78bfa', to: '#7c3aed', deep: '#6d28d9' },
  orange: { from: '#fb923c', to: '#ea580c', deep: '#c2410c' },
  amber: { from: '#fbbf24', to: '#d97706', deep: '#b45309', light: '#fde68a' },
  sky: { from: '#38bdf8', to: '#0284c7', deep: '#0369a1' },
} as const

export const useColors = (): Colors => (useColorScheme() === 'dark' ? DARK : LIGHT)

/**
 * Style for a horizontal ScrollView. React Native gives a ScrollView flexGrow: 1, so an unstyled horizontal one can
 * stretch tall in a column on iOS; this keeps it as tall as its content.
 */
export const hscroll = { flexGrow: 0 } as const

/** The press every control shares: 0.98 on a firm spring. */
export const press = { scale: 0.98, spring: { stiffness: 600, damping: 32, mass: 1 } } as const

export const font = { sans: 'TikTokSans', mono: 'IBMPlexMono', tracking: (size: number): number => size * -0.04 } as const

/** True when the person asked for less motion. */
export function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduce)
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce)
    return () => listener.remove()
  }, [])
  return reduce
}

const WEB_SCHEMES: readonly string[] = ['http', 'https', 'mailto']

export type OpenLinkOptions = {
  /** Extra schemes this one call site trusts, lowercase with no colon, like `['tel']`. Never pass a scheme from data. */
  allowSchemes?: readonly string[]
}

/** Opens a link on the schemes a browser would follow from a page. Anything else, and any device that cannot open it, does nothing. */
export function openLink(href: string, { allowSchemes = [] }: OpenLinkOptions = {}): void {
  const url = href.trim()
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(url)?.[1]?.toLowerCase()
  if (!scheme || !(WEB_SCHEMES.includes(scheme) || allowSchemes.includes(scheme))) return
  Linking.openURL(url).catch(() => undefined)
}

export type Feedback = { loading?: string; success: string; loadingMs?: number }

/** Press feedback for one-shot actions: a press shows `loading` (when given) for `loadingMs`, then `success` for 1.6 s. */
export function useFeedback(feedback: Feedback | undefined): { status: 'idle' | 'loading' | 'success'; label: (rest: string) => string; start: () => void } {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  const start = (): void => {
    if (!feedback || status !== 'idle') return
    const wait = feedback.loadingMs ?? (feedback.loading ? 700 : 0)
    const succeed = (): void => { setStatus('success'); timer.current = setTimeout(() => setStatus('idle'), 1600) }
    if (wait <= 0) { succeed(); return }
    setStatus('loading')
    timer.current = setTimeout(succeed, wait)
  }
  const label = (rest: string): string => (status === 'loading' ? feedback?.loading ?? rest : status === 'success' ? feedback?.success ?? rest : rest)
  return { status, label, start }
}
