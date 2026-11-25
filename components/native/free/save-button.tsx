import { useEffect, useRef, useState } from 'react'
import { Modal, Pressable, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewInstance, type ViewStyle } from 'react-native'
import Animated, { LayoutAnimationConfig, runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated'
import { accent, radius, space, toggleState, useColors, type Colors } from '../kit'
import { EASE_OUT, HEIGHT, ICON_SIZE, LabelSwap, PressScale, withInk, type Spring } from './button'
import { type, useStill, useThemed, type RenderIcon } from './card'

const RIBBON: Spring = { stiffness: 520, damping: 24, mass: 1 }
const ROLL = 14
const STILL_MS = 120
const OPEN_MS = 200
const REMOVED_MS = 1600
const PANEL_WIDTH = 288
const PANEL_GAP = space[2]
const EDGE = space[4]

function rollIn() {
  'worklet'
  return {
    initialValues: { opacity: 0, transform: [{ translateY: ROLL }] },
    animations: { opacity: withSpring(1, RIBBON), transform: [{ translateY: withSpring(0, RIBBON) }] },
  }
}

function rollOut() {
  'worklet'
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: { opacity: withSpring(0, RIBBON), transform: [{ translateY: withSpring(-ROLL, RIBBON) }] },
  }
}

export type SaveCollection = { id: string; name: string; meta?: string; tone?: 'accent' | 'success' | 'warning' }

const DEFAULTS: SaveCollection[] = [
  { id: 'reading', name: 'Reading list', meta: '24 items', tone: 'accent' },
  { id: 'ideas', name: 'Ideas', meta: '12 items', tone: 'success' },
  { id: 'later', name: 'For later', meta: '8 items', tone: 'warning' },
]

export type SaveButtonProps = {
  collections?: SaveCollection[]
  defaultSelected?: string[]
  /** Fires with the collection ids this item is in. An empty list means it is no longer saved. */
  onChange?: (selected: string[]) => void
  onNewCollection?: () => void
  /** Draws `bookmark`, `bookmark-check`, `bookmark-off`, `tick-02` and `plus`. */
  renderIcon: RenderIcon
  disabled?: boolean
  /** `false` turns off the ribbon, the rolling label and the panel scale. */
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A bookmark that files into collections. */
export function SaveButton({ collections = DEFAULTS, defaultSelected = [], onChange, onNewCollection, renderIcon, disabled, animated = true, style }: SaveButtonProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const screen = useWindowDimensions()
  const trigger = useRef<ViewInstance>(null)
  const [selected, setSelected] = useState(defaultSelected)
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [removed, setRemoved] = useState(false)
  const progress = useSharedValue(0)
  const left = useSharedValue(0)
  const top = useSharedValue(0)
  const saved = selected.length > 0
  const off = Boolean(disabled)

  useEffect(() => {
    if (!removed) return undefined
    const timer = setTimeout(() => setRemoved(false), REMOVED_MS)
    return () => clearTimeout(timer)
  }, [removed])

  useEffect(() => {
    if (open) {
      setMounted(true)
      progress.value = withTiming(1, { duration: still ? STILL_MS : OPEN_MS, easing: EASE_OUT })
    } else {
      progress.value = withTiming(0, { duration: STILL_MS, easing: EASE_OUT }, (finished) => { if (finished) runOnJS(setMounted)(false) })
    }
  }, [open, still, progress])

  const panelStyle = useAnimatedStyle(() => ({
    left: left.value,
    opacity: progress.value,
    top: top.value,
    transform: still ? [] : [{ translateY: 6 * (1 - progress.value) }, { scale: 0.97 + 0.03 * progress.value }],
  }))

  function update(next: string[]): void {
    setSelected(next)
    onChange?.(next)
    setRemoved(next.length === 0)
  }

  /** The panel sits under the trigger, in a Modal so a tap anywhere else can close it. */
  function show(): void {
    trigger.current?.measureInWindow((x, y, _width, height) => {
      left.value = Math.max(EDGE, Math.min(x, screen.width - PANEL_WIDTH - EDGE))
      top.value = y + height + PANEL_GAP
      setOpen(true)
    })
  }

  function handlePress(): void {
    if (saved) { update([]); return }
    const first = collections[0]
    if (first) update([first.id])
    show()
  }

  const state = removed ? 'removed' : saved ? 'saved' : 'unsaved'
  const icon = removed ? 'bookmark-off' : saved ? 'bookmark-check' : 'bookmark'
  const text = removed ? 'Removed' : saved ? 'Saved' : 'Save'
  const ink = off ? colors.textQuaternary : saved ? colors.textInverse : colors.textPrimary
  const inkStyle = off ? styles.inkOff : saved ? styles.inkInverse : styles.inkPrimary
  const toneOf = (tone: SaveCollection['tone']): StyleProp<ViewStyle> => (tone === 'success' ? styles.toneSuccess : tone === 'warning' ? styles.toneWarning : styles.toneAccent)

  return (
    <View style={[styles.root, style]}>
      <PressScale
        ref={trigger}
        {...toggleState(saved)}
        accessibilityLabel={text}
        aria-disabled={off}
        aria-expanded={open}
        still={still}
        disabled={disabled}
        contentStyle={[styles.button, saved ? styles.buttonSaved : styles.buttonRest, off && styles.buttonOff]}
        pressedStyle={saved ? styles.savedPressed : styles.restPressed}
        onPress={handlePress}
      >
        <LabelSwap swapKey={state} still={still}>{withInk(renderIcon(icon, ICON_SIZE), ink)}</LabelSwap>
        <View style={styles.roll}>
          <LayoutAnimationConfig skipEntering>
            <Animated.Text key={text} numberOfLines={1} {...(still ? {} : { entering: rollIn, exiting: rollOut })} style={[styles.label, inkStyle]}>{text}</Animated.Text>
          </LayoutAnimationConfig>
        </View>
      </PressScale>
      <Modal transparent statusBarTranslucent visible={mounted} animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={() => setOpen(false)} />
        <Animated.View role="group" accessibilityLabel="Save to" style={[styles.panel, panelStyle]}>
          <View style={styles.panelHeader}>
            <Text style={styles.panelTitle}>Save to</Text>
            <Text style={styles.meta}>{collections.length} collections</Text>
          </View>
          <View style={styles.body}>
            {collections.map((collection) => {
              const on = selected.includes(collection.id)
              return (
                <Pressable
                  key={collection.id}
                  {...toggleState(on)}
                  accessibilityLabel={collection.name}
                  style={({ pressed }) => [styles.row, (on || pressed) && styles.rowOn]}
                  onPress={() => update(on ? selected.filter((item) => item !== collection.id) : [...selected, collection.id])}
                >
                  <View style={styles.swatch}><View style={[styles.tint, toneOf(collection.tone)]} /></View>
                  <View style={styles.text}>
                    <Text numberOfLines={1} style={styles.name}>{collection.name}</Text>
                    {collection.meta ? <Text numberOfLines={1} style={styles.meta}>{collection.meta}</Text> : null}
                  </View>
                  {on ? withInk(renderIcon('tick-02', ICON_SIZE), colors.textPrimary) : null}
                </Pressable>
              )
            })}
            <Pressable accessibilityRole="button" accessibilityLabel="New collection" style={({ pressed }) => [styles.row, pressed && styles.rowOn]} onPress={onNewCollection}>
              <View style={[styles.swatch, styles.swatchNeutral]}>{withInk(renderIcon('plus', 14), colors.textSecondary)}</View>
              <Text numberOfLines={1} style={styles.create}>New collection</Text>
            </Pressable>
          </View>
        </Animated.View>
      </Modal>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  root: { alignSelf: 'flex-start' },
  button: { alignItems: 'center', borderRadius: radius.full, flexDirection: 'row', gap: space[2], height: HEIGHT.md, paddingHorizontal: space[3.5] },
  buttonRest: { backgroundColor: c.surface, borderColor: c.ink8, borderWidth: 1 },
  buttonSaved: { backgroundColor: c.inverse },
  buttonOff: { backgroundColor: c.ink5, borderColor: 'transparent' },
  restPressed: { backgroundColor: c.ink5 },
  savedPressed: { opacity: 0.8 },
  roll: { flexDirection: 'row', overflow: 'hidden' },
  label: type(16, c.textPrimary, '500'),
  inkPrimary: { color: c.textPrimary },
  inkInverse: { color: c.textInverse },
  inkOff: { color: c.textQuaternary },
  panel: { backgroundColor: c.muted, borderRadius: radius.tray, maxWidth: PANEL_WIDTH, padding: space[1], position: 'absolute', width: PANEL_WIDTH },
  panelHeader: { alignItems: 'center', flexDirection: 'row', gap: space[2], justifyContent: 'space-between', paddingBottom: space[2.5], paddingHorizontal: space[3], paddingTop: space[2] },
  panelTitle: type(16, c.textPrimary, '500'),
  meta: type(12, c.textSecondary),
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, gap: space[0.5], padding: space[1] },
  row: { alignItems: 'center', borderRadius: radius.xl, flexDirection: 'row', gap: space[3], height: 44, paddingLeft: space[2], paddingRight: space[3] },
  rowOn: { backgroundColor: c.ink4 },
  swatch: { alignItems: 'center', borderRadius: radius.lg, height: space[7], justifyContent: 'center', overflow: 'hidden', width: space[7] },
  swatchNeutral: { backgroundColor: c.ink5 },
  tint: { ...StyleSheet.absoluteFill, opacity: 0.16 },
  toneAccent: { backgroundColor: accent.sky.to },
  toneSuccess: { backgroundColor: c.success },
  toneWarning: { backgroundColor: accent.orange.to },
  text: { flex: 1, minWidth: 0 },
  name: type(14, c.textPrimary, '500'),
  create: type(14, c.textSecondary, '500'),
})
