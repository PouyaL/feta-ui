'use client'
import { AnimatePresence, motion, type HTMLMotionProps } from 'motion/react'
import { useRef, useState, type ReactNode } from 'react'
import { Avatar as FreeAvatar, AvatarGroup, type AvatarPerson } from '../avatar/avatar'
import { Badge, type BadgeTone } from '../badge/badge'
import { useLabelMotion } from '../button/label-motion'
import { Kbd as FreeKbd } from '../kbd/kbd'
import { RollingText } from '../motion-kit/motion-kit'
import { Progress } from '../progress/progress'
import styles from './product-kit.module.css'

// Shared by the Product components: the panel shell, its entrance, and thin wrappers on the Free
// Avatar, Badge, Kbd and Progress.
export const PANEL_S = 0.4
export const ROW_S = 0.24
export const ROW_STAGGER_S = 0.04
export const EASE_STANDARD = [0.25, 0.1, 0.25, 1] as const

export const kit = styles

// `still` turns true after hydration under reduced motion, often mid entrance. The still branch keeps
// the same end state with no duration, so a running entrance snaps to it instead of freezing part way.
const SETTLE = { duration: 0 } as const

/** Panel enters: fade and rise 8 on first render. */
export const enter = (still: boolean): Pick<HTMLMotionProps<'section'>, 'initial' | 'animate' | 'transition'> =>
  still ? { initial: false, animate: { opacity: 1, y: 0 }, transition: SETTLE } : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { duration: PANEL_S, ease: EASE_STANDARD } }

/** Rows fade in, 40 ms apart. */
export const rowEnter = (still: boolean, index = 0): Pick<HTMLMotionProps<'div'>, 'initial' | 'animate' | 'transition'> =>
  still ? { initial: false, animate: { opacity: 1 }, transition: SETTLE } : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: ROW_S, ease: EASE_STANDARD, delay: index * ROW_STAGGER_S } }

export const initials = (name: string): string =>
  name.split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('')

export type AvatarProps = { name: string; src?: string | undefined; person?: AvatarPerson | undefined; size?: 20 | 28 | 36 | 44 | 64; square?: boolean; presence?: boolean; animated?: boolean; className?: string }

const AVATAR_SIZE = { 20: 'xs', 28: 'sm', 36: 'md', 44: 'lg', 64: 'xl' } as const

/** The Free Avatar, sized in pixels and fed a name. The name itself is carried by the text beside it. */
export function Avatar({ name, src, person, size = 36, square, presence, animated = true, className }: AvatarProps) {
  return <FreeAvatar {...(src ? { src } : {})} {...(person ? { person } : {})} initials={initials(name)} size={AVATAR_SIZE[size]} shape={square ? 'rounded' : 'circle'} {...(presence ? { badge: 'online' as const } : {})} animated={animated} {...(className ? { className } : {})} />
}

export function AvatarStack({ names, more = 0, animated = true }: { names: string[]; more?: number; animated?: boolean }) {
  const items = [...names.map((name) => ({ key: name, initials: initials(name) })), ...Array.from({ length: more }, (_, i) => ({ key: `more-${i}`, initials: '' }))]
  return <AvatarGroup items={items} max={names.length} size="sm" overflow={more ? 'count' : 'none'} label={`${names.join(', ')}${more ? ` and ${more} more` : ''}`} animated={animated} />
}

export type TagTone = BadgeTone

export function Tag({ tone = 'neutral', dot, animated = true, children }: { tone?: TagTone; dot?: boolean; animated?: boolean; children: ReactNode }) {
  return <Badge tone={tone} size="sm" mark={dot ?? false} animated={animated}>{children}</Badge>
}

export function Kbd({ pressed, outline, animated = true, children }: { pressed?: boolean; outline?: boolean; animated?: boolean; children: ReactNode }) {
  return <FreeKbd variant={outline ? 'outline' : 'soft'} size="sm" pressed={pressed ?? false} animated={animated}>{children}</FreeKbd>
}

/** The Free Progress at its thin size. */
export function Meter({ value, max, label, animated = true, className }: { value: number; max: number; label: string; animated?: boolean; className?: string }) {
  return <Progress value={Math.min(value, max)} max={max} size="sm" label={label} animated={animated} {...(className ? { className } : {})} />
}

export function SeatCount({ used, total, still, unit = 'seats' }: { used: number; total: number; still: boolean; unit?: string }) {
  return <span className={styles.count}><b><RollingText value={String(used)} still={still} /></b> of {total} {unit}</span>
}

/** The Button label motion for small controls that are not a Button. */
export function MotionLabel({ text, still, className }: { text: string; still: boolean; className?: string | undefined }) {
  const motionText = useLabelMotion(text, !still)
  return <span {...motionText.handlers} className={className}>{motionText.label}</span>
}

/** Labels swap in place, fading, without moving the layout. */
export function Fade({ swapKey, still, children, className }: { swapKey: string; still: boolean; children: ReactNode; className?: string | undefined }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div key={swapKey} className={className} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={still ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: still ? 0 : ROW_S / 2, ease: EASE_STANDARD }}>
        {children}
      </motion.div>
    </AnimatePresence>
  )
}

/** Copies text, then says so for a moment. */
export function useCopied(hold = 1400): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  return [copied, (text) => {
    void navigator.clipboard?.writeText(text).then(() => {
      setCopied(true)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), hold)
    }, () => undefined)
  }]
}
