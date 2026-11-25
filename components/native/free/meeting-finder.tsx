import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown, FadeOut, LinearTransition, ZoomIn, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming, type SharedValue } from 'react-native-reanimated'
import { font, pressedState, radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { iconFor } from './label'

const OPEN_MS = 180
const FAST_MS = 150
const PULSE_MS = 1200
const STAGGER_MS = 40
const POP = { stiffness: 420, damping: 26, mass: 1 } as const
const ROW = { stiffness: 320, damping: 30, mass: 1 } as const
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const chipIn = ZoomIn.springify().stiffness(POP.stiffness).damping(POP.damping).mass(POP.mass).withInitialValues({ transform: [{ scale: 0.9 }] })
const chipMove = LinearTransition.springify().stiffness(POP.stiffness).damping(POP.damping).mass(POP.mass)
const resultIn = (delay: number) => FadeInDown.duration(OPEN_MS).delay(delay).easing(EASE_OUT).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })

export type FinderPerson = { id: string; name: string; busy: [start: number, end: number][] }
export type FinderSuggestion = { id: string; label: string; start: number; end: number; note: string; /** Marks a note worth a second look. */ warning?: boolean }
export type FinderConstraint = { label: string; value: string }

export type MeetingFinderProps = {
  people: FinderPerson[]
  /** The prompt the field starts with. */
  defaultPrompt?: string
  /** Constraints shown as removable chips. */
  defaultConstraints?: FinderConstraint[]
  /** The day and range over the timeline, like Tue, Nov 3 and 9 AM to 12 PM ET. */
  day?: string
  range?: string
  /** Ranked times for a prompt, best first. */
  onFind: (prompt: string, constraints: FinderConstraint[]) => Promise<FinderSuggestion[]>
  onPick?: (suggestion: FinderSuggestion) => void
  placeholder?: string
  /** The first and last hour of the timeline. */
  from?: number
  to?: number
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Skeleton() {
  const styles = useThemed(createStyles)
  const opacity = useSharedValue(1)
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.5, { duration: PULSE_MS, easing: OUT }), -1, true)
    return () => cancelAnimation(opacity)
  }, [opacity])
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={[styles.skeleton, pulse]} />
}

function Ring({ start, end, width, shown }: { start: SharedValue<number>; end: SharedValue<number>; width: SharedValue<number>; shown: boolean }) {
  const styles = useThemed(createStyles)
  const place = useAnimatedStyle(() => ({ left: start.value * width.value, width: (end.value - start.value) * width.value }))
  return shown ? <Animated.View style={[styles.ring, place]} /> : null
}

/** Ask for a meeting in plain words, then compare ranked times on everyone's timeline. */
export function MeetingFinder({ people, defaultPrompt = '', defaultConstraints = [], day, range, onFind, onPick, placeholder = 'Find an hour with the team next week', from = 9, to = 12, renderIcon, animated = true, style }: MeetingFinderProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [constraints, setConstraints] = useState(defaultConstraints)
  const [status, setStatus] = useState<'idle' | 'searching' | 'done'>('idle')
  const [results, setResults] = useState<FinderSuggestion[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const alive = useRef(true)
  const placed = useRef(false)
  const laneWidth = useSharedValue(0)
  const ringStart = useSharedValue(0)
  const ringEnd = useSharedValue(0)
  const best = results.find((one) => one.id === picked)
  const span = to - from

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])

  useEffect(() => {
    if (!best) { placed.current = false; return }
    const start = (best.start - from) / span
    const end = (best.end - from) / span
    const jump = still || !placed.current
    ringStart.value = jump ? start : withSpring(start, ROW)
    ringEnd.value = jump ? end : withSpring(end, ROW)
    placed.current = true
  }, [best, from, span, still, ringStart, ringEnd])

  async function find(): Promise<void> {
    setStatus('searching')
    const found = await onFind(prompt, constraints).catch(() => [])
    if (!alive.current) return
    setResults(found)
    setPicked(found[0]?.id ?? null)
    setStatus('done')
  }

  const percent = (value: number): `${number}%` => `${(value / span) * 100}%`

  return (
    <View accessibilityLabel="Find a meeting time" style={[styles.finder, style]}>
      <View style={[styles.prompt, focused && styles.promptFocused]}>
        {iconFor(renderIcon, 'sparkles', 16, colors.textSecondary)}
        <TextInput
          accessibilityLabel="Describe the meeting"
          placeholder={placeholder}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="search"
          style={styles.entry}
          value={prompt}
          onBlur={() => setFocused(false)}
          onChangeText={setPrompt}
          onFocus={() => setFocused(true)}
          onSubmitEditing={() => void find()}
        />
        <Button size="sm" animated={animated} status={status === 'searching' ? 'loading' : 'idle'} onPress={() => void find()}>Find times</Button>
      </View>
      {constraints.length ? (
        <View role="group" accessibilityLabel="Constraints" style={styles.chips}>
          {constraints.map((one) => (
            <Animated.View key={one.label} {...(still ? {} : { entering: chipIn, exiting: FadeOut.duration(FAST_MS), layout: chipMove })} style={styles.chip}>
              <Text style={styles.chipLabel}>{one.label}</Text>
              <Text style={styles.chipValue}>{one.value}</Text>
              <Pressable accessibilityLabel={`Remove ${one.label}`} accessibilityRole="button" hitSlop={13} onPress={() => setConstraints((all) => all.filter((item) => item !== one))}>
                {iconFor(renderIcon, 'x', 12, colors.textSecondary)}
              </Pressable>
            </Animated.View>
          ))}
        </View>
      ) : null}
      <View aria-hidden style={styles.timeline}>
        {day ? (
          <View style={styles.timelineHead}>
            <Text style={styles.timelineDay}>{day}</Text>
            <Text style={styles.mono}>{range}</Text>
          </View>
        ) : null}
        {people.map((person) => (
          <View key={person.id} style={styles.person}>
            <Text numberOfLines={1} style={styles.name}>{person.name}</Text>
            <View style={styles.lane} onLayout={(e: LayoutChangeEvent) => { laneWidth.value = e.nativeEvent.layout.width }}>
              {person.busy.map(([s, e]) => <View key={s} style={[styles.busy, { left: percent(s - from), width: percent(e - s) }]} />)}
              <Ring start={ringStart} end={ringEnd} width={laneWidth} shown={status === 'done' && Boolean(best)} />
            </View>
          </View>
        ))}
        <View style={styles.person}>
          <View style={styles.name} />
          <View style={styles.axis}>
            {Array.from({ length: span + 1 }, (_, i) => <Text key={i} style={styles.mono}>{(from + i) % 12 || 12} {from + i >= 12 ? 'PM' : 'AM'}</Text>)}
          </View>
        </View>
      </View>
      <View accessibilityLiveRegion="polite" style={styles.results}>
        {status === 'searching' ? (
          <View accessibilityLabel="Searching" style={styles.list}>
            {[0, 1, 2].map((i) => <Skeleton key={i} />)}
          </View>
        ) : status === 'done' ? (
          <View style={styles.list}>
            {results.map((one, i) => (
              <Animated.View key={one.id} {...(still ? {} : { entering: resultIn(i * STAGGER_MS) })}>
                <Pressable
                  accessibilityLabel={`${one.label}, ${one.note}`}
                  accessibilityRole="button"
                  {...pressedState(picked === one.id)}
                  style={[styles.suggestion, picked === one.id && styles.suggestionOn]}
                  onPress={() => { setPicked(one.id); onPick?.(one) }}
                >
                  <View style={styles.label}>
                    <Text style={styles.labelTitle}>{one.label}</Text>
                    <View style={styles.noteRow}>
                      {one.warning ? iconFor(renderIcon, 'alert-circle', 14, colors.textPrimary) : null}
                      <Text style={[styles.note, one.warning && styles.noteWarning]}>{one.note}</Text>
                    </View>
                  </View>
                  {i === 0 ? <View style={styles.best}><Text style={styles.bestText}>Best</Text></View> : null}
                </Pressable>
              </Animated.View>
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  finder: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.frame, borderWidth: 1, gap: space[3], padding: space[4], width: '100%' },
  prompt: { alignItems: 'center', backgroundColor: c.ink4, borderColor: 'transparent', borderRadius: radius['2xl'], borderWidth: 1.5, flexDirection: 'row', gap: space[2], minHeight: 44, paddingLeft: space[3], paddingRight: space[1], paddingVertical: space[1] },
  promptFocused: { borderColor: c.textPrimary },
  entry: { color: c.textPrimary, flex: 1, fontFamily: font.sans, fontSize: 16, includeFontPadding: false, letterSpacing: font.tracking(16), minWidth: 0, paddingVertical: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1.5] },
  chip: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, flexDirection: 'row', gap: space[1], height: 26, paddingLeft: space[2.5], paddingRight: space[1.5] },
  chipLabel: type(12, c.textPrimary, '500'),
  chipValue: type(12, c.textSecondary),
  timeline: { gap: space[1.5] },
  timelineHead: { flexDirection: 'row', justifyContent: 'space-between' },
  timelineDay: type(14, c.textPrimary, '500'),
  mono: type(12, c.textTertiary, '400', true),
  person: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  name: { ...type(14, c.textSecondary, '500'), width: 72 },
  lane: { backgroundColor: c.ink4, borderRadius: radius.lg, flex: 1, height: 24 },
  busy: { backgroundColor: c.ink10, borderRadius: radius.md, bottom: 0, position: 'absolute', top: 0 },
  ring: { borderColor: c.textPrimary, borderRadius: radius.lg, borderWidth: 1.5, bottom: -2, position: 'absolute', top: -2 },
  axis: { flex: 1, flexDirection: 'row', justifyContent: 'space-between' },
  results: { minHeight: 120 },
  list: { gap: space[1.5] },
  skeleton: { backgroundColor: c.ink5, borderRadius: radius.xl, height: 44 },
  suggestion: { alignItems: 'center', backgroundColor: c.ink4, borderColor: 'transparent', borderRadius: radius.xl, borderWidth: 1.5, flexDirection: 'row', gap: space[2], justifyContent: 'space-between', minHeight: 44, paddingHorizontal: space[3], paddingVertical: space[2] },
  suggestionOn: { borderColor: c.textPrimary },
  label: { flex: 1, minWidth: 0 },
  labelTitle: type(15, c.textPrimary, '500'),
  noteRow: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
  note: { ...type(12, c.textSecondary), flexShrink: 1 },
  noteWarning: { color: c.textPrimary },
  best: { backgroundColor: c.ink5, borderRadius: radius.full, paddingHorizontal: space[2], paddingVertical: space[0.5] },
  bestText: type(12, c.success, '500'),
})
