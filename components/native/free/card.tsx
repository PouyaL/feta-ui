import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown, ZoomIn, ZoomOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import Svg, { G, Rect } from 'react-native-svg'
import { font, press, radius, space, useColors, useReduceMotion, type Colors } from '../kit'

/** Draws a fetaUI icon by name, for example `check` or `chevron-right`. The app owns the icon set. */
export type RenderIcon = (name: string, size: number) => ReactNode

/** `motion/ease-standard` in the Motion frames. */
export const EASE_STANDARD = Easing.bezierFn(0.25, 0.1, 0.25, 1)
export const PANEL_MS = 400
export const ROW_MS = 240
export const ROW_STAGGER_MS = 40

/** Panels fade and rise 8 on first render. */
export const panelEnter = FadeInDown.duration(PANEL_MS).easing(EASE_STANDARD).withInitialValues({ transform: [{ translateY: 8 }] })
/** Rows fade in, 40 ms apart. */
export const rowEnter = (index = 0) => FadeIn.duration(ROW_MS).delay(index * ROW_STAGGER_MS).easing(EASE_STANDARD)

/** True when a component must not move. */
export function useStill(animated = true): boolean {
  const reduce = useReduceMotion()
  return !animated || reduce
}

/** One stylesheet per color scheme. */
export function useThemed<T>(create: (colors: Colors) => T): T {
  const colors = useColors()
  return useMemo(() => create(colors), [colors, create])
}

/** `true` for a moment after `fire`, for Copied and Saved confirmations. */
export function useFlash(ms = 2000): [boolean, () => void] {
  const [on, setOn] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return [on, () => {
    setOn(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setOn(false), ms)
  }]
}

/** The type ramp: TikTok Sans at -0.04em, or Plex Mono for ids and numbers. */
export const type = (size: number, color: string, weight: TextStyle['fontWeight'] = '400', mono = false): TextStyle => ({
  color,
  fontFamily: mono ? font.mono : font.sans,
  fontSize: size,
  fontWeight: weight,
  letterSpacing: mono ? 0 : font.tracking(size),
})

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export type CardProps = {
  /** `tray` is the inset card on the 4% tray. `plain` is the inset card alone. `muted` is a 5% panel. Default `tray`. */
  variant?: 'tray' | 'plain' | 'muted'
  title?: ReactNode
  description?: ReactNode
  /** One item per piece of meta text. Separated by a dot. */
  meta?: ReactNode[]
  /** Usually `<CardMedia />` or an image, 140 tall. */
  media?: ReactNode
  /** Usually a Ghost, Small Icon Button. */
  headerAction?: ReactNode
  /** Sits on the tray, or below a divider on `plain` and `muted`. */
  footer?: ReactNode
  /** Makes the whole card a button. */
  onPress?: () => void
  /** With `onPress` this sets the selected state. Adds the ring and the check. */
  selected?: boolean
  /** Content at 50% and actions blocked. */
  disabled?: boolean
  /** Skeletons hold the height, and the content fades in when this turns false. */
  loading?: boolean
  /** `false` turns off press and the check pop. */
  animated?: boolean
  accessibilityLabel?: string
  bodyStyle?: StyleProp<ViewStyle>
  footerStyle?: StyleProp<ViewStyle>
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

/** The container most of fetaUI is built on: an inset card on a tray, with actions on the tray. */
export function Card({ variant = 'tray', title, description, meta, media, headerAction, footer, onPress, selected = false, disabled = false, loading = false, animated = true, accessibilityLabel, bodyStyle, footerStyle, style, children }: CardProps) {
  const styles = useThemed(createCardStyles)
  const still = useStill(animated)
  const scale = useSharedValue(1)
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  const clickable = Boolean(onPress) && !disabled && !loading
  const label = accessibilityLabel ?? (typeof title === 'string' ? title : undefined)

  const body = (
    <View style={[styles.body, variant === 'muted' && styles.bodyMuted, disabled && styles.disabled, bodyStyle]}>
      {loading ? (
        <View style={styles.bones} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {media ? <View style={styles.boneMedia} /> : null}
          <View style={styles.boneTitle} />
          <View style={styles.boneText} />
          {meta?.length ? <View style={styles.boneMeta} /> : null}
        </View>
      ) : (
        <Animated.View {...(still ? {} : { entering: FadeIn.duration(ROW_MS) })} style={styles.content}>
          {media ? <View style={styles.media}>{media}</View> : null}
          {title || description || headerAction ? (
            <View style={styles.header}>
              <View style={styles.text}>
                {title ? <Text style={styles.title} accessibilityRole="header">{title}</Text> : null}
                {description ? <Text style={styles.description}>{description}</Text> : null}
              </View>
              {headerAction}
            </View>
          ) : null}
          {meta?.length ? <Text style={styles.meta}>{meta.map((item, index) => (index ? <Text key={index}> · {item}</Text> : <Text key={index}>{item}</Text>))}</Text> : null}
          {children}
        </Animated.View>
      )}
    </View>
  )

  return (
    <View style={[styles.card, variant === 'tray' && styles.tray, selected && styles.selected, style]} aria-busy={loading}>
      {onPress ? (
        <AnimatedPressable
          accessibilityRole="button"
          accessibilityLabel={label}
          aria-selected={selected}
          aria-disabled={!clickable}
          disabled={!clickable}
          onPress={onPress}
          onPressIn={() => { if (!still) scale.value = withSpring(press.scale, press.spring) }}
          onPressOut={() => { scale.value = still ? 1 : withSpring(1, press.spring) }}
          style={pressStyle}
        >
          {body}
        </AnimatedPressable>
      ) : body}
      {footer ? <View pointerEvents={disabled ? 'none' : 'auto'} style={[styles.footer, variant !== 'tray' && styles.footerRule, disabled && styles.disabled, footerStyle]}>{footer}</View> : null}
      {selected ? (
        <Animated.View {...(still ? {} : { entering: ZoomIn.springify().stiffness(420).damping(26), exiting: ZoomOut.duration(120) })} style={styles.check}>
          <Text style={styles.checkMark} accessibilityElementsHidden>✓</Text>
        </Animated.View>
      ) : null}
    </View>
  )
}

/** The placeholder scene. Replace it with an image. */
export function CardMedia({ style }: { style?: StyleProp<ViewStyle> }) {
  const styles = useThemed(createCardStyles)
  return <View style={[styles.scene, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"><View style={styles.sun} /></View>
}

export type PanelProps = {
  title?: ReactNode
  subtitle?: ReactNode
  /** A tile before the title. */
  leading?: ReactNode
  /** Puts the subtitle at the right of the title row. */
  asideSubtitle?: boolean
  /** Right side of the header. */
  actions?: ReactNode
  /** Under the sections, on a hairline. */
  footer?: ReactNode
  /** `card` is a surface in a 4 tray. `bare` has no frame, for separate cards. `tray` is a full 4% ground. Default `card`. */
  shell?: 'card' | 'bare' | 'tray'
  animated?: boolean
  /** Names the region when `title` is not text. */
  label?: string
  style?: StyleProp<ViewStyle>
  children: ReactNode
}

/** The Soft shell behind the Product set: one surface in a tray, split by hairlines. Rises 8 once. */
export function Panel({ title, subtitle, leading, asideSubtitle = false, actions, footer, shell = 'card', animated = true, label, style, children }: PanelProps) {
  const styles = useThemed(createCardStyles)
  const still = useStill(animated)
  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} accessibilityLabel={label} style={[shell !== 'bare' && styles.panel, style]}>
      <View style={[shell === 'card' && styles.sheet, shell === 'bare' && styles.bare]}>
        {title || actions ? (
          <View style={styles.panelHead}>
            {leading}
            <View style={[styles.text, asideSubtitle && styles.aside]}>
              {title ? <Text style={styles.panelTitle} accessibilityRole="header">{title}</Text> : null}
              {subtitle ? <Text style={styles.description}>{subtitle}</Text> : null}
            </View>
            {actions}
          </View>
        ) : null}
        {children}
        {footer ? <View style={styles.panelFoot}>{footer}</View> : null}
      </View>
    </Animated.View>
  )
}

export type PanelBodyProps = { title?: ReactNode; meta?: ReactNode; flush?: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }

/** One hairline section of a Panel. */
export function PanelBody({ title, meta, flush = false, style, children }: PanelBodyProps) {
  const styles = useThemed(createCardStyles)
  return (
    <View style={[styles.section, flush && styles.flush, style]}>
      {title || meta ? (
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{title}</Text>
          {typeof meta === 'string' ? <Text style={styles.description}>{meta}</Text> : meta}
        </View>
      ) : null}
      {children}
    </View>
  )
}

const createCardStyles = (c: Colors) => StyleSheet.create({
  card: { borderRadius: radius.tray },
  tray: { backgroundColor: c.ink4, padding: space[1] },
  selected: { borderColor: c.textPrimary, borderWidth: 2 },
  body: { backgroundColor: c.surface, borderColor: c.ink5, borderRadius: radius.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', padding: space[4] },
  bodyMuted: { backgroundColor: c.ink5, borderWidth: 0 },
  disabled: { opacity: 0.5 },
  content: { gap: space[2] },
  media: { borderRadius: radius.xl, height: 140, marginBottom: space[2], overflow: 'hidden' },
  header: { alignItems: 'flex-start', flexDirection: 'row', gap: space[3] },
  text: { flex: 1, gap: space[0.5] },
  aside: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: type(16, c.textPrimary, '500'),
  description: type(14, c.textSecondary),
  meta: type(12, c.textTertiary),
  footer: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'flex-end', padding: space[2] },
  footerRule: { borderTopColor: c.ink8, borderTopWidth: StyleSheet.hairlineWidth },
  bones: { gap: space[2] },
  boneMedia: { backgroundColor: c.muted, borderRadius: radius.xl, height: 140 },
  boneTitle: { backgroundColor: c.muted, borderRadius: radius.sm, height: 14, width: '55%' },
  boneText: { backgroundColor: c.muted, borderRadius: radius.sm, height: 10, width: '85%' },
  boneMeta: { backgroundColor: c.muted, borderRadius: radius.sm, height: 10, width: '40%' },
  check: { alignItems: 'center', backgroundColor: c.inverse, borderRadius: radius.full, height: 24, justifyContent: 'center', position: 'absolute', right: space[3], top: space[3], width: 24 },
  checkMark: type(14, c.textInverse, '600'),
  scene: { backgroundColor: c.muted, flex: 1 },
  sun: { backgroundColor: c.textQuaternary, borderRadius: radius.full, height: 32, left: space[6], position: 'absolute', top: space[6], width: 32 },
  panel: { backgroundColor: c.ink4, borderRadius: radius.tray, padding: space[1] },
  sheet: { backgroundColor: c.surface, borderRadius: radius.card, overflow: 'hidden' },
  bare: { gap: space[2] },
  panelHead: { alignItems: 'center', flexDirection: 'row', gap: space[3], padding: space[4] },
  panelTitle: type(16, c.textPrimary, '500'),
  panelFoot: { alignItems: 'center', borderTopColor: c.ink8, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', flexWrap: 'wrap', gap: space[2], justifyContent: 'space-between', padding: space[4] },
  section: { borderTopColor: c.ink8, borderTopWidth: StyleSheet.hairlineWidth, gap: space[3], padding: space[4] },
  flush: { padding: 0 },
  sectionHead: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between' },
  sectionTitle: type(14, c.textPrimary, '500'),
})

const FINDERS = [[0, 0], [14, 0], [0, 14]] as const

export type QrArtProps = {
  /** Seeds the pattern, so the same seed always draws the same code. */
  seed: string
  /** Width and height in points. */
  size: number
  /** Corner radius of the three finder squares, in grid cells. The inner squares take half. Default 1. */
  finderRadius?: number
}

/** A stand-in QR pattern on a 21 cell grid, seeded so it never changes between renders. Not a scannable code. */
export function QrArt({ seed, size, finderRadius = 1 }: QrArtProps) {
  const colors = useColors()
  const cells = useMemo(() => {
    let hash = 7
    for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
    const list: [number, number][] = []
    for (let y = 0; y < 21; y += 1) {
      for (let x = 0; x < 21; x += 1) {
        hash = (Math.imul(hash, 1664525) + 1013904223) >>> 0
        const finder = (x < 8 && y < 8) || (x > 12 && y < 8) || (x < 8 && y > 12)
        if (!finder && hash >>> 31) list.push([x, y])
      }
    }
    return list
  }, [seed])
  return (
    <Svg width={size} height={size} viewBox="0 0 21 21" fill={colors.textPrimary} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {cells.map(([x, y]) => <Rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} rx={0.2} />)}
      {FINDERS.map(([x, y]) => (
        <G key={`${x}-${y}`}>
          <Rect x={x + 0.5} y={y + 0.5} width={6} height={6} rx={finderRadius} fill="none" stroke={colors.textPrimary} strokeWidth={1} />
          <Rect x={x + 2} y={y + 2} width={3} height={3} rx={finderRadius / 2} />
        </G>
      ))}
    </Svg>
  )
}
