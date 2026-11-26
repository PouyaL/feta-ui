import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown, FadeOut, LinearTransition, ZoomIn, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated'
import { accent, font, pressedState, radius, space, useColors, type Colors } from '../kit'
import { Avatar, type AvatarPerson } from './avatar'
import { Badge } from './badge'
import { Button, withInk, SELF } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { iconFor } from './label'

const FAST_MS = 150
const PULSE_MS = 1200
const STAGGER_MS = 40
const POP = { stiffness: 420, damping: 26, mass: 1 } as const
/** Values and rows update in 240 ms on the standard ease, from the Meeting Finder Motion frame. */
const UPDATE_MS = 240
const EASE_STANDARD = Easing.bezier(0.25, 0.1, 0.25, 1)
/** Avatar 20, the 44 name column on Mobile, and the 8 gaps either side of it: where the lanes start. */
const NAME = 44
const GUTTER = 20 + space[2] * 2 + NAME
const OUT = Easing.bezier(0.23, 1, 0.32, 1)
const EASE_OUT = Easing.bezierFn(0.23, 1, 0.32, 1)
const chipIn = ZoomIn.springify().stiffness(POP.stiffness).damping(POP.damping).mass(POP.mass).withInitialValues({ transform: [{ scale: 0.9 }] })
const chipMove = LinearTransition.springify().stiffness(POP.stiffness).damping(POP.damping).mass(POP.mass)
const resultIn = (delay: number) => FadeIn.duration(UPDATE_MS).delay(delay)
/** Panel: fade and rise 8 in 400 ms on first render. */
const finderIn = FadeInDown.duration(400).easing(EASE_OUT).withInitialValues({ opacity: 0, transform: [{ translateY: 8 }] })

export type FinderPerson = {
  id: string
  name: string
  busy: [start: number, end: number][]
  /** One of the illustrated people for the avatar. */
  person?: AvatarPerson
  /** A real photo for the avatar. */
  src?: string
  /** Shown when there is no photo or person. Defaults to the first letters of the first two words of `name`. */
  initials?: string
}
export type FinderSuggestion = { id: string; label: string; start: number; end: number; note: string; /** Marks a note worth a second look. */ warning?: boolean }
export type FinderConstraintKind = 'duration' | 'people' | 'date' | 'time'
export type FinderConstraint = {
  label: string
  /** Secondary detail after the label. Mobile keeps it for screen readers only, as the web does. */
  value?: string
  /** Picks the leading icon: clock, person, calendar or sun. */
  kind?: FinderConstraintKind
}

const KIND_ICON: Record<FinderConstraintKind, string> = { duration: 'clock', people: 'user', date: 'calendar', time: 'sun' }
const initialsOf = (name: string): string => name.trim().split(/\s+/).slice(0, 2).map((word) => word.charAt(0)).join('').toUpperCase()
/** Mobile shows three chips unless they can be removed; the rest stay for screen readers. */
const SHOWN_CHIPS = 3

export type MeetingFinderProps = {
  people: FinderPerson[]
  /** The prompt the field starts with. */
  defaultPrompt?: string
  /** Constraints shown as chips. */
  defaultConstraints?: FinderConstraint[]
  /** Adds a remove button to each chip. Default `false`. */
  removable?: boolean
  /** The day and range over the timeline, like Tue, Nov 3 and 9 AM to 12 PM ET. */
  day?: string
  range?: string
  /** Ranked times for a prompt, best first. */
  onFind: (prompt: string, constraints: FinderConstraint[]) => Promise<FinderSuggestion[]>
  onPick?: (suggestion: FinderSuggestion) => void
  /** Shown when onFind rejects. */
  failedMessage?: string
  /** Shown when onFind resolves with no times. */
  emptyMessage?: string
  placeholder?: string
  /** The first and last hour of the timeline. */
  from?: number
  to?: number
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Skeleton({ still }: { still: boolean }) {
  const styles = useThemed(createStyles)
  const opacity = useSharedValue(1)
  useEffect(() => {
    if (still) return undefined
    opacity.value = withRepeat(withTiming(0.5, { duration: PULSE_MS, easing: OUT }), -1, true)
    return () => cancelAnimation(opacity)
  }, [opacity, still])
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return <Animated.View style={[styles.skeleton, pulse]} />
}

function Track({ start, end, shown, still }: { start: SharedValue<number>; end: SharedValue<number>; shown: boolean; still: boolean }) {
  const styles = useThemed(createStyles)
  const place = useAnimatedStyle(() => ({ left: `${start.value * 100}%`, width: `${(end.value - start.value) * 100}%` }))
  return shown ? <Animated.View pointerEvents="none" {...(still ? {} : { entering: FadeIn.duration(UPDATE_MS) })} style={[styles.proposed, place]} /> : null
}

/** Ask for a meeting in plain words, then compare ranked times on everyone's timeline. */
export function MeetingFinder({ people, defaultPrompt = '', defaultConstraints = [], removable = false, day, range, onFind, onPick, failedMessage = 'Could not find times. Try again.', emptyMessage = 'No time fits everyone. Try fewer constraints.', placeholder = 'Find an hour with the team next week', from = 9, to = 12, renderIcon, animated = true, style }: MeetingFinderProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [constraints, setConstraints] = useState(defaultConstraints)
  const [status, setStatus] = useState<'idle' | 'searching' | 'done' | 'failed'>('idle')
  const [results, setResults] = useState<FinderSuggestion[]>([])
  const [picked, setPicked] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const alive = useRef(true)
  const placed = useRef(false)
  const trackStart = useSharedValue(0)
  const trackEnd = useSharedValue(0)
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
    trackStart.value = jump ? start : withTiming(start, { duration: UPDATE_MS, easing: EASE_STANDARD })
    trackEnd.value = jump ? end : withTiming(end, { duration: UPDATE_MS, easing: EASE_STANDARD })
    placed.current = true
  }, [best, from, span, still, trackStart, trackEnd])

  async function find(): Promise<void> {
    if (status === 'searching') return
    setStatus('searching')
    let found: FinderSuggestion[]
    try {
      found = await onFind(prompt, constraints)
    } catch {
      if (alive.current) { setResults([]); setPicked(null); setStatus('failed') }
      return
    }
    if (!alive.current) return
    setResults(found)
    setPicked(found[0]?.id ?? null)
    setStatus('done')
  }

  const percent = (value: number): `${number}%` => `${(value / span) * 100}%`
  const icon = (name: string, size: number, color: string): ReactNode => (renderIcon ? withInk(renderIcon(name, size), color) : null)

  return (
    <Animated.View {...(still ? {} : { entering: finderIn })} accessibilityLabel="Find a meeting time" style={[styles.finder, style]}>
      <View style={styles.body}>
        <View style={[styles.prompt, focused && styles.promptFocused]}>
          {iconFor(renderIcon, 'sparkles', 16, colors.textSecondary)}
          <View style={styles.field}>
            {/* The mirror clamps the prompt to two lines with an ending ellipsis while the field is not focused. */}
            <Text aria-hidden numberOfLines={2} style={[styles.mirror, !prompt && styles.mirrorEmpty, focused && styles.hidden]}>{prompt || placeholder}</Text>
            <TextInput
              accessibilityLabel="Describe the meeting"
              multiline
              placeholder={focused ? placeholder : ''}
              placeholderTextColor={colors.textTertiary}
              returnKeyType="search"
              submitBehavior="blurAndSubmit"
              style={[styles.entry, !focused && styles.entryResting]}
              value={prompt}
              onBlur={() => setFocused(false)}
              onChangeText={setPrompt}
              onFocus={() => setFocused(true)}
              onSubmitEditing={() => void find()}
            />
          </View>
          <Button style={SELF.center}
            size="sm" shape="pill" animated={animated} accessibilityLabel="Find times"
            status={status === 'searching' ? 'loading' : 'idle'}
            hitSlop={8} contentStyle={styles.find}
            trailingIcon={icon('chevron-right', 14, colors.textInverse)}
            onPress={() => void find()}
          >Find</Button>
        </View>
        {constraints.length ? (
          <View role="group" accessibilityLabel="Constraints" style={styles.chips}>
            {constraints.map((one, i) => {
              const tucked = !removable && i >= SHOWN_CHIPS
              if (tucked) return <Text key={one.label} style={styles.srOnly}>{one.value ? `${one.label}, ${one.value}` : one.label}</Text>
              return (
                <Animated.View
                  key={one.label}
                  {...(still ? {} : { entering: chipIn, exiting: FadeOut.duration(FAST_MS), layout: chipMove })}
                  accessible={!removable}
                  accessibilityLabel={one.value ? `${one.label}, ${one.value}` : one.label}
                  style={styles.chip}
                >
                  {one.kind ? icon(KIND_ICON[one.kind], 12, colors.textSecondary) : null}
                  <Text style={styles.chipLabel}>{one.label}</Text>
                  {removable ? (
                    <Pressable accessibilityLabel={`Remove ${one.label}`} accessibilityRole="button" hitSlop={14} style={styles.remove} onPress={() => setConstraints((all) => all.filter((item) => item !== one))}>
                      {iconFor(renderIcon, 'x', 12, colors.textTertiary)}
                    </Pressable>
                  ) : null}
                </Animated.View>
              )
            })}
          </View>
        ) : null}
        <View style={styles.rule} />
        <View aria-hidden style={styles.day}>
          {day || range ? (
            <View style={styles.head}>
              <Text numberOfLines={1} style={styles.dayName}>{day}</Text>
              <Text style={styles.range}>{range}</Text>
            </View>
          ) : null}
          <View style={styles.lanes}>
            {people.map((person) => (
              <View key={person.id} style={styles.person}>
                <Avatar size="xs" {...(person.person ? { person: person.person } : {})} {...(person.src ? { src: person.src } : {})} initials={person.initials ?? initialsOf(person.name)} animated={animated} />
                <Text numberOfLines={1} style={styles.name}>{person.name}</Text>
                <View style={styles.lane}>
                  {person.busy.map(([s, e]) => <View key={s} style={[styles.busy, { left: percent(s - from), width: percent(e - s) }]} />)}
                </View>
              </View>
            ))}
            <View pointerEvents="none" style={styles.track}>
              <Track start={trackStart} end={trackEnd} shown={status === 'done' && Boolean(best)} still={still} />
            </View>
          </View>
          <View style={styles.axis}>
            {Array.from({ length: span + 1 }, (_, i) => <Text key={i} style={styles.hour}>{(from + i) % 12 || 12} {from + i >= 12 ? 'PM' : 'AM'}</Text>)}
          </View>
        </View>
        {status === 'idle' ? null : <View style={styles.rule} />}
        <View accessibilityLiveRegion="polite">
          {status === 'searching' ? (
            <View accessibilityLabel="Searching" style={styles.skeletons}>
              {[0, 1, 2].map((i) => <Skeleton key={i} still={still} />)}
            </View>
          ) : status === 'failed' ? (
            <Text style={[styles.message, styles.failed]}>{failedMessage}</Text>
          ) : status === 'done' && results.length === 0 ? (
            <Text style={styles.message}>{emptyMessage}</Text>
          ) : status === 'done' ? (
            <View style={styles.list}>
              {results.map((one, i) => (
                <Animated.View key={one.id} {...(still ? {} : { entering: resultIn(i * STAGGER_MS) })}>
                  <Pressable
                    accessibilityLabel={`${one.label}, ${one.note}`}
                    accessibilityRole="button"
                    {...pressedState(picked === one.id)}
                    style={({ pressed }) => [styles.suggestion, picked === one.id && styles.suggestionOn, pressed && !still && styles.pressed]}
                    onPress={() => { setPicked(one.id); onPick?.(one) }}
                  >
                    <View style={styles.text}>
                      <Text numberOfLines={1} style={styles.slot}>{one.label}</Text>
                      <View style={styles.noteRow}>
                        {icon(one.warning ? 'alert-02' : 'check', 12, one.warning ? colors.warning : colors.success)}
                        <Text numberOfLines={1} style={styles.note}>{one.note}</Text>
                      </View>
                    </View>
                    {i === 0 ? <Badge tone="success" size="sm" animated={animated}>Best</Badge> : null}
                    {icon('chevron-right', 14, colors.textTertiary)}
                  </Pressable>
                </Animated.View>
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  finder: { backgroundColor: c.ink4, borderRadius: radius.frame, padding: space[1], width: '100%' },
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: 1, overflow: 'hidden' },
  prompt: { alignItems: 'center', borderColor: 'transparent', borderTopLeftRadius: radius.panel - 1, borderTopRightRadius: radius.panel - 1, borderWidth: 1.5, flexDirection: 'row', gap: space[2.5], paddingBottom: space[2.5] - 1.5, paddingLeft: space[3.5] - 1.5, paddingRight: space[2.5] - 1.5, paddingTop: space[2.5] - 1.5 },
  promptFocused: { borderColor: c.textPrimary },
  field: { flex: 1, minWidth: 0 },
  mirror: { ...type(16, c.textPrimary), lineHeight: 22 },
  mirrorEmpty: { color: c.textTertiary },
  hidden: { opacity: 0 },
  entry: { ...StyleSheet.absoluteFill, color: c.textPrimary, fontFamily: font.sans, fontSize: 16, includeFontPadding: false, letterSpacing: font.tracking(16), lineHeight: 22, padding: 0, paddingTop: 0, textAlignVertical: 'top' },
  entryResting: { color: 'transparent' },
  find: { height: space[7], paddingHorizontal: space[2.5] },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space[1.5], paddingBottom: space[3], paddingHorizontal: space[3.5] },
  chip: { alignItems: 'center', borderColor: c.ink10, borderRadius: radius.full, borderWidth: 1, flexDirection: 'row', gap: space[1.5], height: 30, paddingHorizontal: space[2.5] },
  chipLabel: { ...type(12, c.textPrimary, '500'), lineHeight: 16 },
  remove: { alignItems: 'center', height: 16, justifyContent: 'center', marginRight: -space[1], width: 16 },
  srOnly: { height: 1, opacity: 0, overflow: 'hidden', position: 'absolute', width: 1 },
  rule: { backgroundColor: c.ink8, height: 1 },
  day: { gap: space[2], paddingHorizontal: space[4], paddingVertical: space[3.5] },
  head: { alignItems: 'flex-start', flexDirection: 'row', gap: space[2] },
  dayName: { ...type(14, c.textPrimary, '500'), flex: 1, lineHeight: 20 },
  range: { ...type(12, c.textTertiary), lineHeight: 16 },
  lanes: { gap: space[1.5] },
  person: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  name: { ...type(12, c.textPrimary), lineHeight: 16, width: NAME },
  lane: { backgroundColor: c.ink4, borderRadius: radius.md, flex: 1, height: 20 },
  busy: { backgroundColor: c.ink10, borderRadius: radius.md, bottom: 0, position: 'absolute', top: 0 },
  track: { bottom: -space[1], left: GUTTER, position: 'absolute', right: 0, top: -space[1] },
  proposed: { backgroundColor: c.ink4, borderColor: accent.emerald.deep, borderRadius: radius.lg, borderWidth: 2, bottom: 0, position: 'absolute', top: 0 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginLeft: GUTTER - space[1] },
  hour: { ...type(10, c.textTertiary), lineHeight: 14 },
  skeletons: { gap: space[2], paddingHorizontal: space[4], paddingVertical: space[3.5] },
  skeleton: { backgroundColor: c.ink4, borderRadius: radius.xl, height: 40 },
  message: { ...type(12, c.textSecondary), lineHeight: 16, paddingHorizontal: space[4], paddingVertical: space[3.5] },
  failed: { color: c.danger },
  list: { gap: space[1], padding: space[2] },
  suggestion: { alignItems: 'center', borderRadius: radius.xl, flexDirection: 'row', gap: space[2.5], paddingHorizontal: space[3], paddingVertical: space[2.5] },
  suggestionOn: { backgroundColor: c.ink4 },
  pressed: { transform: [{ scale: 0.98 }] },
  text: { flex: 1, gap: space[0.5], minWidth: 0 },
  slot: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  noteRow: { alignItems: 'center', flexDirection: 'row', gap: space[1], minWidth: 0 },
  note: { ...type(12, c.textSecondary), flexShrink: 1, lineHeight: 16 },
})
