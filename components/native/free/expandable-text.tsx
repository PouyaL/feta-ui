import { useEffect, useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { space, type Colors } from '../kit'
import { Button } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'

const UNROLL_MS = 320
const CHEVRON_MS = 200
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const unroll = LinearTransition.duration(UNROLL_MS).easing(Easing.bezierFn(0.23, 1, 0.32, 1))

export type ExpandableTextProps = {
  /** One string per paragraph. */
  children: string | string[]
  /** Lines shown while collapsed. Default 3. */
  lines?: number
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  moreLabel?: string
  lessLabel?: string
  /** Spoken in place of Read more. */
  moreAccessibilityLabel?: string
  /** Draws the chevron on the toggle. */
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Copy longer than three lines. It clamps on a line boundary and unrolls where you were reading. */
export function ExpandableText({ children, lines = 3, defaultOpen = false, onOpenChange, moreLabel = 'Read more', lessLabel = 'Read less', moreAccessibilityLabel = 'Show the full description', renderIcon, animated = true, style }: ExpandableTextProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const paragraphs = typeof children === 'string' ? [children] : children
  const [first = '', ...rest] = paragraphs
  const [open, setOpen] = useState(defaultOpen)
  const [overflows, setOverflows] = useState(false)
  const fits = rest.length === 0 && !overflows
  const turn = useSharedValue(open ? 0 : 180)
  useEffect(() => {
    turn.value = still ? (open ? 0 : 180) : withTiming(open ? 0 : 180, { duration: CHEVRON_MS, easing: OUT })
  }, [open, still, turn])
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))

  function toggle(): void {
    setOpen(!open)
    onOpenChange?.(!open)
  }

  return (
    <View style={[styles.root, style]}>
      <Animated.View {...(still ? {} : { layout: unroll })} style={styles.text}>
        <View style={styles.measure} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Text style={styles.body} onTextLayout={(e) => setOverflows(e.nativeEvent.lines.length > lines)}>{first}</Text>
        </View>
        <Text style={styles.body} {...(open ? {} : { numberOfLines: lines })}>{first}</Text>
        {open ? rest.map((paragraph, i) => <Text key={i} style={styles.body}>{paragraph}</Text>) : null}
      </Animated.View>
      {fits ? null : (
        <View style={styles.toggle}>
          <Button
            variant="ghost"
            size="sm"
            animated={animated}
            aria-expanded={open}
            {...(open ? {} : { accessibilityLabel: moreAccessibilityLabel })}
            {...(renderIcon ? { trailingIcon: <Animated.View style={chevron}>{renderIcon('chevron-up', 16)}</Animated.View> } : {})}
            onPress={toggle}
          >
            {open ? lessLabel : moreLabel}
          </Button>
        </View>
      )}
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  root: { alignItems: 'flex-start', gap: space[1] },
  text: { width: '100%', gap: space[3], overflow: 'hidden' },
  measure: { position: 'absolute', opacity: 0, left: 0, right: 0 },
  body: { ...type(15, c.textSecondary), lineHeight: 22 },
  toggle: { marginLeft: -space[2] },
})
