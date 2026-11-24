import { useEffect, useId, useMemo, useRef, useState, type ComponentProps, type ReactNode } from 'react'
import { StyleSheet, Text, TextInput, View, useColorScheme, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withDelay, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Defs, Ellipse, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg'
import { accent, radius, space, useColors, type Colors } from '../kit'
import { Button, EASE_OUT, HEIGHT, withInk } from './button'
import { type, useStill, type RenderIcon } from './card'
import { IconButton } from './icon-button'
import { MetalRing, RingDash, ringShape, shadowInk, useAppActive, useTurn } from './metal-frame'

/*
 * What differs from web: the chrome rings are Metal Frame's native ring. The orbit glow, a blurred conic light masked
 * to the spill past the box on the web, is a run of coloured dashes travelling a path 3 px outside the box, each drawn
 * three times at growing width and falling opacity to read as the blur; the box covers whatever falls inside. The
 * loading arc is the same: soft dashes round the 1.5 px band. The focus ring is a diagonal linear gradient in place of
 * the conic one, and the blooms are radial gradients in place of blurred capsules. The pinks have no token on the web
 * either; they use the danger red at reduced strength, and blue-300 and blue-400 map to the sky accent in kit.ts. The
 * fan's droplets travel without the SVG goo filter. Return adds a line on a phone keyboard, so Send is the button;
 * Escape becomes the accessibility escape gesture. Action names show on a long press, where the web shows them on
 * hover and focus. Sizes are the Mobile ones: 44 buttons, 16/22 type, the model button hidden while voice runs.
 */

/** Reduced motion and `animated={false}` hold the beam here. */
const STILL_BEAM = 0.6
/** The box radius, which the chrome ring follows. */
const BOX_RADIUS = radius.frame
/** The send button's own small ring: half its 44 px height. */
const SEND_RADIUS = HEIGHT.md / 2
/** The send ring is a touch dimmer than the box ring. */
const SEND_STRENGTH = 0.9
const TICK_MS = 1000
/** The orbit glow turns every 9 s; the loading arc every 1.6 s. */
const ORBIT_MS = 9000
const ARC_MS = 1600
/** The orbit spills 16 past the box; its path runs 3 outside the edge. */
const SPILL = 16
const ORBIT_GAP = 3
const LIT_MS = 160
const GLOW_MS = 400
const BEAM_MS = 200
/** A button plus 6 apart. */
const FAN_STEP = HEIGHT.md + space[1.5]
const FAN_MS = 500
const FAN_FADE_MS = 240
const FAN_STAGGER_MS = 40
const OVERSHOOT = Easing.bezier(0.34, 1.56, 0.64, 1)
const PLUS_MS = 300
const TIP_MS = 1500
const ICON = 20
const LINE = 22
/** The danger red stands in for the web's untokened pink, at about the pink's lightness over a light surface. */
const PINK_PEAK = 0.55

/** The orbit's light as dashes: where each colour sits round the path, its share, and the blur drawn as three widths. */
const ORBIT_COLOURS = [{ key: 'glow1', phase: 0.66, share: 0.16 }, { key: 'glow2', phase: 0.77, share: 0.1 }, { key: 'glow3', phase: 0.86, share: 0.12 }] as const
const ORBIT_BLUR = [{ width: 12, opacity: 0.25 }, { width: 7, opacity: 0.45 }, { width: 3, opacity: 0.7 }] as const
/** The arc rests at 200° like the web's, and runs a soft tail of ink into a blue head. */
const ARC_REST = 200 / 360
const ARC_DASHES = [{ ink: 'primary', phase: 0.06, share: 0.12, opacity: 0.45 }, { ink: 'primary', phase: 0.07, share: 0.06, opacity: 0.9 }, { ink: 'blue', phase: 0.12, share: 0.06, opacity: 0.9 }] as const

const clock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
const clamp01 = (n: number): number => Math.max(0, Math.min(1, n))

export type LiquidRingAction = {
  id: string
  /** The accessible name, also shown as a tip on a long press. */
  label: string
  icon: ReactNode
  disabled?: boolean
}

export type LiquidRingProps = {
  label: string
  placeholder?: string
  defaultValue?: string
  /** `voice` draws a beam along the bottom, `loading` runs one bright arc. */
  state?: 'rest' | 'voice' | 'loading'
  /** The beam in ink, not colour. */
  voiceColorVariant?: 'color' | 'mono'
  /** 0 to 1. The beam's width and glow follow it. */
  voiceLevel?: number
  /** 0 to 1. How bright and solid the chrome ring and its glow are. Default 1. */
  metalStrength?: number
  /** Beside the plus, like the model name. */
  model?: ReactNode
  hint?: ReactNode
  onSubmit?: (value: string) => void
  onStop?: () => void
  onVoice?: () => void
  /** The plus at the start of the footer. */
  onAttach?: () => void
  /** Opens your model menu. */
  onModel?: () => void
  /** Actions the plus splits out like droplets. Left out, the plus calls `onAttach`. */
  actions?: LiquidRingAction[]
  onAction?: (id: string) => void
  /** Pauses the voice clock and dims the beam, when controlled. */
  voicePaused?: boolean
  defaultVoicePaused?: boolean
  onVoicePauseChange?: (paused: boolean) => void
  /** Draws `plus`, `mic`, `audio-lines`, `pause`, `play`, `stop`, `arrow-up-02`, `sparkles`, `chevron-up`. */
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Inks = { glow: [string, string, string]; glow3Opacity: number; glowOpacity: number; pink: string; blue: string }

const inks = (c: Colors, dark: boolean): Inks => (dark
  ? { glow: [accent.sky.from, accent.onSolid, c.danger], glow3Opacity: 0.4, glowOpacity: 0.8, pink: c.danger, blue: accent.sky.from }
  : { glow: [accent.sky.from, accent.violet.from, c.danger], glow3Opacity: 0.6, glowOpacity: 0.45, pink: c.danger, blue: accent.sky.from })

/** Eases toward `target` over `ms`, or sets it when still. */
function useEased(target: number, ms: number, still: boolean): SharedValue<number> {
  const value = useSharedValue(target)
  useEffect(() => {
    value.value = still ? target : withTiming(target, { duration: ms, easing: EASE_OUT })
  }, [target, ms, still, value])
  return value
}

/** Wraps the Prompt Input composer in a liquid metal ring with an orbiting glow and a voice beam. */
export function LiquidRing({ label, placeholder = 'Ask the agent to do something…', defaultValue = '', state = 'rest', voiceColorVariant = 'color', voiceLevel = 0.6, metalStrength = 1, model, hint, onSubmit, onStop, onVoice, onAttach, onModel, actions = [], onAction, voicePaused, defaultVoicePaused = false, onVoicePauseChange, renderIcon, animated = true, style }: LiquidRingProps) {
  const colors = useColors()
  const dark = useColorScheme() === 'dark'
  const styles = useRingStyles()
  const ink = inks(colors, dark)
  const still = useStill(animated)
  const active = useAppActive()
  const ids = `ring${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [value, setValue] = useState(defaultValue)
  const [fanOpen, setFanOpen] = useState(false)
  const [focused, setFocused] = useState(false)
  const [heldPaused, setHeldPaused] = useState(defaultVoicePaused)
  const [box, setBox] = useState({ w: 0, h: 0 })
  const voice = state === 'voice'
  const loading = state === 'loading'
  const mono = voiceColorVariant === 'mono'
  const paused = voice && (voicePaused ?? heldPaused)
  const filled = value.trim().length > 0
  const strength = clamp01(metalStrength)
  const beam = still ? STILL_BEAM : Math.max(0.2, Math.min(1, voiceLevel))

  const orbitTurn = useTurn(!still && active && box.w > 0, ORBIT_MS, still)
  const arcTurn = useTurn(loading && !still && active, ARC_MS, !loading || still)
  const orbitAlpha = useEased(ink.glowOpacity * strength * (voice ? 0.5 : 1), GLOW_MS, still)
  const litAlpha = useEased(focused && !loading ? 0.7 : 0, LIT_MS, still)
  const beamScale = useEased(beam, BEAM_MS, still)
  const bloomAlpha = useEased(mono ? beam * 0.9 : paused ? beam * 0.35 : Math.min(1, beam * 1.1), BEAM_MS, still)
  const bloomScale = useEased(0.6 + beam * 0.4, BEAM_MS, still)
  const modelAlpha = useEased(fanOpen ? 0 : 1, LIT_MS, still)

  const orbitStyle = useAnimatedStyle(() => ({ opacity: orbitAlpha.value }))
  const litStyle = useAnimatedStyle(() => ({ opacity: litAlpha.value }))
  const beamStyle = useAnimatedStyle(() => ({ transform: [{ scaleX: beamScale.value }] }))
  const bloomStyle = useAnimatedStyle(() => ({ opacity: bloomAlpha.value, transform: [{ scaleX: bloomScale.value }] }))
  const modelStyle = useAnimatedStyle(() => ({ opacity: modelAlpha.value }))

  function togglePause(): void {
    const next = !paused
    setHeldPaused(next)
    onVoicePauseChange?.(next)
  }

  // Send submits, voice included; only a running response turns it into Stop. Voice ends from its own button.
  function send(): void {
    if (loading) onStop?.()
    else if (voice || filled) onSubmit?.(value)
  }

  function measure(event: LayoutChangeEvent): void {
    const { width, height } = event.nativeEvent.layout
    setBox((prev) => (prev.w === width && prev.h === height ? prev : { w: width, h: height }))
  }

  const ready = box.w > 0 && box.h > 0
  const orbit = ringShape(box.w + SPILL * 2, box.h + SPILL * 2, BOX_RADIUS + SPILL, SPILL - ORBIT_GAP)
  const band = ringShape(box.w, box.h, BOX_RADIUS, 0.75)
  const lit = ringShape(box.w, box.h, BOX_RADIUS, 1)
  const beamStops = mono
    ? [{ at: 0, color: colors.ink10, opacity: 1 }, { at: 0.5, color: colors.textPrimary, opacity: 1 }, { at: 1, color: colors.ink10, opacity: 1 }]
    : [{ at: 0, color: ink.blue, opacity: 0 }, { at: 0.25, color: ink.pink, opacity: 0.5 }, { at: 0.5, color: accent.onSolid, opacity: 1 }, { at: 0.75, color: ink.blue, opacity: 1 }, { at: 1, color: ink.blue, opacity: 0 }]
  const beamGlow = Math.min(1, beam * 1.15)

  return (
    <View style={[styles.ring, style]} {...(loading && onStop ? { onAccessibilityEscape: onStop } : {})}>
      <View style={styles.frame} onLayout={measure}>
        {ready ? (
          <Animated.View aria-hidden pointerEvents="none" style={[styles.orbit, orbitStyle]}>
            <Svg width={box.w + SPILL * 2} height={box.h + SPILL * 2}>
              {ORBIT_COLOURS.map((colour, i) => ORBIT_BLUR.map((blur) => (
                <RingDash
                  key={`${colour.key}-${blur.width}`}
                  shape={orbit} turn={orbitTurn} period={orbit.length} share={colour.share} pace={1} phase={colour.phase}
                  color={ink.glow[i] ?? ink.blue} opacity={blur.opacity * (i === 2 ? ink.glow3Opacity : 1)} strokeWidth={blur.width}
                />
              )))}
            </Svg>
          </Animated.View>
        ) : null}
        {voice ? (
          <View aria-hidden pointerEvents="none" style={styles.blooms}>
            {mono ? null : <Bloom id={`${ids}-pink`} color={ink.pink} peak={PINK_PEAK} place={styles.pink} style={bloomStyle} />}
            <Bloom id={`${ids}-blue`} color={mono ? colors.textTertiary : ink.blue} place={mono ? styles.blueMono : styles.blue} style={bloomStyle} />
          </View>
        ) : null}
        <View style={styles.box}>
          <View style={styles.field}>
            {voice ? <View aria-hidden style={styles.lead}>{withInk(renderIcon('audio-lines', ICON), colors.textPrimary)}</View> : null}
            <TextInput
              accessibilityLabel={label}
              multiline
              editable={!voice}
              value={voice ? 'Listening…' : value}
              placeholder={placeholder}
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.textPrimary}
              style={[styles.input, loading && styles.inputBusy]}
              onChangeText={setValue}
              onFocus={() => { setFocused(true); setFanOpen(false) }}
              onBlur={() => setFocused(false)}
            />
          </View>
          <View style={styles.footer}>
            <View style={styles.side}>
              {actions.length > 0
                ? <ActionsFan actions={actions} open={fanOpen} onOpenChange={setFanOpen} onAction={onAction} still={still} animated={animated} disabled={loading} renderIcon={renderIcon} />
                : <IconButton variant="secondary" icon={renderIcon('plus', ICON)} label="Add" animated={animated} onPress={onAttach} />}
              {model && !voice ? (
                <Animated.View aria-hidden={fanOpen} pointerEvents={fanOpen ? 'none' : 'auto'} style={[styles.model, modelStyle]}>
                  <Button variant="ghost" shape="pill" size="sm" animated={animated} leadingIcon={renderIcon('sparkles', ICON)} trailingIcon={<View style={styles.down}>{renderIcon('chevron-up', ICON)}</View>} onPress={onModel}>{model}</Button>
                </Animated.View>
              ) : null}
            </View>
            <View style={styles.side}>
              {voice ? (
                <>
                  <VoiceClock paused={paused} />
                  <IconButton variant="ghost" icon={renderIcon(paused ? 'play' : 'pause', ICON)} label={paused ? 'Resume voice' : 'Pause voice'} accessibilityRole="togglebutton" aria-checked={paused} animated={animated} onPress={togglePause} />
                  <IconButton variant="primary" icon={renderIcon('audio-lines', ICON)} label="Stop listening" animated={animated} onPress={onStop} />
                </>
              ) : (
                // The open fan reaches the mic on a phone, so the mic steps aside until it folds back.
                <View aria-hidden={fanOpen} pointerEvents={fanOpen ? 'none' : 'auto'} style={fanOpen && styles.away}>
                  <IconButton variant="ghost" icon={renderIcon('mic', ICON)} label="Voice" animated={animated} onPress={onVoice} />
                </View>
              )}
              <View style={styles.send}>
                <IconButton variant={voice ? 'secondary' : 'primary'} disabled={state === 'rest' && !filled} icon={renderIcon(loading ? 'stop' : 'arrow-up-02', ICON)} label={loading ? 'Stop' : 'Send'} animated={animated} onPress={send} />
                <MetalRing borderRadius={SEND_RADIUS} strength={SEND_STRENGTH * strength} still={still} />
              </View>
            </View>
          </View>
        </View>
        <MetalRing borderRadius={BOX_RADIUS} strength={strength} speed={loading ? 2 : 1} still={still} />
        {ready ? (
          <View aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill}>
            <Animated.View style={[StyleSheet.absoluteFill, litStyle]}>
              <Svg width={box.w} height={box.h}>
                <Defs>
                  <LinearGradient id={`${ids}-lit`} x1="0" y1="0" x2="1" y2="1">
                    <Stop offset="0" stopColor={colors.textPrimary} />
                    <Stop offset="0.08" stopColor={ink.blue} />
                    <Stop offset="0.42" stopColor={colors.textPrimary} />
                    <Stop offset="0.5" stopColor={colors.textSecondary} />
                    <Stop offset="0.54" stopColor={ink.pink} stopOpacity={0.6} />
                    <Stop offset="0.92" stopColor={colors.textPrimary} />
                  </LinearGradient>
                </Defs>
                <Rect x={lit.x} y={lit.y} width={lit.width} height={lit.height} rx={lit.rx} ry={lit.rx} fill="none" stroke={`url(#${ids}-lit)`} strokeWidth={2} />
              </Svg>
            </Animated.View>
            {loading ? (
              <Svg style={StyleSheet.absoluteFill} width={box.w} height={box.h}>
                {ARC_DASHES.map((dash) => (
                  <RingDash
                    key={`${dash.ink}-${dash.phase}`}
                    shape={band} turn={arcTurn} period={band.length} share={dash.share} pace={1} phase={ARC_REST + dash.phase}
                    color={dash.ink === 'blue' ? ink.blue : colors.textPrimary} opacity={dash.opacity} strokeWidth={1.5}
                  />
                ))}
              </Svg>
            ) : null}
          </View>
        ) : null}
        {voice ? (
          <Animated.View aria-hidden pointerEvents="none" style={[styles.beam, paused && styles.beamPaused, beamStyle]}>
            <Svg width="100%" height={10}>
              <Defs>
                <LinearGradient id={`${ids}-beam`} x1="0" y1="0" x2="1" y2="0">
                  {beamStops.map((stop) => <Stop key={stop.at} offset={stop.at} stopColor={stop.color} stopOpacity={stop.opacity} />)}
                </LinearGradient>
              </Defs>
              {/* The glow, stacked where the web blurs it, then the 2 px line. */}
              <Rect x="0" y="0" width="100%" height={10} rx={5} ry={5} fill={`url(#${ids}-beam)`} fillOpacity={beamGlow * 0.35} />
              <Rect x="0" y="2" width="100%" height={6} rx={3} ry={3} fill={`url(#${ids}-beam)`} fillOpacity={beamGlow * 0.6} />
              <Rect x="0" y="4" width="100%" height={2} rx={1} ry={1} fill={`url(#${ids}-beam)`} />
            </Svg>
          </Animated.View>
        ) : null}
      </View>
      {hint ? <Text numberOfLines={1} style={styles.hint}>{hint}</Text> : null}
    </View>
  )
}

/** A soft light under the bottom edge, the falloff standing in for the web blur. */
function Bloom({ id, color, peak = 1, place, style }: { id: string; color: string; peak?: number; place: StyleProp<ViewStyle>; style: ComponentProps<typeof Animated.View>['style'] }) {
  const styles = useRingStyles()
  return (
    <Animated.View style={[styles.bloom, place, style]}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={peak} />
            <Stop offset="0.5" stopColor={color} stopOpacity={peak * 0.7} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx="50%" cy="50%" rx="50%" ry="50%" fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  )
}

/**
 * The voice clock, on its own so only it re-renders each second. It mounts with voice, so it starts at 0:00 and resets
 * when voice ends. It counts while not paused, also with motion off.
 */
function VoiceClock({ paused }: { paused: boolean }) {
  const styles = useRingStyles()
  const [elapsed, setElapsed] = useState(0)
  useEffect(() => {
    if (paused) return undefined
    const timer = setInterval(() => setElapsed((s) => s + 1), TICK_MS)
    return () => clearInterval(timer)
  }, [paused])
  const words = `${paused ? 'Paused' : 'Listening'} ${clock(elapsed)}`
  return <Text role="timer" aria-live="off" accessibilityLabel={paused ? `Voice paused ${clock(elapsed)}` : words} style={styles.timer}>{words}</Text>
}

type FanProps = {
  actions: LiquidRingAction[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onAction: ((id: string) => void) | undefined
  still: boolean
  animated: boolean
  disabled: boolean
  renderIcon: RenderIcon
}

/**
 * The plus and its actions: opening slides the actions out of the plus as droplets, 40 ms apart with a little
 * overshoot, and closing folds them back last out first. Actions are hidden from touch and assistive tech while folded.
 */
function ActionsFan({ actions, open, onOpenChange, onAction, still, animated, disabled, renderIcon }: FanProps) {
  const colors = useColors()
  const styles = useRingStyles()
  const turn = useEased(open ? 45 : 0, PLUS_MS, still)
  const plusStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  const [tip, setTip] = useState<string | null>(null)
  const tipTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => { if (disabled && open) onOpenChange(false) }, [disabled, open, onOpenChange])
  useEffect(() => () => clearTimeout(tipTimer.current), [])

  function showTip(id: string): void {
    setTip(id)
    clearTimeout(tipTimer.current)
    tipTimer.current = setTimeout(() => setTip(null), TIP_MS)
  }

  return (
    <View role="group" aria-label="Add to prompt" style={styles.fan}>
      {actions.map((action, i) => (
        <FanAction
          key={action.id} action={action} index={i} count={actions.length} open={open} still={still} animated={animated} tip={tip === action.id}
          onPress={() => { onAction?.(action.id); onOpenChange(false) }}
          onLongPress={() => showTip(action.id)}
        />
      ))}
      <View style={styles.slot}>
        <View style={styles.drop} />
        <IconButton
          variant="ghost"
          icon={<Animated.View style={plusStyle}>{withInk(renderIcon('plus', ICON), colors.textSecondary)}</Animated.View>}
          label={open ? 'Close add menu' : 'Add to prompt'}
          aria-expanded={open}
          disabled={disabled}
          animated={animated}
          onPress={() => onOpenChange(!open)}
        />
      </View>
    </View>
  )
}

type FanActionProps = { action: LiquidRingAction; index: number; count: number; open: boolean; still: boolean; animated: boolean; tip: boolean; onPress: () => void; onLongPress: () => void }

function FanAction({ action, index, count, open, still, animated, tip, onPress, onLongPress }: FanActionProps) {
  const styles = useRingStyles()
  const x = useSharedValue(0)
  const shown = useSharedValue(0)

  useEffect(() => {
    const target = open ? (index + 1) * FAN_STEP : 0
    if (still) { x.value = target; shown.value = open ? 1 : 0; return }
    // The first out leads, and the last out leads back.
    const delay = (open ? index : count - 1 - index) * FAN_STAGGER_MS
    x.value = withDelay(delay, withTiming(target, { duration: FAN_MS, easing: OVERSHOOT }))
    shown.value = withDelay(delay, withTiming(open ? 1 : 0, { duration: FAN_FADE_MS, easing: EASE_OUT }))
  }, [open, index, count, still, x, shown])

  const style = useAnimatedStyle(() => ({ opacity: shown.value, transform: [{ translateX: x.value }] }))

  return (
    <Animated.View aria-hidden={!open} pointerEvents={open ? 'box-none' : 'none'} style={[styles.slot, styles.action, style]}>
      <View style={styles.drop} />
      <IconButton variant="ghost" icon={action.icon} label={action.label} disabled={action.disabled ?? false} animated={animated} onPress={onPress} onLongPress={onLongPress} />
      {tip ? (
        <Animated.View pointerEvents="none" style={styles.tipRow} {...(still ? {} : { entering: FadeIn.duration(LIT_MS), exiting: FadeOut.duration(LIT_MS) })}>
          <Text style={styles.tip}>{action.label}</Text>
        </Animated.View>
      ) : null}
    </Animated.View>
  )
}

/** One stylesheet per colour scheme, shared by the composer and its parts. */
function useRingStyles() {
  const colors = useColors()
  const dark = useColorScheme() === 'dark'
  return useMemo(() => createStyles(colors, dark), [colors, dark])
}

const createStyles = (c: Colors, dark: boolean) => {
  const shade = shadowInk(c, dark)
  return StyleSheet.create({
    ring: { alignSelf: 'center', gap: space[3], maxWidth: 672, width: '100%' },
    frame: { borderRadius: BOX_RADIUS, position: 'relative' },
    orbit: { left: -SPILL, position: 'absolute', top: -SPILL },
    blooms: { ...StyleSheet.absoluteFill },
    pink: { left: '12%', width: '36%' },
    blue: { left: '46%', width: '36%' },
    blueMono: { left: '20%', width: '60%' },
    // Radius 24 and 10 all round, the field two rows of 16/22, the toolbar 6 below it.
    box: {
      backgroundColor: c.surface, borderRadius: BOX_RADIUS, elevation: 2, gap: space[1.5], padding: space[2.5],
      shadowColor: shade.color, shadowOffset: { width: 0, height: 6 }, shadowOpacity: shade.opacity, shadowRadius: 10,
    },
    field: { alignItems: 'flex-start', flexDirection: 'row', gap: space[1], paddingHorizontal: space[2], paddingTop: space[1.5] },
    lead: { alignItems: 'center', flexShrink: 0, height: LINE, justifyContent: 'center' },
    input: { ...type(16, c.textPrimary), flex: 1, lineHeight: LINE, maxHeight: LINE * 8, minHeight: HEIGHT.md, padding: 0, textAlignVertical: 'top' },
    inputBusy: { color: c.textSecondary },
    footer: { alignItems: 'center', flexDirection: 'row', gap: space[1], justifyContent: 'space-between', minWidth: 0 },
    side: { alignItems: 'center', flexDirection: 'row', flexShrink: 1, gap: space[1.5], minWidth: 0 },
    model: { flexShrink: 1, minWidth: 0 },
    down: { transform: [{ rotate: '180deg' }] },
    away: { opacity: 0 },
    send: { borderRadius: radius.full, position: 'relative' },
    beam: { bottom: -5, height: 10, left: '11%', position: 'absolute', width: '78%', zIndex: 4 },
    beamPaused: { opacity: 0.35 },
    hint: { ...type(12, c.textTertiary, '400', true), paddingHorizontal: space[3] },
    timer: { ...type(12, c.textTertiary, '400', true), flexShrink: 0, fontVariant: ['tabular-nums'], paddingHorizontal: space[1] },
    // Blooms reach 12 past their 30 high capsule, where the web blurs them.
    bloom: { bottom: -27, height: 54, position: 'absolute' },
    fan: { height: HEIGHT.md, width: HEIGHT.md, zIndex: 2 },
    slot: { height: HEIGHT.md, left: 0, position: 'absolute', top: 0, width: HEIGHT.md },
    action: { zIndex: 1 },
    drop: { ...StyleSheet.absoluteFill, backgroundColor: c.ink5, borderRadius: radius.full },
    tipRow: { alignItems: 'center', bottom: HEIGHT.md + space[2], left: -80, position: 'absolute', right: -80 },
    tip: { ...type(12, c.textInverse), backgroundColor: c.inverse, borderRadius: radius.lg, overflow: 'hidden', paddingHorizontal: space[2], paddingVertical: space[1] },
  })
}
