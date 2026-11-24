import { useEffect, useMemo, type ReactNode } from 'react'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Defs, Line, LinearGradient, Rect, Stop } from 'react-native-svg'
import { font, radius, space, useColors, useReduceMotion, type Colors } from '../kit'

const DRAW_MS = 240
const LABEL_MS = 200
const KNOT_MS = 200
const KNOT_EASE = Easing.bezier(0.34, 1.56, 0.64, 1)
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const DOT_GAP = 6

export type SeparatorProps = {
  /** Default `horizontal`. */
  orientation?: 'horizontal' | 'vertical'
  /** Default `line`. */
  kind?: 'line' | 'fade' | 'dotted' | 'label' | 'icon'
  /** The word for `label`, like OR or TODAY. */
  label?: string
  /** Swaps the plus in the `icon` knot. */
  icon?: ReactNode
  /** Set `true` only when the division means something, like groups in a menu. */
  semantic?: boolean
  /** Draws in on mount, when it arrives with new content. Default `false`: separators stay still. */
  appear?: boolean
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Rule({ kind, vertical, styles, ink, moves, drawn }: { kind: 'line' | 'fade' | 'dotted'; vertical: boolean; styles: ReturnType<typeof makeStyles>; ink: string; moves: boolean; drawn: SharedValue<number> }) {
  const scale = useAnimatedStyle(() => ({ transform: [vertical ? { scaleY: moves ? drawn.value : 1 } : { scaleX: moves ? drawn.value : 1 }] }))
  const look = [vertical ? styles.ruleVertical : styles.ruleHorizontal, kind === 'line' ? styles.ruleLine : null, scale]
  if (kind === 'line') return <Animated.View style={look} />
  return (
    <Animated.View style={look}>
      <Svg width="100%" height="100%">
        {kind === 'fade' ? (
          <>
            <Defs>
              <LinearGradient id="fade" x1="0" y1="0" x2={vertical ? '0' : '1'} y2={vertical ? '1' : '0'}>
                <Stop offset="0" stopColor={ink} stopOpacity={0} />
                <Stop offset="0.5" stopColor={ink} />
                <Stop offset="1" stopColor={ink} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#fade)" />
          </>
        ) : (
          <Line x1={1} y1={1} x2={vertical ? 1 : '100%'} y2={vertical ? '100%' : 1} stroke={ink} strokeWidth={2} strokeLinecap="round" strokeDasharray={[0, DOT_GAP]} />
        )}
      </Svg>
    </Animated.View>
  )
}

/** A quiet divider. Never takes focus. */
export function Separator({ orientation = 'horizontal', kind = 'line', label, icon, semantic = false, appear = false, animated = true, style }: SeparatorProps) {
  const colors = useColors()
  const reduce = useReduceMotion()
  const styles = useMemo(() => makeStyles(colors), [colors])
  const moves = appear && animated && !reduce
  const vertical = orientation === 'vertical'
  const drawn = useSharedValue(moves ? 0 : 1)
  const rise = useSharedValue(moves ? 0 : 1)
  const pop = useSharedValue(moves ? 0 : 1)
  useEffect(() => {
    if (!moves) return
    drawn.value = withTiming(1, { duration: DRAW_MS, easing: OUT })
    rise.value = withTiming(1, { duration: LABEL_MS, easing: OUT })
    pop.value = withTiming(1, { duration: KNOT_MS, easing: KNOT_EASE })
  }, [moves, drawn, rise, pop])
  const labelMotion = useAnimatedStyle(() => ({ opacity: rise.value, transform: [{ translateY: (1 - rise.value) * 4 }] }))
  const knotMotion = useAnimatedStyle(() => ({ transform: [{ scale: 0.6 + pop.value * 0.4 }] }))
  const parts = kind === 'label' || kind === 'icon'
  const ruleKind = parts ? 'line' : kind
  const rule = <Rule kind={ruleKind} vertical={vertical} styles={styles} ink={colors.ink10} moves={moves} drawn={drawn} />
  return (
    <View
      accessible={semantic || kind === 'label'}
      aria-hidden={!semantic && kind !== 'label'}
      importantForAccessibility={semantic || kind === 'label' ? 'auto' : 'no-hide-descendants'}
      {...(kind === 'label' && label ? { accessibilityLabel: label } : {})}
      style={[vertical ? styles.vertical : styles.horizontal, kind === 'label' ? styles.gapLabel : null, kind === 'icon' ? styles.gapIcon : null, style]}
    >
      {rule}
      {kind === 'label' ? <Animated.Text style={[styles.label, labelMotion]}>{(label ?? '').toUpperCase()}</Animated.Text> : null}
      {kind === 'icon' ? (
        <Animated.View style={[styles.knot, knotMotion]}>
          {icon ?? (
            <Svg width={12} height={12} viewBox="0 0 24 24" fill="none">
              <Line x1={12} y1={5} x2={12} y2={19} stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
              <Line x1={5} y1={12} x2={19} y2={12} stroke={colors.textSecondary} strokeWidth={2} strokeLinecap="round" />
            </Svg>
          )}
        </Animated.View>
      ) : null}
      {parts ? rule : null}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  horizontal: { flexDirection: 'row', alignItems: 'center', width: '100%', minHeight: 1 },
  vertical: { alignSelf: 'stretch', alignItems: 'center', minWidth: 1, minHeight: 14 },
  gapLabel: { gap: space[2.5] },
  gapIcon: { gap: space[2] },
  ruleHorizontal: { flex: 1, height: 1 },
  ruleVertical: { flex: 1, width: 1 },
  ruleLine: { backgroundColor: c.ink8 },
  label: { fontFamily: font.mono, fontSize: 11, lineHeight: 14, color: c.textTertiary },
  knot: { alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: radius.full, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
})
