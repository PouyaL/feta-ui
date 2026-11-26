import { useEffect, useState } from 'react'
import { StyleSheet, Text, View, type AccessibilityActionEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { font, radius, softElevation, space, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { Mark } from './popover'

/** Sideways distance between numbers on the strip. */
const SLOT = 64
/** 20 over 30: a neighbour is the current number at this scale, and Light in weight. */
const NEIGHBOUR_SCALE = 2 / 3
const SLIDE = { stiffness: 420, damping: 34 }
/** Numbers kept on the strip each side of the current one. */
const REACH = 2

export type LensPagerProps = {
  pages: number
  page?: number
  defaultPage?: number
  onPageChange?: (page: number) => void
  'aria-label'?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Numeral({ n, current, still }: { n: number; current: number; still: boolean }) {
  const styles = useThemed(createStyles)
  const away = n - current
  const on = away === 0
  const x = useSharedValue(away * SLOT)
  const scale = useSharedValue(on ? 1 : NEIGHBOUR_SCALE)
  const opacity = useSharedValue(Math.abs(away) <= 1 ? 1 : 0)
  useEffect(() => {
    const move = (to: number): number => (still ? to : withSpring(to, SLIDE))
    x.value = move(away * SLOT)
    scale.value = move(on ? 1 : NEIGHBOUR_SCALE)
    opacity.value = move(Math.abs(away) <= 1 ? 1 : 0)
  }, [away, on, opacity, scale, still, x])
  const roll = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ translateX: x.value }, { scale: scale.value }] }))
  return <Animated.Text style={[styles.number, on && styles.numberOn, roll]}>{n}</Animated.Text>
}

/** Paging through a lens, for moments where paging is the point. The strip rolls one number at a time. */
export function LensPager({ pages, page, defaultPage = 1, onPageChange, 'aria-label': label = 'Pagination', animated = true, style }: LensPagerProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultPage)
  const current = page ?? held

  function go(next: number): void {
    const target = Math.max(1, Math.min(pages, next))
    setHeld(target)
    onPageChange?.(target)
  }

  function onAction(e: AccessibilityActionEvent): void {
    if (e.nativeEvent.actionName === 'increment') go(current + 1)
    if (e.nativeEvent.actionName === 'decrement') go(current - 1)
  }

  // Page 0 is the ghost before the first page, as in the Default state.
  const strip: number[] = []
  for (let n = Math.max(0, current - REACH); n <= Math.min(pages, current + REACH); n += 1) strip.push(n)

  return (
    <View accessibilityLabel={label} style={[styles.tray, style]}>
      <IconButton variant="secondary" size="sm" label="Previous page" icon={<Mark name="chevron-left" />} style={styles.arrow} animated={animated} disabled={current <= 1} onPress={() => go(current - 1)} />
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Page"
        aria-valuemin={1}
        aria-valuemax={pages}
        aria-valuenow={current}
        aria-valuetext={`${current} of ${pages}`}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={onAction}
        style={styles.lens}
      >
        <View style={[styles.rule, styles.ruleTop]} />
        <View style={[styles.rule, styles.ruleBottom]}><View style={styles.notch} /></View>
        <View style={[styles.mark, styles.markLeft]} />
        <View style={[styles.mark, styles.markRight]} />
        <View style={styles.window}>{strip.map((n) => <Numeral key={n} n={n} current={current} still={still} />)}</View>
        <Text accessibilityLiveRegion="polite" style={styles.count}>{current} of {pages}</Text>
      </View>
      <IconButton variant="secondary" size="sm" label="Next page" icon={<Mark name="chevron-right" />} style={styles.arrow} animated={animated} disabled={current >= pages} onPress={() => go(current + 1)} />
    </View>
  )
}

const LENS = 184
const CENTER = LENS / 2
const RULE = 30
const MARK = 34

const createStyles = (c: Colors) => StyleSheet.create({
  tray: { alignItems: 'center', alignSelf: 'flex-start', backgroundColor: c.ink4, borderRadius: radius.full, flexDirection: 'row', gap: space[3], justifyContent: 'center', maxWidth: '100%', paddingHorizontal: space[3], paddingVertical: space[1] },
  arrow: { alignSelf: 'center' },
  lens: { boxShadow: softElevation(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.full, borderWidth: 1, height: LENS, overflow: 'hidden', width: LENS },
  rule: { backgroundColor: c.ink8, height: 1, left: 26, position: 'absolute', right: 26 },
  ruleTop: { top: CENTER - RULE - 1 },
  ruleBottom: { top: CENTER + RULE },
  notch: { backgroundColor: c.surface, borderColor: c.ink8, borderLeftWidth: 1, borderTopWidth: 1, height: 8, left: '50%', marginLeft: -4, position: 'absolute', top: -3, transform: [{ rotate: '45deg' }], width: 8 },
  mark: { backgroundColor: c.inverse, borderRadius: radius.full, height: 34, position: 'absolute', top: CENTER - 17, width: 2 },
  markLeft: { left: CENTER - MARK - 1 },
  markRight: { left: CENTER + MARK - 1 },
  window: { height: 44, left: 0, position: 'absolute', right: 0, top: CENTER - 22 },
  number: { color: c.textTertiary, fontFamily: font.mono, fontSize: 26, fontWeight: '400', left: '50%', lineHeight: 44, marginLeft: -30, position: 'absolute', textAlign: 'center', top: 0, width: 60 },
  numberOn: { color: c.textPrimary, fontWeight: '700' },
  count: { ...type(10, c.textTertiary, '400', true), bottom: 36, left: 0, lineHeight: 14, position: 'absolute', right: 0, textAlign: 'center' },
})
