import { useEffect, useRef, useState, type ReactNode } from 'react'
import { StyleSheet, View, type LayoutChangeEvent, type StyleProp, type TextStyle, type ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeOut, LayoutAnimationConfig, ZoomIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { EASE_OUT_SOFT, HEIGHT, PressScale, TARGET, usePressScale, withInk } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { DropdownMenu, MenuTurn, type MenuEntry } from './dropdown-menu'
import { Spinner } from './spinner'

const FADE_MS = 200
const SUCCESS_MS = 260
const SUCCESS_HOLD_MS = 1600
const ICON = 20
const TICK = ZoomIn.springify().stiffness(420).damping(42).mass(1).withInitialValues({ transform: [{ scale: 0.6 }] })

type Size = 'sm' | 'md' | 'lg'
type Variant = 'secondary' | 'outline' | 'primary'
type Ink = 'textPrimary' | 'textInverse' | 'textQuaternary'

export type SplitButtonProps = {
  /** Default `secondary`. Primary is for the one main action in a view. */
  variant?: Variant
  /** Default `md`: 36, 44, 52, like Button on Mobile. */
  size?: Size
  /** Outer corners: `soft` keeps the Button radius, `pill` is full. Inner corners are square. */
  shape?: 'soft' | 'pill'
  /** The main action's text. */
  label: string
  leadingIcon?: ReactNode
  /** The main action. */
  onPress?: () => void
  /** The chevron's accessible name. Default "More options". */
  menuLabel?: string
  /** The menu behind the chevron, in Dropdown Menu's entries model. */
  entries: MenuEntry[]
  /** Which edge of the whole control the menu lines up with. Default `end`, under the chevron. */
  align?: 'start' | 'end'
  /** Async state of the main action, as on Button. The width holds while it is not `idle`. */
  status?: 'idle' | 'loading' | 'success'
  loadingLabel?: string
  successLabel?: string
  /** Fires when the 1.6 s success hold ends: set `status` back to `idle` here. */
  onSuccessEnd?: () => void
  /** Draws `tick-02` on success. */
  renderIcon?: RenderIcon
  /** Disables both segments. */
  disabled?: boolean
  /** `false` turns off the press scale, the label motion, the chevron turn and the menu scale. */
  animated?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  style?: StyleProp<ViewStyle>
}

/** A main action and a chevron that opens a menu of related ones, joined into one control by a 1 px divider. */
export function SplitButton({
  variant = 'secondary', size = 'md', shape = 'soft', label, leadingIcon, onPress, menuLabel = 'More options', entries, align = 'end',
  status = 'idle', loadingLabel, successLabel, onSuccessEnd, renderIcon, disabled = false, animated = true, open, onOpenChange, style,
}: SplitButtonProps) {
  const s = useThemed(createStyles)
  const c = useColors()
  const still = useStill(animated)
  const [held, setHeld] = useState(false)
  const shown = open ?? held
  const set = (next: boolean): void => { setHeld(next); onOpenChange?.(next) }
  const busy = status !== 'idle'
  const success = status === 'success'
  // The whole control presses as one shape, so the join never opens. The segments do not scale on their own.
  const pressing = usePressScale(still || disabled)
  const solid = useSharedValue(success ? 1 : 0)
  const lock = useSharedValue(0)
  const restWidth = useRef(0)

  useEffect(() => { lock.value = busy ? restWidth.current : 0 }, [busy, lock])
  useEffect(() => {
    solid.value = withTiming(success ? 1 : 0, { duration: still ? 0 : SUCCESS_MS, easing: EASE_OUT_SOFT })
  }, [success, still, solid])
  useEffect(() => {
    if (!success || !onSuccessEnd) return undefined
    const timer = setTimeout(onSuccessEnd, SUCCESS_HOLD_MS)
    return () => clearTimeout(timer)
  }, [success, onSuccessEnd])

  const lockStyle = useAnimatedStyle(() => ({ minWidth: lock.value }))
  const solidStyle = useAnimatedStyle(() => ({ opacity: solid.value }))
  const ink: Ink = disabled ? 'textQuaternary' : variant === 'primary' || success ? 'textInverse' : 'textPrimary'
  const text = status === 'loading' ? (loadingLabel ?? label) : success ? (successLabel ?? label) : label
  const outer = shape === 'pill' ? s.pill : s[size]
  const fill = [s[variant], disabled && s[`${variant}Off` as const]]
  const pressedFill = disabled ? undefined : s[`${variant}Pressed` as const]
  const slop = size === 'sm' ? (TARGET - HEIGHT.sm) / 2 : 0

  function onLayout(event: LayoutChangeEvent): void {
    if (!busy) restWidth.current = event.nativeEvent.layout.width
  }

  const lead = status === 'loading'
    ? <Spinner size={ICON} color={c[ink]} label={null} animated={animated} />
    : success
      ? renderIcon ? <Animated.View {...(still ? {} : { entering: TICK })}>{withInk(renderIcon('tick-02', ICON), c[ink])}</Animated.View> : null
      : withInk(leadingIcon, c[ink])

  return (
    <Animated.View role="group" aria-label={label} style={[s.root, outer, variant === 'outline' && !disabled && s.lift, pressing.style, style]}>
      <DropdownMenu
        entries={entries}
        label={menuLabel}
        align={align}
        open={shown}
        onOpenChange={set}
        animated={animated}
        trigger={(trigger) => (
          <View style={s.row}>
            <Animated.View style={lockStyle} onLayout={onLayout}>
              <PressScale
                still
                accessibilityRole="button"
                accessibilityLabel={text}
                aria-busy={status === 'loading'}
                aria-disabled={disabled || busy}
                disabled={disabled || busy}
                hitSlop={slop}
                contentStyle={[s.segment, s[`${size}Main` as const], outer, s.main, fill]}
                pressedStyle={pressedFill}
                onPressIn={pressing.pressIn}
                onPressOut={pressing.pressOut}
                onPress={() => { if (shown) set(false); onPress?.() }}
              >
                <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, s.solid, solidStyle]} />
                {lead}
                <LayoutAnimationConfig skipEntering>
                  <Animated.Text key={status} numberOfLines={1} {...(still ? {} : { entering: FadeIn.duration(FADE_MS).easing(EASE_OUT_SOFT), exiting: FadeOut.duration(FADE_MS).easing(EASE_OUT_SOFT) })} style={[LABEL[size], s[ink]]}>{text}</Animated.Text>
                </LayoutAnimationConfig>
              </PressScale>
            </Animated.View>
            <PressScale
              still
              accessibilityRole="button"
              accessibilityLabel={menuLabel}
              aria-expanded={trigger['aria-expanded']}
              aria-disabled={disabled}
              disabled={disabled}
              hitSlop={slop}
              contentStyle={[s.segment, outer, s.chevron, s[`${size}Square` as const], fill, shown && pressedFill]}
              pressedStyle={pressedFill}
              onPressIn={pressing.pressIn}
              onPressOut={pressing.pressOut}
              onPress={trigger.onPress}
            >
              <View pointerEvents="none" style={[s.divider, variant === 'primary' && s.dividerOnInk, variant === 'outline' && s.dividerOutline, disabled && s.dividerOff]} />
              <MenuTurn open={shown} still={still} color={c[ink]} />
            </PressScale>
          </View>
        )}
      />
      {/* The outline's one continuous edge, drawn over both segments so their fills never cover it. */}
      {variant === 'outline' ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, outer, s.edge, disabled && s.edgeOff]} /> : null}
    </Animated.View>
  )
}

const label = (size: number, lineHeight: number): TextStyle => ({ ...type(size, 'transparent', '500'), lineHeight })
const LABEL = StyleSheet.create({ sm: label(14, 18), md: label(16, 22), lg: label(18, 24) })

const createStyles = (c: Colors) => StyleSheet.create({
  root: { alignSelf: 'flex-start', maxWidth: '100%' },
  lift: { elevation: 1, shadowColor: c.textPrimary, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 2 },
  row: { flexDirection: 'row' },
  sm: { borderRadius: radius.field },
  md: { borderRadius: radius.xl },
  lg: { borderRadius: radius.control },
  pill: { borderRadius: radius.full },
  segment: { alignItems: 'center', flexDirection: 'row', justifyContent: 'center', overflow: 'hidden' },
  smMain: { gap: space[1], height: HEIGHT.sm, paddingHorizontal: space[2.5] },
  mdMain: { gap: space[1.5], height: HEIGHT.md, paddingHorizontal: space[3.5] },
  lgMain: { gap: space[2], height: HEIGHT.lg, paddingHorizontal: space[4.5] },
  // Square on both sides: the Pressable sits inside PressScale's wrapper, so a stretch would never reach the row's height.
  smSquare: { height: HEIGHT.sm, width: HEIGHT.sm },
  mdSquare: { height: HEIGHT.md, width: HEIGHT.md },
  lgSquare: { height: HEIGHT.lg, width: HEIGHT.lg },
  main: { borderBottomRightRadius: 0, borderTopRightRadius: 0 },
  chevron: { borderBottomLeftRadius: 0, borderTopLeftRadius: 0, paddingHorizontal: 0 },
  solid: { backgroundColor: c.success },
  secondary: { backgroundColor: c.ink5 },
  secondaryPressed: { backgroundColor: c.ink10 },
  secondaryOff: { backgroundColor: c.ink4 },
  outline: { backgroundColor: c.surface },
  outlinePressed: { backgroundColor: c.ink5 },
  outlineOff: { backgroundColor: c.surface },
  primary: { backgroundColor: c.inverse },
  primaryPressed: { opacity: 0.8 },
  primaryOff: { backgroundColor: c.ink5 },
  divider: { backgroundColor: c.ink10, bottom: 0, left: 0, position: 'absolute', top: 0, width: 1 },
  // kit.ts has no 20% inverse ink, so the divider on the ink fill is the inverse text at a fifth.
  dividerOnInk: { backgroundColor: c.textInverse, opacity: 0.2 },
  dividerOutline: { backgroundColor: c.ink8 },
  dividerOff: { backgroundColor: c.ink5, opacity: 1 },
  edge: { borderColor: c.ink8, borderWidth: 1 },
  edgeOff: { borderColor: c.ink5 },
  textPrimary: { color: c.textPrimary },
  textInverse: { color: c.textInverse },
  textQuaternary: { color: c.textQuaternary },
})
