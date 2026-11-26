import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Image, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Circle, Path, Rect } from 'react-native-svg'
import { AVATAR_PEOPLE, AVATAR_PHOTOS, type AvatarPerson } from '../../free/avatar/avatar-photos'
import { radius, space, useColors, type Colors } from '../kit'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { withInk } from './button'
import { IconButton } from './icon-button'

export { AVATAR_PEOPLE, type AvatarPerson }

const SWAP_SPRING = { duration: 420, dampingRatio: 0.78 } as const
const SWAP_REDUCED_MS = 120
const FADE_IN_MS = 200
const BADGE_POP_MS = 120
const LIVE_TURN_MS = 1200
const SHOWN_FACES = 4
const RING_GAP = 4
const OUT = Easing.bezier(0.23, 1, 0.32, 1)

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'
export type AvatarBadgeType = 'online' | 'away' | 'busy' | 'offline' | 'verified' | 'edit'

const SIZE: Record<AvatarSize, { box: number; text: number }> = { xs: { box: 20, text: 10 }, sm: { box: 28, text: 12 }, md: { box: 36, text: 14 }, lg: { box: 44, text: 16 }, xl: { box: 64, text: 22 } }
const BADGE_WORD: Record<AvatarBadgeType, string> = { online: 'Online', away: 'Away', busy: 'Busy', offline: 'Offline', verified: 'Verified', edit: 'Edit' }
const BADGE_SIZE: Record<AvatarSize, 'sm' | 'md' | 'lg'> = { xs: 'sm', sm: 'sm', md: 'md', lg: 'md', xl: 'lg' }
const BADGE_ICON: Partial<Record<AvatarBadgeType, string>> = { away: 'moon', busy: 'minus', verified: 'tick-02', edit: 'pencil' }
const BADGE_DOT = { sm: 8, md: 12, lg: 18 } as const

export type AvatarBadgeProps = {
  type: AvatarBadgeType
  size?: 'sm' | 'md' | 'lg'
  /** Spoken in place of the type. */
  label?: string
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Presence or status, sat on the avatar's 45° point. Announced by screen readers. */
export function AvatarBadge({ type: kind, size = 'md', label, renderIcon, animated = true, style }: AvatarBadgeProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const scale = useSharedValue(1)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    if (still) return
    scale.value = 0
    scale.value = withSequence(withTiming(1.15, { duration: BADGE_POP_MS }), withTiming(1, { duration: BADGE_POP_MS }))
  }, [kind, still, scale])
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const dot = BADGE_DOT[size]
  const box = useMemo(() => ({ width: dot + 4, height: dot + 4 }), [dot])
  const icon = size === 'sm' ? undefined : BADGE_ICON[kind]
  return (
    <Animated.View accessible accessibilityRole="image" accessibilityLabel={label ?? BADGE_WORD[kind]} style={[styles.badge, box, styles[`badge_${kind}` as const], pop, style]}>
      {icon && renderIcon ? withInk(renderIcon(icon, Math.round(dot * 0.7)), kind === 'edit' ? colors.textInverse : colors.onSolid) : null}
      {kind === 'offline' ? <View style={styles.offlineDot} /> : null}
    </Animated.View>
  )
}

export const AVATAR_BG = '#e3dcdb'
export const AVATAR_INK = '#2d333e'

/** The illustrated photo. Replace it with `src` when you have a real one. */
export function AvatarPhoto({ person, style }: { person: AvatarPerson; style?: StyleProp<ViewStyle> }) {
  // --feta-avatar-bg and --feta-avatar-ink: a warm beige tile with dark ink, the same in Light and Dark.
  return (
    <Svg aria-hidden width="100%" height="100%" viewBox="0 0 64 64" style={style}>
      <Rect width={64} height={64} fill={AVATAR_BG} />
      <Path fillRule="evenodd" clipRule="evenodd" d={AVATAR_PHOTOS[person]} fill={AVATAR_INK} />
    </Svg>
  )
}

function LiveRing({ box, moving }: { box: number; moving: boolean }) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const turn = useSharedValue(0)
  useEffect(() => {
    if (!moving) return undefined
    turn.value = withRepeat(withTiming(1, { duration: LIVE_TURN_MS, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(turn)
  }, [moving, turn])
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 360}deg` }] }))
  const size = box + RING_GAP * 2
  const r = (size - 2) / 2
  const length = 2 * Math.PI * r
  return (
    <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.ringSlot, spin]}>
      <Svg aria-hidden width={size} height={size} fill="none">
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.ink10} strokeWidth={2} />
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.textPrimary} strokeWidth={2} strokeLinecap="round" strokeDasharray={[length * 0.6, length * 0.4]} />
      </Svg>
    </Animated.View>
  )
}

export type AvatarProps = {
  /** A real photo. Fades in over the Loading fill and falls back when it fails. */
  src?: string
  /** One of the illustrated people. Used when `src` is missing or fails. */
  person?: AvatarPerson
  /** One or two letters, the fallback after `src` and `person`. */
  initials?: string
  /** Shown when there is nothing else. Default the `user` icon, through `renderIcon`. */
  icon?: ReactNode
  /** Holds the ink fill, for while the source is not known yet. */
  loading?: boolean
  /** The person's name. Leave empty when a visible name sits next to the avatar. */
  alt?: string
  /** 20, 28, 36, 44, 64. Default `md`. */
  size?: AvatarSize
  /** `rounded` is for teams and workspaces. Default `circle`. */
  shape?: 'circle' | 'rounded'
  /** A 2 point ring for something new. `live` turns while it lasts. */
  ring?: boolean | 'live'
  badge?: AvatarBadgeType
  badgeLabel?: string
  renderIcon?: RenderIcon
  /** `false` keeps photos, presence and the live ring still. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A person or workspace as a photo, an illustration, initials or an icon. */
export function Avatar({ src, person, initials, icon, loading = false, alt = '', size = 'md', shape = 'circle', ring = false, badge, badgeLabel, renderIcon, animated = true, style }: AvatarProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [status, setStatus] = useState<{ src: string; state: 'loaded' | 'failed' } | null>(null)
  const known = status?.src === src ? status?.state ?? null : null
  const showImage = Boolean(src) && known !== 'failed' && !loading
  const face = person && !showImage && !loading ? person : null
  const swapKey = face ?? (initials && !showImage ? 'initials' : 'other')
  const metrics = SIZE[size]
  const corner = shape === 'circle' ? radius.full : Math.round(metrics.box * 0.14) * 2

  const imageOpacity = useSharedValue(still ? 1 : 0)
  const swap = useSharedValue(1)
  const first = useRef(true)
  useEffect(() => {
    if (!still && known === 'loaded') imageOpacity.value = withTiming(1, { duration: FADE_IN_MS, easing: OUT })
  }, [known, still, imageOpacity])
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    swap.value = 0
    swap.value = still ? withTiming(1, { duration: animated ? SWAP_REDUCED_MS : 0 }) : withSpring(1, SWAP_SPRING)
  }, [swapKey, still, animated, swap])
  const imageFade = useAnimatedStyle(() => ({ opacity: imageOpacity.value }))
  const moves = !still
  const faceSwap = useAnimatedStyle(() => ({ opacity: Math.min(swap.value, 1), transform: [{ scale: moves ? 0.96 + swap.value * 0.04 : 1 }] }))

  const box = useMemo<ViewStyle>(() => ({ width: metrics.box, height: metrics.box, borderRadius: corner }), [metrics.box, corner])
  const initialsStyle = useMemo(() => ({ fontSize: metrics.text }), [metrics.text])
  const ringBox = useMemo<ViewStyle>(() => ({ borderRadius: corner === radius.full ? radius.full : corner + RING_GAP }), [corner])
  const showFrameRing = showImage || face
  return (
    <View
      accessible={Boolean(alt)}
      {...(alt ? { accessibilityRole: 'image' as const, accessibilityLabel: alt } : {})}
      style={[styles.avatar, box, style]}
    >
      {ring === true ? <View style={[styles.ring, ringBox]} /> : null}
      {ring === 'live' ? <LiveRing box={metrics.box} moving={!still} /> : null}
      <View style={[styles.frame, box, loading || (showImage && known === null) ? styles.loading : null]}>
        {showImage && src ? (
          <Animated.View style={[styles.fill, imageFade]}>
            <Image
              key={src}
              source={{ uri: src }}
              resizeMode="cover"
              style={styles.image}
              onLoad={() => setStatus({ src, state: 'loaded' })}
              onError={() => setStatus({ src, state: 'failed' })}
            />
          </Animated.View>
        ) : null}
        {loading || showImage ? null : (
          <Animated.View style={[styles.face, faceSwap]}>
            {face ? <AvatarPhoto person={face} /> : initials ? <Text style={[styles.initials, initialsStyle]}>{initials}</Text> : (icon ?? renderIcon?.('user', Math.round(metrics.box * 0.44)))}
          </Animated.View>
        )}
        {showFrameRing ? <View pointerEvents="none" style={[styles.hairline, box]} /> : null}
      </View>
      {badge ? (
        <View style={styles.badgeSlot}>
          <AvatarBadge type={badge} size={BADGE_SIZE[size]} animated={animated} {...(badgeLabel ? { label: badgeLabel } : {})} {...(renderIcon ? { renderIcon } : {})} />
        </View>
      ) : null}
    </View>
  )
}

const GROUP = { sm: { face: 36, overlap: 6 }, md: { face: 44, overlap: 8 }, lg: { face: 52, overlap: 10 } } as const
const FACE_SIZE: Record<'sm' | 'md' | 'lg', AvatarSize> = { sm: 'md', md: 'lg', lg: 'lg' }

export type AvatarGroupItem = Omit<AvatarProps, 'size' | 'shape' | 'animated' | 'style'> & { key?: string }

export type AvatarGroupProps = {
  /** Each person. The group shows four and counts the rest. */
  items: AvatarGroupItem[]
  /** Faces shown before the count. Default 4. */
  max?: number
  /** Default `md`. */
  size?: 'sm' | 'md' | 'lg'
  /** `none` shows the faces, `count` adds +N, `add` adds an Add Icon Button. Default `count`. */
  overflow?: 'none' | 'count' | 'add'
  /** The group's accessible name. */
  label: string
  /** Opens the full list from +N. Without it the count is plain text. */
  onCountPress?: () => void
  onAdd?: () => void
  addLabel?: string
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Overlapping faces on 2 point surface slots. Each slot sits a little over the last. */
export function AvatarGroup({ items, max = SHOWN_FACES, size = 'md', overflow = 'count', label, onCountPress, onAdd, addLabel = 'Add person', renderIcon, animated = true, style }: AvatarGroupProps) {
  const styles = useThemed(makeStyles)
  const shown = items.slice(0, max)
  const rest = items.length - shown.length
  const count = `+${rest}`
  const { face, overlap } = GROUP[size]
  const countBox = useMemo(() => ({ width: face, height: face }), [face])
  const next = useMemo(() => ({ marginLeft: -overlap }), [overlap])
  return (
    <View accessible={false} accessibilityLabel={label} style={[styles.group, style]}>
      {shown.map(({ key, ...item }, i) => (
        <View key={key ?? item.src ?? item.person ?? item.initials ?? i} style={[styles.slot, i > 0 ? next : null]}>
          <Avatar {...item} size={FACE_SIZE[size]} animated={animated} {...(renderIcon ? { renderIcon } : {})} />
        </View>
      ))}
      {overflow === 'count' && rest > 0 ? (
        <View style={[styles.slot, next]}>
          {onCountPress ? (
            <Pressable accessibilityRole="button" accessibilityLabel={`Show ${rest} more`} onPress={onCountPress} style={[styles.count, countBox]}>
              <Text style={styles.countText}>{count}</Text>
            </Pressable>
          ) : <View accessible accessibilityRole="image" accessibilityLabel={`${rest} more`} style={[styles.count, countBox]}><Text style={styles.countText}>{count}</Text></View>}
        </View>
      ) : null}
      {overflow === 'add' ? (
        <View style={[styles.slot, next]}>
          <IconButton variant="secondary" size={size} icon={renderIcon?.('plus', 16)} label={addLabel} animated={animated} {...(onAdd ? { onPress: onAdd } : {})} />
        </View>
      ) : null}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  avatar: { flexShrink: 0 },
  frame: { overflow: 'hidden', backgroundColor: c.ink5 },
  loading: { backgroundColor: c.ink10 },
  fill: StyleSheet.absoluteFill,
  image: { width: '100%', height: '100%' },
  face: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: type(14, c.textSecondary).fontFamily, fontWeight: '500', color: c.textSecondary },
  hairline: { position: 'absolute', top: 0, left: 0, borderWidth: 1, borderColor: c.ink8 },
  ring: { position: 'absolute', top: -RING_GAP, right: -RING_GAP, bottom: -RING_GAP, left: -RING_GAP, borderWidth: 2, borderColor: c.textPrimary },
  ringSlot: { position: 'absolute', top: -RING_GAP, left: -RING_GAP },
  badge: { alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: c.surface, borderRadius: radius.full },
  badge_online: { backgroundColor: c.success },
  badge_away: { backgroundColor: c.warning },
  badge_busy: { backgroundColor: c.danger },
  badge_verified: { backgroundColor: c.info },
  badge_edit: { backgroundColor: c.inverse },
  badge_offline: { backgroundColor: c.surface },
  offlineDot: { width: '60%', height: '60%', borderWidth: 2, borderColor: c.textTertiary, borderRadius: radius.full },
  badgeSlot: { position: 'absolute', right: -space[0.5], bottom: -space[0.5] },
  group: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  slot: { padding: space[0.5], borderRadius: radius.full, backgroundColor: c.surface },
  count: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.full, backgroundColor: c.ink5 },
  countText: type(13, c.textSecondary, '500'),
})
