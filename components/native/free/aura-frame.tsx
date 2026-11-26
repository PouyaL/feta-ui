import { useEffect, useId, useMemo, useState, type ReactNode } from 'react'
import { StyleSheet, TextInput, View, useColorScheme, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, useAnimatedProps, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, type SharedValue } from 'react-native-reanimated'
import Svg, { Defs, Ellipse, G, LinearGradient, Mask, RadialGradient, Rect, Stop, Text as SvgText } from 'react-native-svg'
import { accent, font, radius, space, toggleState, useAppActive, useColors, type Colors } from '../kit'
import { Button, EASE_OUT, withInk, SELF } from './button'
import { type, useStill, type RenderIcon } from './card'
import { IconButton } from './icon-button'
import { shadowInk, useTurn } from './metal-frame'

/*
 * What differs from web: CSS blurs the two glows; here each glow is an SVG ellipse filled with a radial gradient that
 * falls off to nothing, which reads the same as a blurred capsule. The glyph block is masked by an SVG radial gradient,
 * as on the web. The web rewrites the glyphs every 80 ms from the JS thread; here eight frames are drawn once and the UI
 * thread shows one at a time, so the flicker never re-renders. The ramp colours below are the web's own values
 * (orange 500, blue 500 and 400, violet 500, and the pink that has no token on the web either). The
 * component switches to the Mobile layout (no Deep mode pill, a voice icon) under 480 wide, where the web follows the
 * viewport. Icons come from `renderIcon`.
 */

const TICK_MS = 80
/** Glyph frames drawn once and cycled: 8 × 80 ms. */
const FRAMES = 8
const GLYPHS = 'μπXOHKλPMW.QN#ZSΣΩ*FAY%&1UL0BTGDEV+@'
/** The glyph block fills 283 by 162 at 12/18 mono: 9 rows of 20 characters, a space between each. */
const ROWS = 9
const COLUMNS = 20
const GLYPH_SIZE = 12
const GLYPH_LINE = 18
/** A mono glyph and its space, at 12 px. */
const GLYPH_STEP = 14.4
/** Under this width the Mobile layout and sizes apply. */
const WIDE_MIN = 480
/** The web blurs the glows 24 px; the gradient reaches this far past the capsule. */
const BLUR = 24
const STATE_MS = 400
const BREATHE_MS = 2400
const IN_OUT = Easing.bezier(0.42, 0, 0.58, 1)
const LEAD_ICON = 16
const BUTTON_ICON = 16
/** The web's ramp colours: --feta-orange-500, --feta-blue-500, --feta-blue-400, --feta-violet-500, and its untokened pink. */
const RAMP = { warm: '#f97316', cool: '#3b82f6', coolInk: '#60a5fa', pink: '#F472B6', violet: '#8b5cf6' } as const

const AnimatedG = Animated.createAnimatedComponent(G)

const hash = (seed: number): number => {
  const x = Math.sin(seed * 12.9898) * 43758.5453
  return x - Math.floor(x)
}

type GlyphRow = { text: string; x: number[] }

/** One frame of the block, as rows of visible glyphs and their x positions. */
const glyphBlock = (seed: number, tick: number): GlyphRow[] => Array.from({ length: ROWS }, (_, row) => {
  const out: GlyphRow = { text: '', x: [] }
  for (let i = 0; i < COLUMNS; i += 1) {
    if (hash(seed + row * 31 + i * 7) < 0.5) continue
    out.text += GLYPHS[Math.floor(hash(seed + row + i * 3 + tick) * GLYPHS.length)] ?? ''
    out.x.push(i * GLYPH_STEP)
  }
  return out
})

const WARM_FRAMES = Array.from({ length: FRAMES }, (_, tick) => glyphBlock(3, tick))
const COOL_FRAMES = [glyphBlock(11, 0)]

type Levels = { warmGlow: number; coolGlow: number; warmGlyphs: number; coolGlyphs: number; line: number }

const LEVELS: Record<'rest' | 'focus' | 'thinking' | 'listening', Levels> = {
  rest: { warmGlow: 0.28, coolGlow: 0.28, warmGlyphs: 0.42, coolGlyphs: 0.42, line: 0.5 },
  focus: { warmGlow: 0.6, coolGlow: 0.6, warmGlyphs: 0.7, coolGlyphs: 0.7, line: 1 },
  thinking: { warmGlow: 0.85, coolGlow: 0.35, warmGlyphs: 0.98, coolGlyphs: 0.4, line: 1 },
  listening: { warmGlow: 0.3, coolGlow: 0.85, warmGlyphs: 0.35, coolGlyphs: 0.98, line: 1 },
}

/** Eases a shared value to `target` over the state transition, or sets it when still. */
function useEased(target: number, still: boolean): SharedValue<number> {
  const value = useSharedValue(target)
  useEffect(() => {
    value.value = still ? target : withTiming(target, { duration: STATE_MS, easing: EASE_OUT })
  }, [target, still, value])
  return value
}

type GlowProps = { id: string; color: string; width: number; height: number; opacity: SharedValue<number>; scale?: SharedValue<number>; place: StyleProp<ViewStyle> }

/** A capsule of light, its edge falling off like the web blur. */
function Glow({ id, color, width, height, opacity, scale, place }: GlowProps) {
  const w = width + BLUR * 2
  const h = height + BLUR * 2
  const style = useAnimatedStyle(() => ({ opacity: opacity.value, transform: [{ scale: scale ? scale.value : 1 }] }))
  return (
    <Animated.View aria-hidden pointerEvents="none" style={[styles.layer, place, style]}>
      <Svg aria-hidden width={w} height={h}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={1} />
            <Stop offset="0.55" stopColor={color} stopOpacity={0.8} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  )
}

type FrameProps = { rows: GlyphRow[]; index: number; count: number; clock: SharedValue<number>; color: string }

function GlyphFrame({ rows, index, count, clock, color }: FrameProps) {
  const props = useAnimatedProps(() => ({ opacity: Math.floor((clock.value % 1) * count) === index ? 1 : 0 }))
  return (
    <AnimatedG animatedProps={props}>
      {rows.map((row, i) => (row.text ? <SvgText key={i} x={row.x} y={(i + 1) * GLYPH_LINE - 5} fill={color} fontFamily={font.mono} fontSize={GLYPH_SIZE}>{row.text}</SvgText> : null))}
    </AnimatedG>
  )
}

type GlyphsProps = { id: string; frames: GlyphRow[][]; clock: SharedValue<number>; color: string; width: number; height: number; opacity: SharedValue<number>; place: StyleProp<ViewStyle> }

/** The glyph block, fading out from its centre. */
function Glyphs({ id, frames, clock, color, width, height, opacity, place }: GlyphsProps) {
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <Animated.View aria-hidden pointerEvents="none" style={[styles.layer, place, style]}>
      <Svg aria-hidden width={width} height={height}>
        <Defs>
          <RadialGradient id={`${id}-fade`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={accent.onSolid} stopOpacity={1} />
            <Stop offset="0.55" stopColor={accent.onSolid} stopOpacity={0.6} />
            <Stop offset="1" stopColor={accent.onSolid} stopOpacity={0} />
          </RadialGradient>
          <Mask id={`${id}-mask`} x="0" y="0" width={width} height={height} maskUnits="userSpaceOnUse">
            <Rect x="0" y="0" width={width} height={height} fill={`url(#${id}-fade)`} />
          </Mask>
        </Defs>
        <G mask={`url(#${id}-mask)`}>
          {frames.map((rows, i) => <GlyphFrame key={i} rows={rows} index={i} count={frames.length} clock={clock} color={color} />)}
        </G>
      </Svg>
    </Animated.View>
  )
}

export type AuraFrameProps = {
  label: string
  placeholder?: string
  state?: 'rest' | 'thinking' | 'listening'
  /** Shown in the field while thinking. */
  statusText?: string
  /** The model chip. Default `Normal`. */
  mode?: string
  onMode?: () => void
  /** Whether Deep mode is on at the start. The pill shows at 480 wide and up. */
  defaultDeepMode?: boolean
  /** @deprecated Renamed to `defaultDeepMode`; still read when `defaultDeepMode` is not set. */
  defaultDeepThink?: boolean
  onAttach?: () => void
  onSubmit?: (value: string) => void
  onStop?: () => void
  onVoice?: () => void
  /** 0 to 1 while listening. It leans the cool glow. */
  voiceLevel?: number
  /** Draws `plus`, `sparkles`, `chevron-up`, `bulb`, `audio-lines`, `stop`. */
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Warm and cool light leaking from a prompt, with glyphs in the glow, for a louder, brand led composer. */
export function AuraFrame({ label, placeholder = 'Ask anything…', state = 'rest', statusText, mode = 'Normal', onMode, defaultDeepMode, defaultDeepThink, onAttach, onSubmit, onStop, onVoice, voiceLevel = 0, renderIcon, animated = true, style }: AuraFrameProps) {
  const colors = useColors()
  const dark = useColorScheme() === 'dark'
  const themed = useMemo(() => createStyles(colors, dark), [colors, dark])
  const still = useStill(animated)
  const active = useAppActive()
  const [value, setValue] = useState('')
  const [deep, setDeep] = useState(defaultDeepMode ?? defaultDeepThink ?? false)
  const [focused, setFocused] = useState(false)
  const [width, setWidth] = useState(0)
  const [box, setBox] = useState({ width: 0, height: 0 })
  const busy = state !== 'rest'
  const thinking = state === 'thinking'
  const listening = state === 'listening'
  const wide = width >= WIDE_MIN
  const level = LEVELS[busy ? state : focused ? 'focus' : 'rest']
  const ids = `aura${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  const warm = useSharedValue(level.warmGlow)
  const cool = useEased(level.coolGlow, still)
  const coolScale = useEased(listening ? 1 + Math.max(0, Math.min(1, voiceLevel)) * 0.15 : 1, still)
  const warmGlyphs = useEased(level.warmGlyphs, still)
  const coolGlyphs = useEased(level.coolGlyphs, still)
  const clock = useTurn(thinking && !still && active, FRAMES * TICK_MS, !thinking || still)

  // Thinking: the warm glow breathes between 60% and full of its state strength. Background holds it.
  useEffect(() => {
    const target = level.warmGlow
    if (still) { warm.value = target; return }
    const ease = withTiming(target, { duration: STATE_MS, easing: EASE_OUT })
    warm.value = thinking && active ? withSequence(ease, withRepeat(withTiming(target * 0.6, { duration: BREATHE_MS, easing: IN_OUT }), -1, true)) : ease
  }, [level.warmGlow, thinking, still, active, warm])

  function measure(event: LayoutChangeEvent): void {
    setWidth(event.nativeEvent.layout.width)
  }

  function submit(): void {
    if (thinking) onStop?.()
    else if (listening || value) onSubmit?.(value)
  }

  const glow = wide ? { width: Math.min(300, width * 0.54), height: 140 } : { width: 200, height: 110 }
  const glyphs = wide ? { width: Math.min(283, width * 0.52), height: 162 } : { width: 196, height: 126 }
  const icon = (name: string): ReactNode => renderIcon(name, BUTTON_ICON)
  const chevron = <View style={themed.down}>{icon('chevron-up')}</View>

  return (
    <View style={[themed.aura, style]} onLayout={measure}>
      <Glow id={`${ids}-warm`} color={RAMP.warm} width={glow.width} height={glow.height} opacity={warm} place={styles.warmGlow} />
      <Glow id={`${ids}-cool`} color={RAMP.cool} width={glow.width} height={glow.height} opacity={cool} scale={coolScale} place={styles.coolGlow} />
      <Glyphs id={`${ids}-wg`} frames={WARM_FRAMES} clock={clock} color={RAMP.warm} width={glyphs.width} height={glyphs.height} opacity={warmGlyphs} place={styles.warmGlyphs} />
      <Glyphs id={`${ids}-cg`} frames={COOL_FRAMES} clock={clock} color={RAMP.coolInk} width={glyphs.width} height={glyphs.height} opacity={coolGlyphs} place={styles.coolGlyphs} />
      <View style={themed.shell} onLayout={(e) => setBox({ width: e.nativeEvent.layout.width, height: e.nativeEvent.layout.height })}>
        <View style={themed.box}>
          <View style={themed.field}>
            {busy ? <View aria-hidden style={themed.lead}>{withInk(renderIcon(thinking ? 'sparkles' : 'audio-lines', LEAD_ICON), colors.textPrimary)}</View> : null}
            <TextInput
              accessibilityLabel={label}
              editable={!busy}
              value={busy ? statusText ?? (thinking ? 'Thinking' : 'Listening…') : value}
              placeholder={placeholder}
              placeholderTextColor={colors.textTertiary}
              selectionColor={colors.textPrimary}
              returnKeyType="send"
              submitBehavior="blurAndSubmit"
              style={themed.input}
              onChangeText={setValue}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onSubmitEditing={submit}
            />
          </View>
          <View style={themed.footer}>
            <IconButton style={SELF.center} variant="secondary" size="sm" icon={icon('plus')} label="Add" animated={animated} onPress={onAttach} />
            <Button style={SELF.center} variant="secondary" shape="pill" size="sm" animated={animated} leadingIcon={icon('sparkles')} trailingIcon={chevron} onPress={onMode}>{mode}</Button>
            {wide ? (
              <Button style={SELF.center} variant={deep ? 'primary' : 'secondary'} shape="pill" size="sm" animated={animated} {...toggleState(deep)} leadingIcon={icon('bulb')} onPress={() => setDeep(!deep)}>Deep mode</Button>
            ) : null}
            <View style={themed.spacer} />
            {wide ? (
              listening
                ? <Button style={SELF.center} variant="primary" shape="pill" size="sm" animated={animated} leadingIcon={icon('audio-lines')} onPress={onStop}>Stop</Button>
                : <Button style={SELF.center} variant="secondary" shape="pill" size="sm" animated={animated} leadingIcon={icon('audio-lines')} onPress={onVoice}>Voice</Button>
            ) : (
              <IconButton style={SELF.center} variant={listening ? 'primary' : 'secondary'} size="sm" icon={icon('audio-lines')} label={listening ? 'Stop listening' : 'Voice'} animated={animated} onPress={listening ? onStop : onVoice} />
            )}
            <IconButton style={SELF.center} variant="primary" size="sm" disabled={state === 'rest' && !value} icon={icon(thinking ? 'stop' : 'chevron-up')} label={thinking ? 'Stop' : 'Send'} animated={animated} onPress={submit} />
          </View>
        </View>
        {/* The 1 px gradient hairline all round the box, drawn over its edge at measured size, as the web's border-box background. */}
        {box.width > 0 ? (
          <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill} width={box.width} height={box.height}>
            <Defs>
              <LinearGradient id={`${ids}-line`} x1="0" y1="0" x2={box.width} y2="0" gradientUnits="userSpaceOnUse">
                <Stop offset="0" stopColor={accent.orange.from} stopOpacity={level.line} />
                <Stop offset="0.35" stopColor={RAMP.pink} stopOpacity={level.line} />
                <Stop offset="0.65" stopColor={accent.violet.from} stopOpacity={level.line} />
                <Stop offset="1" stopColor={RAMP.violet} stopOpacity={level.line} />
              </LinearGradient>
            </Defs>
            <Rect x={0.5} y={0.5} width={box.width - 1} height={box.height - 1} rx={radius.tray - 0.5} ry={radius.tray - 0.5} fill="none" stroke={`url(#${ids}-line)`} strokeWidth={1} />
          </Svg>
        ) : null}
      </View>
    </View>
  )
}

/** Glows off the top left and bottom right, glyphs inside them, all behind the box. Glow boxes include the blur reach. */
const styles = StyleSheet.create({
  layer: { position: 'absolute' },
  warmGlow: { left: -24 - BLUR, top: -20 - BLUR },
  coolGlow: { bottom: -50 - BLUR, right: -24 - BLUR },
  warmGlyphs: { left: -40, top: -44 },
  coolGlyphs: { bottom: -98, right: -14 },
})

const createStyles = (c: Colors, dark: boolean) => {
  const shade = shadowInk(c, dark)
  return StyleSheet.create({
    aura: { alignSelf: 'center', maxWidth: 560, position: 'relative', width: '100%' },
    // The 1 px gradient hairline is the shell showing round the box, as the web's border-box background.
    shell: {
      backgroundColor: c.surface, borderRadius: radius.tray, elevation: 6,
      shadowColor: shade.color, shadowOffset: { width: 0, height: 12 }, shadowOpacity: shade.opacity, shadowRadius: 16,
    },
    // The web's 1 px transparent border sits inside the padding box; the hairline is drawn over it.
    box: { backgroundColor: c.surface, borderRadius: radius.tray, gap: space[3.5], margin: 1, paddingBottom: space[3.5], paddingLeft: space[4.5], paddingRight: space[3.5], paddingTop: space[4] },
    field: { alignItems: 'center', flexDirection: 'row', gap: space[1.5] },
    lead: { flexShrink: 0 },
    // The web's 24 px body line: without it iOS sizes the empty field shorter than its placeholder and clips it.
    input: { ...type(16, c.textPrimary), flex: 1, minHeight: 24, minWidth: 0, paddingVertical: 0 },
    footer: { alignItems: 'center', flexDirection: 'row', gap: space[1.5], minWidth: 0 },
    spacer: { flex: 1 },
    down: { transform: [{ rotate: '180deg' }] },
  })
}
