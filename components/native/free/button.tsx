import { cloneElement, isValidElement, useEffect, useRef, useState, type ComponentProps, type ReactNode, type Ref } from 'react'
import { Pressable, StyleSheet, type GestureResponderEvent, type LayoutChangeEvent, type PressableProps, type StyleProp, type TextStyle, type ViewInstance, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeOut, LayoutAnimationConfig, ZoomIn, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSpring, withTiming } from 'react-native-reanimated'
import { openLink, press, radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { Spinner } from './spinner'

/** Control heights on Mobile. Web uses 28, 36, 44. */
export const HEIGHT = { sm: 36, md: 44, lg: 52 } as const
export const ICON_SIZE = 20
/** The smallest touch target. */
export const TARGET = 44

export type Spring = { stiffness: number; damping: number; mass: number }

export const PRESS_SPRING: Spring = { ...press.spring, mass: 1 }
export const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1)
export const EASE_OUT_SOFT = Easing.bezier(0.22, 1, 0.36, 1)

const FADE_MS = 200
const SUCCESS_MS = 260
const SUCCESS_HOLD_MS = 1600
const SWAP_MS = 200
const SWAP_RISE = 8
const SWAP_TIMING = { duration: SWAP_MS, easing: EASE_OUT }
const TICK = ZoomIn.springify().stiffness(420).damping(42).mass(1).withInitialValues({ transform: [{ scale: 0.6 }] })

/** React Native has no `currentColor`, so a control hands its ink to the icon it was given. */
export const withInk = (node: ReactNode, color: string): ReactNode =>
  (isValidElement<{ color?: string }>(node) ? cloneElement(node, { color: node.props.color ?? color }) : node)

/** Runs a linear 0 to 1 clock on the UI thread while `active`. */
export function useLoop(active: boolean, ms: number) {
  const clock = useSharedValue(0)
  useEffect(() => {
    clock.value = 0
    if (!active) return undefined
    clock.value = withRepeat(withTiming(1, { duration: ms, easing: Easing.linear }), -1, false)
    return () => cancelAnimation(clock)
  }, [active, ms, clock])
  return clock
}

/** The shared press, for a box that holds more than one Pressable. */
export function usePressScale(still: boolean, to: number = press.scale, spring: Spring = PRESS_SPRING) {
  const scale = useSharedValue(1)
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }))
  return {
    style,
    pressIn: (): void => { if (!still) scale.value = withSpring(to, spring) },
    pressOut: (): void => { scale.value = still ? 1 : withSpring(1, spring) },
  }
}

export type PressScaleProps = Omit<PressableProps, 'style'> & {
  /** True skips the scale. */
  still: boolean
  scale?: number
  spring?: Spring
  /** Styles the box that scales. Takes animated styles, and sizes the control in its parent. */
  style?: ComponentProps<typeof Animated.View>['style']
  /** Styles the Pressable inside. */
  contentStyle?: StyleProp<ViewStyle>
  pressedStyle?: StyleProp<ViewStyle>
  ref?: Ref<ViewInstance>
}

/** A Pressable in a box that scales on the UI thread. Animated Pressable drops function styles, so these stay two views. */
export function PressScale({ still, scale, spring, style, contentStyle, pressedStyle, disabled, onPressIn, onPressOut, ref, ...rest }: PressScaleProps) {
  const pressing = usePressScale(still || Boolean(disabled), scale, spring)

  function handleIn(event: GestureResponderEvent): void {
    pressing.pressIn()
    onPressIn?.(event)
  }

  function handleOut(event: GestureResponderEvent): void {
    pressing.pressOut()
    onPressOut?.(event)
  }

  return (
    <Animated.View style={[pressing.style, style]}>
      <Pressable ref={ref} disabled={disabled} onPressIn={handleIn} onPressOut={handleOut} style={({ pressed }) => [contentStyle, pressed && pressedStyle]} {...rest} />
    </Animated.View>
  )
}

function riseIn() {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateY: SWAP_RISE }] },
    animations: { opacity: withTiming(1, SWAP_TIMING), transform: [{ translateY: withTiming(0, SWAP_TIMING) }] },
  }
}

function riseOut() {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: { opacity: withTiming(0, SWAP_TIMING), transform: [{ translateY: withTiming(-SWAP_RISE, SWAP_TIMING) }] },
  }
}

/** Content rises 8 as it swaps, and the old content leaves upward. Web adds a 2 px blur. */
export function LabelSwap({ swapKey, still, style, children }: { swapKey: string; still: boolean; style?: StyleProp<ViewStyle>; children: ReactNode }) {
  return (
    <LayoutAnimationConfig skipEntering>
      <Animated.View key={swapKey} {...(still ? {} : { entering: riseIn, exiting: riseOut })} style={style}>{children}</Animated.View>
    </LayoutAnimationConfig>
  )
}

type Ink = 'textPrimary' | 'textSecondary' | 'textQuaternary' | 'textInverse' | 'success'

export type ButtonProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'pressedStyle' | 'children'> & {
  /** One Primary per view. Default `primary`. */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'link'
  /** Default `md`: 36, 44, 52. */
  size?: 'sm' | 'md' | 'lg'
  /** `pill` is for marketing and hero actions. Default `soft`. */
  shape?: 'soft' | 'pill'
  /** Async state. The width stays locked while it is not `idle`. */
  status?: 'idle' | 'loading' | 'success'
  /** Label shown while loading. Defaults to the children. */
  loadingLabel?: ReactNode
  /** Label shown on success. Defaults to the children. */
  successLabel?: ReactNode
  /** Fires when the success hold ends (1.6 s): set `status` back to `idle` here. */
  onSuccessEnd?: () => void
  /** One-shot actions without their own state: a press runs `onPress`, shows `loading` (when given) for `loadingMs`, then `success` for 1.6 s. Ignored while `status` is passed. */
  feedback?: { loading?: ReactNode; success: ReactNode; loadingMs?: number }
  leadingIcon?: ReactNode
  trailingIcon?: ReactNode
  /** Draws `tick-02` on success. Leave it out and success shows the fill and the label. */
  renderIcon?: RenderIcon
  /** Opens this URL on press, with the link role. */
  href?: string
  /** `false` turns off the press scale, the fades and the spinner. */
  animated?: boolean
  /** Text, or nested Text. */
  children?: ReactNode
}

/** The action of the system. Six variants, three sizes and async states that hold the width. */
export function Button({
  variant = 'primary', size = 'md', shape = 'soft', status: statusProp, loadingLabel, successLabel, onSuccessEnd, feedback,
  leadingIcon, trailingIcon, renderIcon, href, animated = true, children, style, contentStyle, disabled, hitSlop,
  accessibilityLabel, onPress, onLayout, ...rest
}: ButtonProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  // Self-run feedback for one-shot actions; a passed `status` always wins.
  const [auto, setAuto] = useState<'idle' | 'loading' | 'success'>('idle')
  const feedbackOn = feedback !== undefined && statusProp === undefined
  const status = statusProp ?? (feedbackOn ? auto : 'idle')
  const loadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(loadTimer.current), [])
  const busy = status !== 'idle'
  const off = Boolean(disabled)
  const success = status === 'success'
  const solid = useSharedValue(success ? 1 : 0)
  const lock = useSharedValue(0)
  const restWidth = useRef(0)
  const lockStyle = useAnimatedStyle(() => ({ minWidth: lock.value }))
  const solidStyle = useAnimatedStyle(() => ({ opacity: solid.value }))
  const label = status === 'loading' ? (loadingLabel ?? (feedbackOn ? feedback?.loading : undefined) ?? children) : success ? (successLabel ?? (feedbackOn ? feedback?.success : undefined) ?? children) : children
  const offStyle = DISABLED[variant]

  useEffect(() => { lock.value = busy ? restWidth.current : 0 }, [busy, lock])

  useEffect(() => {
    solid.value = withTiming(success ? 1 : 0, { duration: still ? 0 : SUCCESS_MS, easing: EASE_OUT_SOFT })
  }, [success, still, solid])

  useEffect(() => {
    if (!success || (!onSuccessEnd && !feedbackOn)) return undefined
    const timer = setTimeout(() => { onSuccessEnd?.(); setAuto('idle') }, SUCCESS_HOLD_MS)
    return () => clearTimeout(timer)
  }, [success, onSuccessEnd, feedbackOn])

  function handleLayout(event: LayoutChangeEvent): void {
    if (!busy) restWidth.current = event.nativeEvent.layout.width
    onLayout?.(event)
  }

  function handlePress(event: GestureResponderEvent): void {
    onPress?.(event)
    if (href) openLink(href)
    if (!feedbackOn || busy) return
    const wait = feedback?.loadingMs ?? (feedback?.loading ? 700 : 0)
    if (wait <= 0) { setAuto('success'); return }
    setAuto('loading')
    loadTimer.current = setTimeout(() => setAuto('success'), wait)
  }

  function inkFor(pressed: boolean): Ink {
    if (off) return 'textQuaternary'
    if (success) return variant === 'link' ? 'success' : 'textInverse'
    if (variant === 'primary' || variant === 'destructive') return 'textInverse'
    if (variant === 'ghost') return pressed ? 'textPrimary' : 'textSecondary'
    if (variant === 'link') return pressed ? 'textSecondary' : 'textPrimary'
    return 'textPrimary'
  }

  return (
    <PressScale
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={accessibilityLabel ?? (typeof label === 'string' ? label : undefined)}
      aria-disabled={off || busy}
      aria-busy={status === 'loading'}
      still={still || busy}
      disabled={off || busy}
      hitSlop={hitSlop ?? (size === 'sm' ? (TARGET - HEIGHT.sm) / 2 : undefined)}
      style={[styles.box, lockStyle, style]}
      contentStyle={[styles.control, styles[size], shape === 'pill' && styles.pill, variant === 'link' && styles.link, styles[variant], off && offStyle && styles[offStyle], contentStyle]}
      pressedStyle={off ? undefined : styles[`${variant}Pressed` as const]}
      onPress={handlePress}
      onLayout={handleLayout}
      {...rest}
    >
      {({ pressed }) => {
        const ink = inkFor(pressed)
        const lead = status === 'loading'
          ? <Spinner size={ICON_SIZE} color={colors[ink]} label={null} animated={animated} />
          : success
            ? renderIcon ? <Animated.View {...(still ? {} : { entering: TICK })}>{withInk(renderIcon('tick-02', ICON_SIZE), colors[ink])}</Animated.View> : null
            : withInk(leadingIcon, colors[ink])
        return (
          <>
            {variant === 'link' ? null : <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.solid, solidStyle]} />}
            {lead}
            {label == null ? null : (
              <LayoutAnimationConfig skipEntering>
                <Animated.Text
                  key={status}
                  numberOfLines={1}
                  {...(still ? {} : { entering: FadeIn.duration(FADE_MS).easing(EASE_OUT_SOFT), exiting: FadeOut.duration(FADE_MS).easing(EASE_OUT_SOFT) })}
                  style={[labelStyle[size], styles[ink], variant === 'link' && pressed && styles.underline]}
                >
                  {label}
                </Animated.Text>
              </LayoutAnimationConfig>
            )}
            {busy ? null : withInk(trailingIcon, colors[ink])}
          </>
        )
      }}
    </PressScale>
  )
}

const DISABLED = { primary: 'solidOff', destructive: 'solidOff', secondary: 'secondaryOff', outline: 'outlineOff', ghost: null, link: null } as const

const labelType = (size: number, lineHeight: number): TextStyle => ({ ...type(size, 'transparent', '500'), lineHeight })

/** Label sizes on Mobile. Color comes from the ink style. */
const labelStyle = StyleSheet.create({ sm: labelType(14, 18), md: labelType(16, 22), lg: labelType(18, 24) })

const createStyles = (c: Colors) => StyleSheet.create({
  box: { alignSelf: 'flex-start' },
  control: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', overflow: 'hidden' },
  sm: { borderRadius: radius.field, gap: space[1], height: HEIGHT.sm, paddingHorizontal: space[2.5] },
  md: { borderRadius: radius.xl, gap: space[1.5], height: HEIGHT.md, paddingHorizontal: space[3.5] },
  lg: { borderRadius: radius.control, gap: space[2], height: HEIGHT.lg, paddingHorizontal: space[4.5] },
  pill: { borderRadius: radius.full },
  link: { borderRadius: radius.sm, paddingHorizontal: space[3] },
  solid: { backgroundColor: c.success },
  primary: { backgroundColor: c.inverse },
  primaryPressed: { opacity: 0.8 },
  secondary: { backgroundColor: c.ink5 },
  secondaryPressed: { backgroundColor: c.ink10 },
  outline: { backgroundColor: c.surface, borderColor: c.ink8, borderWidth: 1 },
  outlinePressed: { backgroundColor: c.ink5 },
  ghost: { backgroundColor: 'transparent' },
  ghostPressed: { backgroundColor: c.ink8 },
  destructive: { backgroundColor: c.danger },
  destructivePressed: { opacity: 0.82 },
  linkPressed: {},
  solidOff: { backgroundColor: c.ink5 },
  secondaryOff: { backgroundColor: c.ink4 },
  outlineOff: { borderColor: c.ink5 },
  textPrimary: { color: c.textPrimary },
  textSecondary: { color: c.textSecondary },
  textQuaternary: { color: c.textQuaternary },
  textInverse: { color: c.textInverse },
  success: { color: c.success },
  underline: { textDecorationLine: 'underline' },
})
