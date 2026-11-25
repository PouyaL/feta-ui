import { Children, Fragment, useMemo, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { currentState, openLink, press, pressedState, radius, space, type Colors } from '../kit'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { Separator } from './separator'

const ROW_SCALE = 0.99

export type ItemProps = {
  /** Default has no surface until pressed, Outline sits on surface, Muted on the tray. */
  variant?: 'default' | 'outline' | 'muted'
  /** Default `md`. */
  size?: 'md' | 'sm' | 'xs'
  /** Icon tile, Avatar or art. */
  media?: ReactNode
  title: ReactNode
  description?: ReactNode
  /** One Button or Icon Button. Only the action is the target. */
  action?: ReactNode
  /** A mono meta value, or anything else at the end of the row. */
  meta?: ReactNode
  /** The whole row becomes a link, ending in a chevron. */
  href?: string
  /** `false` hides the trailing chevron, for long menus of links. */
  chevron?: boolean
  /** Leaves the app, with an arrow instead of the chevron. */
  external?: boolean
  /** The whole row becomes a button. */
  onPress?: () => void
  /** Keeps the wash, like the track now playing. */
  active?: boolean
  disabled?: boolean
  /** Draws the trailing chevron or arrow on `href` rows. */
  renderIcon?: RenderIcon
  /** Spoken name, when `title` is not a string. */
  accessibilityLabel?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A row that shows one thing: media, title, description and at most one action. */
export function Item({ variant = 'default', size = 'md', media, title, description, action, meta, href, chevron = true, external = false, onPress, active = false, disabled = false, renderIcon, accessibilityLabel, animated = true, style }: ItemProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const scale = useSharedValue(1)
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const target = (href || onPress) && !disabled
  const row = [styles.item, styles[size], styles[variant], active ? styles.active : null, disabled ? styles.disabled : null]
  const body = (
    <>
      {media ? <View>{media}</View> : null}
      <View style={styles.text}>
        {typeof title === 'string' ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : title}
        {typeof description === 'string' ? <Text style={[styles.description, size === 'xs' ? styles.descriptionXs : null]} numberOfLines={1}>{description}</Text> : description}
      </View>
      {typeof meta === 'string' ? <Text style={styles.meta}>{meta}</Text> : meta}
      {action ? <View>{action}</View> : null}
      {href && chevron ? renderIcon?.(external ? 'arrow-up-right' : 'chevron-right', 16) : null}
    </>
  )
  if (!target && !(onPress && disabled)) return <View style={[...row, style]}>{body}</View>

  function activate(): void {
    onPress?.()
    if (href) openLink(href)
  }

  return (
    <Animated.View style={[motion, style]}>
      <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? (typeof title === 'string' ? title : undefined)}
      aria-disabled={disabled}
      {...(href ? currentState(active) : pressedState(active))}
      disabled={disabled}
      onPress={activate}
      onPressIn={() => { if (!still) scale.value = withSpring(ROW_SCALE, press.spring) }}
      onPressOut={() => { if (!still) scale.value = withSpring(1, press.spring) }}
      style={({ pressed }) => [...row, pressed ? styles.active : null]}
    >
      {body}
      </Pressable>
    </Animated.View>
  )
}

const TILE = { md: 36, sm: 30, xs: 24 } as const

export type ItemTileProps = {
  /** Matches the Item. Default `md`. */
  size?: ItemProps['size']
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/** The square behind an icon. */
export function ItemTile({ size = 'md', children, style }: ItemTileProps) {
  const styles = useThemed(makeStyles)
  const box = useMemo<ViewStyle>(() => ({ width: TILE[size], height: TILE[size], borderRadius: Math.round(TILE[size] * 0.15) * 2 }), [size])
  return <View style={[styles.tile, box, style]}>{children}</View>
}

export type ItemGroupProps = {
  /** Mono header on the tray. */
  title?: string
  /** Default `true`: inset separators between rows. */
  separated?: boolean
  children: ReactNode
  style?: StyleProp<ViewStyle>
}

/** Items that belong together, as a list in a card on the tray. */
export function ItemGroup({ title, separated = true, children, style }: ItemGroupProps) {
  const styles = useThemed(makeStyles)
  const rows = Children.toArray(children)
  return (
    <View style={[styles.group, style]}>
      {title ? <Text style={styles.groupTitle}>{title.toUpperCase()}</Text> : null}
      <View style={styles.card}>
        {rows.map((row, i) => (
          <Fragment key={i}>
            {i > 0 && separated ? <View style={styles.inset}><Separator /></View> : null}
            {row}
          </Fragment>
        ))}
      </View>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  item: { flexDirection: 'row', alignItems: 'center', width: '100%', minWidth: 0, minHeight: 44, gap: space[3], borderRadius: radius['2xl'] },
  md: { paddingVertical: space[4], paddingLeft: space[3], paddingRight: space[3.5] },
  sm: { paddingVertical: space[3.5], paddingLeft: space[2.5], paddingRight: space[3] },
  xs: { paddingVertical: space[2.5], paddingLeft: space[2], paddingRight: space[2.5] },
  default: {},
  outline: { borderWidth: 1, borderColor: c.ink8 },
  muted: { backgroundColor: c.ink4 },
  active: { backgroundColor: c.ink8 },
  disabled: { opacity: 0.5 },
  text: { flex: 1, minWidth: 0 },
  title: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  description: type(13, c.textSecondary),
  descriptionXs: { fontSize: 12 },
  meta: type(12, c.textTertiary, '400', true),
  tile: { alignItems: 'center', justifyContent: 'center', backgroundColor: c.ink5 },
  group: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  groupTitle: { ...type(11, c.textSecondary, '400', true), paddingVertical: space[2], paddingHorizontal: space[3] },
  card: { overflow: 'hidden', borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  inset: { paddingLeft: 60, paddingRight: space[3] },
})
