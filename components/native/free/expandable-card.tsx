import { useEffect, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut, useAnimatedProps, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { Checkbox } from './checkbox'
import { DisclosurePanel } from './collapsible'

const MARK_SPRING = { duration: 240, dampingRatio: 0.7 } as const
const RING_SIZE = 28
const RING_STROKE = 3
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2
const RING_LENGTH = 2 * Math.PI * RING_RADIUS
const RING_MS = 600
const CHEVRON_MS = 200
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const AnimatedCircle = Animated.createAnimatedComponent(Circle)

export type ExpandableStep = { id: string; label: string; meta?: string }

export type ExpandableCardProps = {
  title: string
  /** Everything being tracked. The ring and count follow how many are checked. */
  total: number
  /** Steps still open, shown with checkboxes. */
  steps: ExpandableStep[]
  /** Items already done outside `steps`. */
  completed?: number
  heading?: string
  body?: string
  completeHeading?: string
  completeBody?: string
  /** The action shown once every step is done. */
  actionLabel?: string
  onAction?: () => void
  defaultOpen?: boolean
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Ring({ done, total, complete, still, renderIcon }: { done: number; total: number; complete: boolean; still: boolean; renderIcon: RenderIcon }) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const fraction = done / total
  const shown = useSharedValue(fraction)
  const mark = useSharedValue(complete ? 1 : 0.6)
  useEffect(() => {
    shown.value = still ? fraction : withTiming(fraction, { duration: RING_MS, easing: OUT })
  }, [fraction, still, shown])
  useEffect(() => {
    if (complete) mark.value = still ? 1 : withSpring(1, MARK_SPRING)
    else mark.value = 0.6
  }, [complete, still, mark])
  const arc = useAnimatedProps(() => ({ strokeDashoffset: RING_LENGTH * (1 - shown.value) }))
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: mark.value }] }))
  if (complete) {
    return <Animated.View {...(still ? {} : { entering: FadeIn.duration(120) })} style={[styles.mark, pop]}>{renderIcon('tick-02', 16)}</Animated.View>
  }
  return (
    <Animated.View {...(still ? {} : { exiting: FadeOut.duration(120) })} style={styles.ring}>
      <Svg aria-hidden width={RING_SIZE} height={RING_SIZE} fill="none">
        <Circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke={colors.ink8} strokeWidth={RING_STROKE} />
        <AnimatedCircle animatedProps={arc} cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} stroke={colors.inverse} strokeWidth={RING_STROKE} strokeLinecap="round" strokeDasharray={[RING_LENGTH, RING_LENGTH]} />
      </Svg>
    </Animated.View>
  )
}

/** A task summary that opens into steps. The ring fills as they are checked, then turns to a mark. */
export function ExpandableCard({ title, total, steps, completed = 0, heading, body, completeHeading = 'Ready to publish', completeBody, actionLabel = 'Publish release', onAction, defaultOpen = false, renderIcon, animated = true, style }: ExpandableCardProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [open, setOpen] = useState(defaultOpen)
  const [checked, setChecked] = useState<string[]>([])
  const done = Math.min(total, completed + checked.length)
  const complete = done >= total
  const summary = `${done} of ${total} items complete`
  const turn = useSharedValue(open ? 0 : 180)
  useEffect(() => {
    turn.value = still ? (open ? 0 : 180) : withTiming(open ? 0 : 180, { duration: CHEVRON_MS, easing: OUT })
  }, [open, still, turn])
  const chevron = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  const copy: ReactNode = complete ? completeBody : body
  return (
    <View style={[styles.tray, style]}>
      <Pressable accessibilityRole="button" accessibilityLabel={`${title}, ${summary}`} aria-expanded={open} onPress={() => setOpen(!open)} style={({ pressed }) => [styles.trigger, pressed ? styles.triggerPressed : null]}>
        <Ring done={done} total={total} complete={complete} still={still} renderIcon={renderIcon} />
        <View style={styles.summary}>
          <Text style={styles.title}>{title}</Text>
          <Text accessibilityLiveRegion="polite" style={styles.meta}>{summary}</Text>
        </View>
        <Animated.View style={[styles.chevron, chevron]}>{renderIcon('chevron-up', 16)}</Animated.View>
      </Pressable>
      <DisclosurePanel open={open} still={still} animated={animated}>
        <View style={styles.card}>
          <Text style={styles.title}>{complete ? completeHeading : heading}</Text>
          {copy ? <Text style={styles.body}>{copy}</Text> : null}
          {complete ? (
            <Animated.View {...(still ? {} : { entering: FadeIn })} style={styles.action}>
              <Button shape="pill" size="sm" animated={animated} trailingIcon={renderIcon('arrow-up-right', 16)} {...(onAction ? { onPress: onAction } : {})}>{actionLabel}</Button>
            </Animated.View>
          ) : (
            <View>
              {steps.map((step) => (
                <View key={step.id} style={styles.step}>
                  <Checkbox accessibilityLabel={step.label} animated={animated} checked={checked.includes(step.id)} onCheckedChange={(on: boolean) => setChecked((list) => (on ? [...list, step.id] : list.filter((id) => id !== step.id)))} />
                  <View style={styles.stepText}>
                    <Text style={styles.stepLabel}>{step.label}</Text>
                    {step.meta ? <Text style={styles.meta}>{step.meta}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      </DisclosurePanel>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tray: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: space[3], width: '100%', minHeight: 56, paddingVertical: space[2], paddingLeft: space[3], paddingRight: space[2], borderRadius: radius.card },
  triggerPressed: { backgroundColor: c.ink4 },
  ring: { width: RING_SIZE, height: RING_SIZE, transform: [{ rotate: '-90deg' }] },
  mark: { alignItems: 'center', justifyContent: 'center', width: RING_SIZE, height: RING_SIZE, borderRadius: radius.full, backgroundColor: c.success },
  summary: { flex: 1, minWidth: 0 },
  title: type(14, c.textPrimary, '500'),
  meta: type(12, c.textSecondary),
  chevron: { alignItems: 'center', justifyContent: 'center', width: 36, height: 36 },
  card: { gap: space[2], marginTop: space[1], padding: space[4], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  body: { ...type(14, c.textSecondary), lineHeight: 21 },
  action: { alignItems: 'flex-start' },
  step: { flexDirection: 'row', alignItems: 'center', gap: space[3], paddingVertical: space[2], borderTopWidth: 1, borderTopColor: c.ink5 },
  stepText: { flex: 1, flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[3], minWidth: 0 },
  stepLabel: { ...type(14, c.textPrimary), flexShrink: 1 },
})
