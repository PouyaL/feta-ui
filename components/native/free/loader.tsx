import { useEffect, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, ZoomIn, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'
import { font, radius, space, useColors, useReduceMotion, type Colors } from '../kit'
import { withInk } from './button'
import { type, useThemed, type RenderIcon } from './card'
import { Spinner } from './spinner'

/** The rings on Mobile: 88 across, drawn on the web's 76 unit box. */
const RINGS_SIZE = 88
const BOX = 76
const CENTER = BOX / 2
const RINGS = [34, 25, 16] as const
const ARC_SHARE = [24, 32, 24] as const
const WIDTHS = [2, 3, 2] as const
/** One turn per ring: 3 s, 1.2 s, and 4 s the other way. */
const TURN_MS = [3000, 1200, 4000] as const
const TURN_DIR = [1, 1, -1] as const
const SHAKE_LEG_MS = 60
const PULSE_MS = 1600
const STAMP = ZoomIn.springify().stiffness(500).damping(22).mass(1).withInitialValues({ transform: [{ scale: 0.6 }] })
const STILL_IN = FadeIn.duration(120)

export type LoaderStep = {
  label: string
  status: 'done' | 'current' | 'waiting'
  /** Mono value at the end of the row, like DONE or 64%. */
  meta?: string
}

export type LoaderProps = {
  /** Default `spinning`. */
  state?: 'spinning' | 'progress' | 'done' | 'error'
  title: ReactNode
  description?: ReactNode
  /** The percent inside the rings, for `progress`. */
  value?: number
  steps?: LoaderStep[]
  /** Mono note on the tray, like WORKING or ERROR 504. */
  status?: string
  /** Buttons on the tray. */
  actions?: ReactNode
  /** Draws `check` and `x` in the result badge and on done steps. */
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Each arc turns in its own layer, so the three keep their own speeds on the UI thread. */
function Arc({ index, turning }: { index: 0 | 1 | 2; turning: boolean }) {
  const c = useColors()
  const turn = useSharedValue(0)
  useEffect(() => {
    turn.value = 0
    if (!turning) return undefined
    turn.value = withRepeat(withTiming(1, { duration: TURN_MS[index], easing: Easing.linear }), -1, false)
    return () => cancelAnimation(turn)
  }, [turning, index, turn])
  const r = RINGS[index]
  const length = 2 * Math.PI * r
  const dash = (ARC_SHARE[index] / 100) * length
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${TURN_DIR[index] * turn.value * 360}deg` }] }))
  return (
    <Animated.View style={[StyleSheet.absoluteFill, spin]}>
      <Svg aria-hidden width="100%" height="100%" viewBox={`0 0 ${BOX} ${BOX}`} fill="none">
        <Circle cx={CENTER} cy={CENTER} r={r} stroke={index === 1 ? c.textPrimary : c.textSecondary} strokeWidth={WIDTHS[index]} strokeLinecap="round" strokeDasharray={[dash, length]} />
      </Svg>
    </Animated.View>
  )
}

/** Takes over a panel during longer setup, and shows progress, success and failure in place. */
export function Loader({ state = 'spinning', title, description, value = 0, steps, status, actions, renderIcon, animated = true, style }: LoaderProps) {
  const s = useThemed(createStyles)
  const c = useColors()
  const reduce = useReduceMotion()
  // `animated={false}` holds everything. Reduced motion stops the arcs and lets the core breathe instead.
  const turning = animated && !reduce
  const working = state === 'spinning' || state === 'progress'
  const failed = state === 'error'
  const x = useSharedValue(0)
  const core = useSharedValue(1)

  useEffect(() => {
    if (!failed || !turning) return
    const leg = { duration: SHAKE_LEG_MS, easing: Easing.bezier(0.23, 1, 0.32, 1) }
    x.value = withSequence(withTiming(-2, leg), withTiming(2, leg), withTiming(-2, leg), withTiming(0, leg))
  }, [failed, turning, x])

  useEffect(() => {
    core.value = 1
    if (state !== 'spinning' || !animated || !reduce) return undefined
    core.value = withRepeat(withSequence(withTiming(0.5, { duration: PULSE_MS / 2, easing: Easing.linear }), withTiming(1, { duration: PULSE_MS / 2, easing: Easing.linear })), -1, false)
    return () => cancelAnimation(core)
  }, [state, animated, reduce, core])

  const shake = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }] }))
  const breathe = useAnimatedStyle(() => ({ opacity: core.value }))
  const glyph = (name: string, size: number): ReactNode => (renderIcon ? withInk(renderIcon(name, size), c.onSolid) : null)

  return (
    <View aria-busy={working} style={[s.loader, style]}>
      <View style={s.card}>
        <View style={s.head}>
          <Animated.View style={[s.rings, shake]} aria-hidden>
            <Svg aria-hidden width="100%" height="100%" viewBox={`0 0 ${BOX} ${BOX}`} fill="none">
              <Circle cx={CENTER} cy={CENTER} r={RINGS[0] + 3} stroke={failed ? c.danger : c.ink8} strokeWidth={failed ? 2 : 1} />
              <Circle cx={CENTER} cy={CENTER} r={RINGS[2] + 2} stroke={c.ink8} strokeWidth={1} />
            </Svg>
            {working ? ([0, 1, 2] as const).map((i) => <Arc key={i} index={i} turning={turning} />) : null}
            {state === 'done' || failed ? (
              <Animated.View key={state} {...(turning ? { entering: STAMP } : animated ? { entering: STILL_IN } : {})} style={[s.result, failed && s.resultError]}>
                {glyph(failed ? 'x' : 'check', 16)}
              </Animated.View>
            ) : null}
            {state === 'progress' ? <View style={s.center}><Text style={s.percent}>{Math.round(value)}%</Text></View> : null}
            {state === 'spinning' ? <View style={s.center}><Animated.View style={[s.core, breathe]} /></View> : null}
          </Animated.View>
          <View style={s.text} {...(state === 'done' ? { role: 'status' as const, 'aria-live': 'polite' as const } : failed ? { role: 'alert' as const, 'aria-live': 'assertive' as const } : {})}>
            {typeof title === 'string' ? <Text style={s.title}>{title}</Text> : title}
            {description ? (typeof description === 'string' ? <Text style={s.description}>{description}</Text> : description) : null}
          </View>
        </View>
        {steps?.length ? (
          <View role="list" style={s.steps}>
            {steps.map((step) => (
              <View key={step.label} role="listitem" style={s.step}>
                <View style={s.stepMark}>
                  {step.status === 'done' ? <View style={s.stepDone}>{glyph('check', 10)}</View> : null}
                  {step.status === 'current' ? <Spinner size="s" label={null} animated={animated} /> : null}
                  {step.status === 'waiting' ? <View style={s.stepWaiting} /> : null}
                </View>
                <Text numberOfLines={1} style={[s.stepLabel, step.status === 'waiting' && s.stepLabelWaiting]}>{step.label}</Text>
                {step.meta ? <Text style={s.stepMeta}>{step.meta}</Text> : null}
              </View>
            ))}
          </View>
        ) : null}
      </View>
      {status || actions ? (
        <View style={s.footer}>
          <Text style={s.status}>{status?.toUpperCase()}</Text>
          <View style={s.actions}>{actions}</View>
        </View>
      ) : null}
    </View>
  )
}

const createStyles = (c: Colors) => {
  const mono: TextStyle = { color: c.textTertiary, fontFamily: font.mono, fontSize: 11, lineHeight: 16 }
  return StyleSheet.create({
    loader: { backgroundColor: c.ink4, borderRadius: radius.tray, maxWidth: 366, padding: space[1], width: '100%' },
    card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: 1, gap: space[3.5], paddingBottom: space[4], paddingHorizontal: space[4], paddingTop: space[5] },
    head: { alignItems: 'center', gap: space[3.5] },
    rings: { height: RINGS_SIZE, width: RINGS_SIZE },
    center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
    core: { backgroundColor: c.textPrimary, borderRadius: radius.full, height: 4, width: 4 },
    percent: { ...type(12, c.textPrimary, '500'), fontVariant: ['tabular-nums'], lineHeight: 16 },
    // A 10 wide halo stands in for the web's subtle ring: kit.ts has no success or danger subtle fill yet.
    result: { alignItems: 'center', backgroundColor: c.success, borderColor: c.ink5, borderRadius: radius.full, borderWidth: 10, height: 52, justifyContent: 'center', left: (RINGS_SIZE - 52) / 2, position: 'absolute', top: (RINGS_SIZE - 52) / 2, width: 52 },
    resultError: { backgroundColor: c.danger },
    text: { alignItems: 'center', gap: space[0.5] },
    title: { ...type(16, c.textPrimary, '600'), lineHeight: 22, textAlign: 'center' },
    description: { ...type(13, c.textSecondary), lineHeight: 18, textAlign: 'center' },
    steps: { borderTopColor: c.ink8, borderTopWidth: 1, paddingTop: space[2] },
    step: { alignItems: 'center', flexDirection: 'row', gap: space[2], height: 30 },
    stepMark: { alignItems: 'center', height: 16, justifyContent: 'center', width: 16 },
    stepDone: { alignItems: 'center', backgroundColor: c.success, borderRadius: radius.full, height: 16, justifyContent: 'center', width: 16 },
    stepWaiting: { borderColor: c.ink10, borderRadius: radius.full, borderWidth: 1, height: 12, width: 12 },
    stepLabel: { ...type(14, c.textPrimary), flex: 1, lineHeight: 20, minWidth: 0 },
    stepLabelWaiting: { color: c.textTertiary },
    stepMeta: mono,
    footer: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', minHeight: 36, paddingBottom: space[0.5], paddingLeft: space[3], paddingRight: space[2], paddingTop: space[1] },
    status: mono,
    actions: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
  })
}
