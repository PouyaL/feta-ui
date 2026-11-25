import { useCallback, useMemo, type ReactNode } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import Animated, { runOnJS, useAnimatedProps, useFrameCallback, useSharedValue, type SharedValue } from 'react-native-reanimated'
import Svg, { Path } from 'react-native-svg'
import { radius, space, useColors, type Colors } from '../kit'
import { PressScale, withInk, type PressScaleProps } from './button'
import { type, useStill, useThemed } from './card'

const STEP = 12
const LENGTH = 6
const THICK = 1.5
const FADE = 64
const NEAR = 84
const PULL = 7
const REST_ALPHA = 0.07
const NEAR_ALPHA = 0.5
const STIFFNESS = 240
const DAMPING = 21
const BUTTON = { width: 144, height: 40 }
/** Filings are drawn as one path per ink level, which keeps a frame to a few native updates. */
const INKS = [0.08, 0.16, 0.32, 0.64]
const SLOP = 2

const AnimatedPath = Animated.createAnimatedComponent(Path)

type Filing = { x: number; y: number; rest: number; angle: number; velocity: number; alpha: number; pull: number }
type Touch = { x: number; y: number } | null

export type AttractButtonProps = Omit<PressScaleProps, 'still' | 'scale' | 'spring' | 'children' | 'contentStyle' | 'pressedStyle'> & {
  children?: ReactNode
  /** Usually `magnet`. It sits turned 90 degrees. */
  icon?: ReactNode
  /** `false` keeps the filings static. */
  animated?: boolean
}

/** Field lines of a bar magnet along the button: the angle a filing rests at. */
function restAngle(x: number, y: number, width: number, height: number): number {
  const part = (fromX: number, sign: number): [number, number] => {
    const dx = x - fromX
    const dy = y - height / 2
    const cube = Math.max(1, (dx * dx + dy * dy) ** 1.5)
    return [(sign * dx) / cube, (sign * dy) / cube]
  }
  const [ax, ay] = part(width / 2 - 60, 1)
  const [bx, by] = part(width / 2 + 60, -1)
  return Math.atan2(ay + by, ax + bx)
}

function layFilings(width: number, height: number): Filing[] {
  const filings: Filing[] = []
  for (let y = STEP / 2; y < height; y += STEP) {
    for (let x = STEP / 2; x < width; x += STEP) {
      const dx = Math.max(Math.abs(x - width / 2) - BUTTON.width / 2, 0)
      const dy = Math.max(Math.abs(y - height / 2) - BUTTON.height / 2, 0)
      const distance = Math.hypot(dx, dy)
      if (distance > FADE) continue
      const rest = restAngle(x, y, width, height)
      filings.push({ x, y, rest, angle: rest, velocity: 0, alpha: 1 - distance / FADE, pull: 0 })
    }
  }
  return filings
}

/** One path string per ink level. */
function drawFilings(filings: Filing[], at: Touch, width: number, height: number): string[] {
  'worklet'
  const paths = INKS.map(() => '')
  for (const filing of filings) {
    const near = at ? Math.max(0, 1 - Math.hypot(at.x - filing.x, at.y - filing.y) / NEAR) : 0
    const ink = filing.alpha * (REST_ALPHA + near * NEAR_ALPHA) * 2
    const level = INKS.findIndex((value) => ink <= value)
    const band = level < 0 ? INKS.length - 1 : level
    const cx = filing.x + (width / 2 - filing.x) * filing.pull
    const cy = filing.y + (height / 2 - filing.y) * filing.pull
    const cos = Math.cos(filing.angle)
    const sin = Math.sin(filing.angle)
    const lx = (cos * LENGTH) / 2
    const ly = (sin * LENGTH) / 2
    const tx = (-sin * THICK) / 2
    const ty = (cos * THICK) / 2
    paths[band] += `M${(cx - lx - tx).toFixed(1)} ${(cy - ly - ty).toFixed(1)}L${(cx + lx - tx).toFixed(1)} ${(cy + ly - ty).toFixed(1)}L${(cx + lx + tx).toFixed(1)} ${(cy + ly + ty).toFixed(1)}L${(cx - lx + tx).toFixed(1)} ${(cy - ly + ty).toFixed(1)}Z`
  }
  return paths
}

function InkPath({ paths, index, color }: { paths: SharedValue<string[]>; index: number; color: string }) {
  const props = useAnimatedProps(() => ({ d: paths.value[index] ?? '' }))
  return <AnimatedPath animatedProps={props} fill={color} fillOpacity={INKS[index] ?? 0} />
}

/** A button in a field of iron filings. A touch on the field turns them to it and pulls them in. */
export function AttractButton({ children = 'Attract', icon, animated = true, disabled, style, onLayout, accessibilityLabel, accessibilityState, ...rest }: AttractButtonProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const off = Boolean(disabled)
  const filings = useSharedValue<Filing[]>([])
  const paths = useSharedValue<string[]>(INKS.map(() => ''))
  const pointer = useSharedValue<Touch>(null)
  const width = useSharedValue(0)
  const height = useSharedValue(0)

  const frame = useFrameCallback((info) => {
    const dt = Math.min(0.032, (info.timeSincePreviousFrame ?? 16) / 1000)
    const at = pointer.value
    let moving = false
    // Mutated in place on the UI thread: nothing reacts to this value, it is only read here.
    for (const filing of filings.value) {
      const distance = at ? Math.hypot(at.x - filing.x, at.y - filing.y) : Infinity
      const blend = at && distance < NEAR ? Math.atan2(at.y - filing.y, at.x - filing.x) : filing.rest
      const delta = Math.atan2(Math.sin(blend - filing.angle), Math.cos(blend - filing.angle))
      filing.velocity += (STIFFNESS * delta - DAMPING * filing.velocity) * dt
      filing.angle += filing.velocity * dt
      const pullTarget = at ? PULL / Math.max(24, Math.hypot(width.value / 2 - filing.x, height.value / 2 - filing.y)) : 0
      filing.pull += (pullTarget - filing.pull) * Math.min(1, dt * 14)
      if (Math.abs(delta) > 0.002 || Math.abs(filing.velocity) > 0.01 || Math.abs(filing.pull - pullTarget) > 0.001) moving = true
    }
    paths.value = drawFilings(filings.value, at, width.value, height.value)
    if (!moving) runOnJS(sleep)()
  }, false)

  function sleep(): void {
    frame.setActive(false)
  }

  const wake = useCallback(() => frame.setActive(true), [frame])

  // Manual, and never activated: the touch is watched without taking it from the Pressable inside.
  const touch = useMemo(() => Gesture.Manual()
    .enabled(!still)
    .onTouchesDown((event, manager) => {
      manager.begin()
      const first = event.changedTouches[0]
      if (first) pointer.value = { x: first.x, y: first.y }
      runOnJS(wake)()
    })
    .onTouchesMove((event) => {
      const first = event.changedTouches[0]
      if (first) pointer.value = { x: first.x, y: first.y }
      runOnJS(wake)()
    })
    .onTouchesUp((_, manager) => {
      pointer.value = null
      manager.end()
      runOnJS(wake)()
    })
    .onTouchesCancelled((_, manager) => {
      pointer.value = null
      manager.fail()
      runOnJS(wake)()
    }), [still, pointer, wake])

  function handleLayout(event: LayoutChangeEvent): void {
    const box = event.nativeEvent.layout
    const laid = layFilings(box.width, box.height)
    width.value = box.width
    height.value = box.height
    filings.value = laid
    paths.value = drawFilings(laid, null, box.width, box.height)
  }

  return (
    <GestureDetector gesture={touch}>
      <View style={[styles.field, style as StyleProp<ViewStyle>]} onLayout={handleLayout}>
        <Svg aria-hidden pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
          {INKS.map((_, index) => <InkPath key={index} paths={paths} index={index} color={colors.textPrimary} />)}
        </Svg>
        <PressScale
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel ?? (typeof children === 'string' ? children : undefined)}
          aria-disabled={off}
          accessibilityState={{ disabled: off, ...accessibilityState }}
          still={still}
          disabled={disabled}
          hitSlop={SLOP}
          contentStyle={[styles.button, off && styles.buttonOff]}
          pressedStyle={styles.pressed}
          onLayout={onLayout}
          {...rest}
        >
          <View style={styles.magnet}>{withInk(icon, off ? colors.textQuaternary : colors.textInverse)}</View>
          <Text numberOfLines={1} style={[styles.label, off && styles.labelOff]}>{children}</Text>
        </PressScale>
      </View>
    </GestureDetector>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  field: { alignItems: 'center', height: 168, justifyContent: 'center', maxWidth: '100%', width: 272 },
  button: { alignItems: 'center', backgroundColor: c.inverse, borderRadius: radius.xl, flexDirection: 'row', gap: space[2], height: BUTTON.height, justifyContent: 'center', width: BUTTON.width },
  buttonOff: { backgroundColor: c.ink5 },
  pressed: { opacity: 0.8 },
  magnet: { transform: [{ rotate: '90deg' }] },
  label: type(16, c.textInverse, '500'),
  labelOff: { color: c.textQuaternary },
})
