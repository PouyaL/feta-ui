import { useEffect, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { rowEnter, type, useStill, useThemed } from './card'

const RISE_MS = 320
const FAN_MS = 400
const FAN_DELAY_MS = 60
const FAN_X = 16
const FAN_DEG = 12
const CHIP = Easing.bezier(0.2, 0.9, 0.25, 1)
const riseEnter = FadeInDown.duration(RISE_MS).easing(Easing.bezierFn(0.23, 1, 0.32, 1)).withInitialValues({ transform: [{ translateY: 8 }] })

export type EmptyProps = {
  /** Dashed area, straight on the tray, or a tray with an inset card. Default `card`. */
  container?: 'outline' | 'background' | 'card'
  /** Empty Fan, an Avatar, an Avatar Group or a mono code. */
  media?: ReactNode
  /** Say what is missing. */
  title: ReactNode
  /** Why, or what happens next, in one line. */
  description?: ReactNode
  /** One main Button, and secondary ones. */
  actions?: ReactNode
  /** A search field, chips or a learn more link. */
  footer?: ReactNode
  animated?: boolean
  style?: StyleProp<ViewStyle>
  children?: ReactNode
}

/** Says what is missing and offers the one next step. */
export function Empty({ container = 'card', media, title, description, actions, footer, animated = true, style, children }: EmptyProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const step = (i: number) => (still ? {} : { entering: rowEnter(i) })
  return (
    <View style={[styles.empty, styles[container], style]}>
      <Animated.View {...(still ? {} : { entering: riseEnter })} style={[styles.body, container === 'card' ? styles.bodyCard : null]}>
        {media ? <View style={styles.media}>{media}</View> : null}
        <Animated.View {...step(1)} style={styles.copy}>
          {typeof title === 'string' ? <Text accessibilityRole="header" style={styles.title}>{title}</Text> : title}
          {typeof description === 'string' ? <Text style={styles.description}>{description}</Text> : description}
        </Animated.View>
        {actions ? <Animated.View {...step(2)} style={styles.actions}>{actions}</Animated.View> : null}
        {footer || children ? <Animated.View {...step(3)} style={styles.footer}>{footer}{children}</Animated.View> : null}
      </Animated.View>
    </View>
  )
}

function Ghost({ side, moves }: { side: -1 | 1; moves: boolean }) {
  const styles = useThemed(makeStyles)
  const open = useSharedValue(moves ? 0 : 1)
  useEffect(() => {
    if (moves) open.value = withDelay(FAN_DELAY_MS, withTiming(1, { duration: FAN_MS, easing: CHIP }))
  }, [moves, open])
  const fan = useAnimatedStyle(() => ({ transform: [{ translateX: side * FAN_X * open.value }, { rotate: `${side * FAN_DEG * open.value}deg` }] }))
  return <Animated.View style={[styles.ghost, fan]} />
}

export type EmptyFanProps = { tone?: 'danger'; animated?: boolean; children: ReactNode; style?: StyleProp<ViewStyle> }

/** A fanned icon tile. Decorative. */
export function EmptyFan({ tone, animated = true, children, style }: EmptyFanProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.fan, style]}>
      <Ghost side={-1} moves={!still} />
      <Ghost side={1} moves={!still} />
      <View style={[styles.tile, tone === 'danger' ? styles.tileDanger : null]}>{children}</View>
    </View>
  )
}

/** A large mono code, like 404. */
export function EmptyCode({ children }: { children: string }) {
  const styles = useThemed(makeStyles)
  return <Text style={styles.code}>{children}</Text>
}

export type EmptyChipProps = { children: string; onPress?: () => void; style?: StyleProp<ViewStyle> }

/** A suggestion chip for No results. */
export function EmptyChip({ children, onPress, style }: EmptyChipProps) {
  const styles = useThemed(makeStyles)
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={children} hitSlop={8} onPress={onPress} style={({ pressed }) => [styles.chip, pressed ? styles.chipPressed : null, style]}>
      <Text style={styles.chipText}>{children}</Text>
    </Pressable>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  empty: { width: '100%', maxWidth: 358, borderRadius: radius.tray },
  card: { padding: space[1], backgroundColor: c.ink4 },
  background: { backgroundColor: c.ink4 },
  outline: { borderWidth: 1, borderStyle: 'dashed', borderColor: c.ink10 },
  body: { alignItems: 'center', gap: space[4], paddingTop: space[8], paddingHorizontal: space[5], paddingBottom: space[6], borderRadius: radius.card },
  bodyCard: { borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  media: { alignItems: 'center' },
  copy: { alignItems: 'center', gap: space[1] },
  title: { ...type(16, c.textPrimary, '600'), lineHeight: 22, textAlign: 'center' },
  description: { ...type(14, c.textSecondary), lineHeight: 20, textAlign: 'center' },
  actions: { flexDirection: 'column-reverse', alignSelf: 'stretch', gap: space[2] },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', alignSelf: 'stretch', gap: space[2] },
  fan: { alignItems: 'center', justifyContent: 'center', width: 52, height: 52 },
  ghost: { position: 'absolute', width: 44, height: 44, borderRadius: radius.control, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  tile: { alignItems: 'center', justifyContent: 'center', width: 52, height: 52, borderRadius: radius['2xl'], borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  tileDanger: { borderColor: c.danger },
  code: { ...type(40, c.textQuaternary, '600', true), lineHeight: 44 },
  chip: { justifyContent: 'center', height: 28, paddingHorizontal: space[3], borderRadius: radius.full, backgroundColor: c.ink5 },
  chipPressed: { backgroundColor: c.ink8 },
  chipText: type(13, c.textPrimary),
})
