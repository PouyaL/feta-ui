'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { MinusIcon } from '@fetaui/react/rounded/minus'
import { MoonIcon } from '@fetaui/react/rounded/moon'
import { PencilIcon } from '@fetaui/react/rounded/pencil'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { UserIcon } from '@fetaui/react/rounded/user'
import { ease } from '../../motion-tokens'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import { AVATAR_PEOPLE, AVATAR_PHOTOS, type AvatarPerson } from './avatar-photos'
import styles from './avatar.module.css'

export { AVATAR_PEOPLE, type AvatarPerson }

const SWAP_SPRING = { type: 'spring', duration: 0.42, bounce: 0.22 } as const
const SWAP_REDUCED_S = 0.12
const FADE_IN_S = 0.2
const BADGE_POP_S = 0.24
const BADGE_POP_SCALE = [0, 1.15, 1]
const SHOWN_FACES = 4

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type AvatarBadgeType = 'online' | 'away' | 'busy' | 'offline' | 'verified' | 'edit'

const BADGE_WORD: Record<AvatarBadgeType, string> = { online: 'Online', away: 'Away', busy: 'Busy', offline: 'Offline', verified: 'Verified', edit: 'Edit' }
const BADGE_SIZE: Record<AvatarSize, 'sm' | 'md' | 'lg'> = { xs: 'sm', sm: 'sm', md: 'md', lg: 'md', xl: 'lg' }

/** Presence or status, sat on the avatar's 45° point. The text form is announced. */
export function AvatarBadge({ type, size = 'md', label, animated = true, className }: {
  type: AvatarBadgeType
  size?: 'sm' | 'md' | 'lg'
  /** Spoken in place of the type. */
  label?: string | undefined
  animated?: boolean
  className?: string | undefined
}) {
  const still = useStill(animated)
  const first = useRef(true)
  useEffect(() => { first.current = false }, [])
  const glyph = size === 'sm' ? null : { away: <MoonIcon />, busy: <MinusIcon />, verified: <Tick02Icon />, edit: <PencilIcon />, online: null, offline: null }[type]
  return (
    <motion.span
      key={type}
      role="img"
      aria-label={label ?? BADGE_WORD[type]}
      className={cx(styles.badge, className)}
      data-type={type}
      data-size={size}
      initial={still || first.current ? false : { scale: 0 }}
      animate={still ? { scale: 1 } : { scale: BADGE_POP_SCALE }}
      transition={{ duration: still || first.current ? 0 : BADGE_POP_S, ease: 'easeOut' }}
    >
      {glyph}
    </motion.span>
  )
}

/** The illustrated photo. Replace it with `src` when you have a real one. */
export function AvatarPhoto({ person, className }: { person: AvatarPerson; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" className={cx(styles.photo, className)}>
      <rect width="64" height="64" fill="var(--feta-avatar-bg)" />
      <path fillRule="evenodd" clipRule="evenodd" d={AVATAR_PHOTOS[person]} fill="var(--feta-avatar-ink)" />
    </svg>
  )
}

export type AvatarProps = {
  /** A real photo. Fades in over the Loading fill and falls back when it fails. */
  src?: string
  /** One of the illustrated people. Used when `src` is missing or fails. */
  person?: AvatarPerson
  /** One or two letters, the fallback after `src` and `person`. */
  initials?: string
  /** Shown when there is nothing else. Default a person glyph. */
  icon?: ReactNode
  /** Holds the ink fill, for while the source is not known yet. */
  loading?: boolean
  /** The person's name. Leave empty when a visible name sits next to the avatar. */
  alt?: string
  /** 20, 28, 36, 44, 64. Default `md`. */
  size?: AvatarSize
  /** `rounded` is for teams and workspaces. Default `circle`. */
  shape?: 'circle' | 'rounded'
  /** A 2 px ring for something new. `live` turns while it lasts. */
  ring?: boolean | 'live'
  badge?: AvatarBadgeType
  badgeLabel?: string
  /** `false` keeps photos, presence and the live ring still. */
  animated?: boolean
  className?: string
}

/** A person or workspace as a photo, an illustration, initials or an icon. */
export function Avatar({ src, person, initials, icon, loading = false, alt = '', size = 'md', shape = 'circle', ring = false, badge, badgeLabel, animated = true, className }: AvatarProps) {
  const still = useStill(animated)
  const [status, setStatus] = useState<{ src: string; state: 'loaded' | 'failed' } | null>(null)
  const known = status?.src === src ? status?.state ?? null : null
  const failed = known === 'failed'
  const showImage = Boolean(src) && !failed && !loading
  const face = person && !showImage && !loading ? person : null
  const swapKey = face ?? (initials && !showImage ? 'initials' : 'other')
  const imageRef = useRef<HTMLImageElement>(null)

  // A cached image finishes before React attaches onLoad.
  useEffect(() => {
    const image = imageRef.current
    if (image?.complete && src) setStatus({ src, state: image.naturalWidth > 0 ? 'loaded' : 'failed' })
  }, [src])

  return (
    <span className={cx(styles.avatar, className)} data-size={size} data-shape={shape} data-ring={ring === false ? undefined : ring === 'live' ? 'live' : 'on'}>
      {ring === 'live' ? <span ref={watchOffscreen} aria-hidden="true" className={styles.liveRing} data-loop="" data-still={still ? '' : undefined} /> : null}
      <span className={styles.frame} role={showImage ? undefined : alt ? 'img' : undefined} aria-label={showImage ? undefined : alt || undefined} data-media={showImage || face ? '' : undefined} data-loading={loading || (showImage && known === null) ? '' : undefined}>
        {showImage ? (
          <motion.img
            ref={imageRef}
            key={src}
            src={src}
            alt={alt}
            className={styles.image}
            draggable={false}
            initial={still ? false : { opacity: 0 }}
            animate={{ opacity: !still && known === null ? 0 : 1 }}
            transition={{ duration: still ? 0 : FADE_IN_S, ease: ease.out }}
            onLoad={() => { if (src) setStatus({ src, state: 'loaded' }) }}
            onError={() => { if (src) setStatus({ src, state: 'failed' }) }}
          />
        ) : null}
        {loading || showImage ? null : (
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              key={swapKey}
              className={styles.face}
              initial={still ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={still ? { duration: animated ? SWAP_REDUCED_S : 0 } : SWAP_SPRING}
            >
              {face ? <AvatarPhoto person={face} /> : initials ? <span className={styles.initials} aria-hidden="true">{initials}</span> : <span className={styles.icon} aria-hidden="true">{icon ?? <UserIcon />}</span>}
            </motion.span>
          </AnimatePresence>
        )}
      </span>
      {badge ? <AvatarBadge type={badge} size={BADGE_SIZE[size]} label={badgeLabel} animated={animated} className={styles.badgeSlot} /> : null}
    </span>
  )
}

export type AvatarGroupProps = {
  /** Each person. The group shows four and counts the rest. */
  items: (Omit<AvatarProps, 'size' | 'shape' | 'animated' | 'className'> & { key?: string })[]
  /** Faces shown before the count. Default 4. */
  max?: number
  /** 28, 36, 44. Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** `none` shows the faces, `count` adds +N, `add` adds an Add Icon Button. Default `count`. */
  overflow?: 'none' | 'count' | 'add'
  /** The group's accessible name. */
  label: string
  /** Opens the full list from +N. Without it the count is plain text. */
  onCountClick?: () => void
  onAdd?: () => void
  addLabel?: string
  animated?: boolean
  className?: string
}

/** Overlapping faces on 2 px surface slots. Hover spreads them so each one can be seen. */
export function AvatarGroup({ items, max = SHOWN_FACES, size = 'md', overflow = 'count', label, onCountClick, onAdd, addLabel = 'Add person', animated = true, className }: AvatarGroupProps) {
  const still = useStill(animated)
  const shown = items.slice(0, max)
  const rest = items.length - shown.length
  const count = `+${rest}`
  return (
    <div role="group" aria-label={label} className={cx(styles.group, className)} data-size={size} data-still={still ? '' : undefined}>
      {shown.map(({ key, ...item }, i) => (
        <span key={key ?? item.src ?? item.person ?? item.initials ?? i} className={styles.slot} style={{ '--i': i } as CSSProperties}>
          <Avatar {...item} size={size} animated={animated} />
        </span>
      ))}
      {overflow === 'count' && rest > 0 ? (
        <span className={styles.slot} style={{ '--i': shown.length } as CSSProperties}>
          {onCountClick
            ? <button type="button" className={styles.count} aria-label={`Show ${rest} more`} onClick={onCountClick}>{count}</button>
            : <span className={styles.count} role="img" aria-label={`${rest} more`}>{count}</span>}
        </span>
      ) : null}
      {overflow === 'add' ? (
        <span className={styles.slot} style={{ '--i': shown.length } as CSSProperties}>
          <IconButton variant="secondary" size={size} icon={<PlusIcon />} label={addLabel} animated={animated} onClick={onAdd} />
        </span>
      ) : null}
    </div>
  )
}
