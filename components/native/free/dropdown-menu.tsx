import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type ViewInstance, type AccessibilityRole, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeInLeft, FadeInRight, ZoomIn, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { Button, withInk } from './button'
import { type, useStill, useThemed } from './card'
import { Kbd } from './kbd'
import { Copy, EASE_OUT, Floating, Mark, soft, Tap, useCompact, type FloatingMotion } from './popover'

const FLASH_MS = 100
const GLIDE_MS = 100
const FADE_MS = 120
const TURN_MS = 160
const DRILL_MS = 180
const DRILL_X = 24
const GAP = 6
const COMPACT_WIDTH = 358
const MENU_WIDTH = 240

const GLIDE = { duration: GLIDE_MS, easing: EASE_OUT }
const DOT_IN = ZoomIn.springify().stiffness(420).damping(26)
const DRILL_IN = FadeInRight.duration(DRILL_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateX: DRILL_X }] })
const DRILL_BACK = FadeInLeft.duration(DRILL_MS).easing(EASE_OUT).withInitialValues({ transform: [{ translateX: -DRILL_X }] })

type Shared = { id?: string; label: string; disabled?: boolean }
/** A row that runs something, or opens a submenu when it has `items`. */
export type MenuAction = Shared & { kind?: 'action'; icon?: ReactNode; shortcut?: string[]; destructive?: boolean; onSelect?: () => void; items?: MenuEntry[]; /** Trailing chevron for a row that opens something else. */ chevron?: boolean }
export type MenuCheckbox = Shared & { kind: 'checkbox'; checked?: boolean; defaultChecked?: boolean; onCheckedChange?: (checked: boolean) => void }
export type MenuRadioGroup = { kind: 'radio'; id?: string; label: string; value?: string; defaultValue?: string; onValueChange?: (value: string) => void; options: { value: string; label: string; disabled?: boolean }[] }
export type MenuLabel = { kind: 'label'; label: string }
export type MenuSeparator = { kind: 'separator' }
/** Anything else, such as an account header. */
export type MenuCustom = { kind: 'custom'; content: ReactNode }
export type MenuEntry = MenuAction | MenuCheckbox | MenuRadioGroup | MenuLabel | MenuSeparator | MenuCustom

/** Toggles outlive the panel, so their values are held above it. */
export type MenuStore = { checks: Record<string, boolean>; radios: Record<string, string>; setCheck: (key: string, value: boolean) => void; setRadio: (key: string, value: string) => void }

export function useMenuStore(): MenuStore {
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [radios, setRadios] = useState<Record<string, string>>({})
  const setCheck = useCallback((key: string, value: boolean) => setChecks((held) => ({ ...held, [key]: value })), [])
  const setRadio = useCallback((key: string, value: string) => setRadios((held) => ({ ...held, [key]: value })), [])
  return { checks, radios, setCheck, setRadio }
}

/** Keycaps at the end of a row. Phones have no keys to show, so they appear on tablets only. */
export function Keycaps({ keys, size = 'md', style }: { keys: string[]; size?: 'sm' | 'md'; style?: StyleProp<ViewStyle> }) {
  const styles = useThemed(createStyles)
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.keys, style]}>{keys.map((key) => <Kbd key={key} size={size}>{key}</Kbd>)}</View>
}

/** The header of an Account menu: avatar, name and email. */
export function MenuAccount({ avatar, name, email }: { avatar: ReactNode; name: string; email: string }) {
  const styles = useThemed(createStyles)
  return (
    <View style={styles.accountHeader}>
      {avatar}
      <View style={styles.accountText}>
        <Text numberOfLines={1} style={styles.accountName}>{name}</Text>
        <Text numberOfLines={1} style={styles.accountEmail}>{email}</Text>
      </View>
    </View>
  )
}

type RowProps = {
  styles: ReturnType<typeof createStyles>
  label: string
  role: AccessibilityRole
  checked?: boolean
  expanded?: boolean
  lead?: ReactNode
  trail?: ReactNode
  shortcut?: string[] | undefined
  disabled?: boolean | undefined
  destructive?: boolean | undefined
  flash?: boolean
  compact: boolean
  onLayout: (e: LayoutChangeEvent) => void
  onPressIn: () => void
  onPressOut: () => void
  onPress: () => void
}

function Row({ styles, label, role, checked, expanded, lead, trail, shortcut, disabled, destructive, flash, compact, onLayout, onPressIn, onPressOut, onPress }: RowProps) {
  return (
    <Pressable
      accessibilityRole={role}
      accessibilityLabel={label}
      {...(checked === undefined ? {} : { 'aria-checked': checked })}
      {...(expanded === undefined ? {} : { 'aria-expanded': expanded })}
      aria-disabled={Boolean(disabled)}
      disabled={disabled}
      onLayout={onLayout}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      onPress={onPress}
      style={[styles.row, Boolean(disabled) && styles.rowOff]}
    >
      {flash ? <View style={[styles.flash, destructive && styles.flashDanger]} /> : null}
      {lead ?? null}
      <Text numberOfLines={1} style={[styles.label, destructive && styles.labelDanger]}>{label}</Text>
      {shortcut && !compact ? <Keycaps keys={shortcut} /> : null}
      {trail ?? null}
    </Pressable>
  )
}

export type MenuProps = {
  entries: MenuEntry[]
  /** The menu's spoken name. */
  label: string
  store: MenuStore
  still: boolean
  /** Fires when a row finished. It leaves time for the row to flash. */
  onClose?: () => void
  style?: StyleProp<ViewStyle>
}

/** The panel: rows, gliding highlight and submenus that drill in place. Dropdown Menu and Menubar both float it. */
export function Menu({ entries, label, store, still, onClose, style }: MenuProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const compact = useCompact()
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const boxes = useRef<Record<string, { y: number; height: number }>>({})
  const [flash, setFlash] = useState<string | null>(null)
  const [drill, setDrill] = useState<{ label: string; entries: MenuEntry[] }[]>([])
  const [forward, setForward] = useState(true)
  const glideY = useSharedValue(0)
  const glideHeight = useSharedValue(0)
  const glideOpacity = useSharedValue(0)
  const level = drill[drill.length - 1]
  const shown = level?.entries ?? entries

  useEffect(() => () => clearTimeout(timer.current), [])

  const measure = (key: string) => (e: LayoutChangeEvent): void => {
    const { y, height } = e.nativeEvent.layout
    boxes.current[key] = { y, height }
  }

  // The wash lives on one layer, so it glides from the last row that was touched.
  function touch(key: string): void {
    const box = boxes.current[key]
    if (!box) return
    const glides = !still && glideOpacity.value > 0
    glideY.value = glides ? withTiming(box.y, GLIDE) : box.y
    glideHeight.value = glides ? withTiming(box.height, GLIDE) : box.height
    glideOpacity.value = withTiming(1, { duration: still ? 0 : GLIDE_MS })
  }

  function untouch(): void {
    glideOpacity.value = withTiming(0, { duration: still ? 0 : FADE_MS })
  }

  function finish(key: string, run?: () => void): void {
    run?.()
    if (still) { onClose?.(); return }
    setFlash(key)
    timer.current = setTimeout(() => onClose?.(), FLASH_MS)
  }

  function enter(entry: MenuAction): void {
    setForward(true)
    setDrill((path) => [...path, { label: entry.label, entries: entry.items ?? [] }])
  }

  function back(): void {
    setForward(false)
    setDrill((path) => path.slice(0, -1))
  }

  const glide = useAnimatedStyle(() => ({ height: glideHeight.value, opacity: glideOpacity.value, transform: [{ translateY: glideY.value }] }))
  const rowProps = (key: string) => ({ styles, compact, onLayout: measure(key), onPressIn: () => touch(key), onPressOut: untouch })

  const render = (entry: MenuEntry, index: number): ReactNode => {
    if (entry.kind === 'separator') return <View key={index} style={styles.separator} />
    if (entry.kind === 'label') return <Text key={index} style={styles.groupLabel}>{entry.label}</Text>
    if (entry.kind === 'custom') return <View key={index} style={styles.custom}>{entry.content}</View>
    const key = entry.id ?? entry.label

    if (entry.kind === 'radio') {
      const value = entry.value ?? store.radios[key] ?? entry.defaultValue
      return (
        <View key={key} accessibilityRole="radiogroup" accessibilityLabel={entry.label}>
          <Text style={styles.groupLabel}>{entry.label}</Text>
          {entry.options.map((option) => {
            const on = option.value === value
            const rowKey = `${key}-${option.value}`
            return (
              <Row
                key={option.value}
                {...rowProps(rowKey)}
                label={option.label}
                role="radio"
                checked={on}
                disabled={option.disabled}
                lead={<View style={styles.indicator}>{on ? <Animated.View {...(still ? {} : { entering: DOT_IN })} style={styles.dot} /> : null}</View>}
                onPress={() => { store.setRadio(key, option.value); entry.onValueChange?.(option.value) }}
              />
            )
          })}
        </View>
      )
    }

    if (entry.kind === 'checkbox') {
      const on = entry.checked ?? store.checks[key] ?? entry.defaultChecked ?? false
      return (
        <Row
          key={key}
          {...rowProps(key)}
          label={entry.label}
          role="checkbox"
          checked={on}
          disabled={entry.disabled}
          lead={<View style={styles.indicator}>{on ? <Mark name="tick" /> : null}</View>}
          onPress={() => { store.setCheck(key, !on); entry.onCheckedChange?.(!on) }}
        />
      )
    }

    const opens = Boolean(entry.items)
    return (
      <Row
        key={key}
        {...rowProps(key)}
        label={entry.label}
        role="menuitem"
        {...(opens ? { expanded: false } : {})}
        shortcut={entry.shortcut}
        disabled={entry.disabled}
        destructive={entry.destructive}
        flash={flash === key}
        lead={entry.icon ? <View style={styles.icon}>{withInk(entry.icon, entry.destructive ? colors.danger : colors.textSecondary)}</View> : null}
        trail={opens || entry.chevron ? <View style={styles.icon}><Mark name="chevron-right" color={colors.textPrimary} /></View> : null}
        onPress={() => (opens ? enter(entry) : finish(key, entry.onSelect))}
      />
    )
  }

  return (
    <View accessibilityRole="menu" accessibilityLabel={level?.label ?? label} style={[styles.menu, style]}>
      <ScrollView bounces={false} style={styles.scroll}>
        <View>
          <Animated.View pointerEvents="none" style={[styles.glide, glide]} />
          {level ? (
            <>
              <Row {...rowProps('back')} label={level.label} role="menuitem" lead={<View style={styles.icon}><Mark name="chevron-left" /></View>} onPress={back} />
              <View style={styles.separator} />
            </>
          ) : null}
          <Animated.View key={drill.length} {...(still || (!level && forward) ? {} : { entering: forward ? DRILL_IN : DRILL_BACK })}>
            {shown.map(render)}
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  )
}

/** The chevron that turns with the menu. Default up when open. */
export function MenuTurn({ open, still, color }: { open: boolean; still: boolean; color?: string }) {
  const turn = useSharedValue(open ? 0 : 180)
  useEffect(() => { turn.value = withTiming(open ? 0 : 180, { duration: still ? 0 : TURN_MS, easing: EASE_OUT }) }, [open, still, turn])
  const turned = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  return <Animated.View style={turned}><Mark name="chevron-up" {...(color ? { color } : {})} /></Animated.View>
}

/** What a custom trigger must spread. */
export type MenuTriggerProps = {
  'aria-expanded': boolean
  onPress: () => void
}

export type DropdownMenuProps = {
  entries: MenuEntry[]
  /** Text on the default trigger, and the menu's name. */
  label: string
  /** Replaces the default trigger: spread the props on any button. */
  trigger?: (props: MenuTriggerProps) => ReactNode
  /** Leading icon on the default trigger. */
  icon?: ReactNode
  /** Turns the default trigger into the Account pill. */
  avatar?: ReactNode
  /** Which edge of the trigger the menu lines up with. */
  align?: 'start' | 'end'
  /** Panel width on tablets. Default `240`. Phones use 358. */
  width?: number
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

export const MENU_MOTION: FloatingMotion = { from: { opacity: 0, scale: 0.96, shift: 4 }, open: { duration: 160, easing: EASE_OUT }, close: { duration: GLIDE_MS } }

/** A list of actions behind a button. It grows from the trigger and the highlight glides between rows. */
export function DropdownMenu({ entries, label, trigger, icon, avatar, align = 'start', width = MENU_WIDTH, open, defaultOpen = false, onOpenChange, animated = true, style }: DropdownMenuProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const compact = useCompact()
  const anchor = useRef<ViewInstance>(null)
  const store = useMenuStore()
  const [held, setHeld] = useState(defaultOpen)
  const shown = open ?? held

  function set(next: boolean): void {
    setHeld(next)
    onOpenChange?.(next)
  }

  const props: MenuTriggerProps = { 'aria-expanded': shown, onPress: () => set(!shown) }

  return (
    <View ref={anchor} collapsable={false} style={[styles.root, style]}>
      {trigger ? trigger(props) : avatar ? (
        <Tap {...props} animated={animated} accessibilityLabel={label} style={[styles.account, shown && styles.accountOpen]}>
          {avatar}
          <Copy style={styles.accountLabel}>{label}</Copy>
          <MenuTurn open={shown} still={still} color={colors.textSecondary} />
        </Tap>
      ) : (
        <Button {...props} variant="secondary" size="sm" animated={animated} leadingIcon={icon} trailingIcon={<MenuTurn open={shown} still={still} />}>{label}</Button>
      )}
      <Floating anchor={anchor} open={shown} side="bottom" align={align} offset={GAP} width={compact ? COMPACT_WIDTH : width} motion={MENU_MOTION} animated={animated} onDismiss={() => set(false)}>
        {() => <Menu entries={entries} label={label} store={store} still={still} onClose={() => set(false)} />}
      </Floating>
    </View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  root: { alignSelf: 'flex-start', maxWidth: '100%' },
  account: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.full, flexDirection: 'row', gap: space[2], height: 44, paddingLeft: space[1.5], paddingRight: space[2.5] },
  accountOpen: { backgroundColor: c.ink10 },
  accountLabel: { ...type(14, c.textPrimary), lineHeight: 20 },
  accountHeader: { alignItems: 'center', flexDirection: 'row', gap: space[2.5] },
  accountText: { flexShrink: 1, minWidth: 0 },
  accountName: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  accountEmail: { ...type(12, c.textSecondary), lineHeight: 16 },
  menu: { ...soft(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.card, borderWidth: 1, padding: space[1.5] },
  scroll: { maxHeight: 420 },
  glide: { backgroundColor: c.ink4, borderRadius: radius.xl, left: 0, position: 'absolute', right: 0, top: 0 },
  row: { alignItems: 'center', borderRadius: radius.xl, flexDirection: 'row', gap: space[2.5], minHeight: 44, padding: space[3] },
  rowOff: { opacity: 0.4 },
  flash: { ...StyleSheet.absoluteFill, backgroundColor: c.ink10, borderRadius: radius.xl },
  flashDanger: { backgroundColor: c.danger, opacity: 0.15 },
  icon: { alignItems: 'center', height: 20, justifyContent: 'center', width: 20 },
  indicator: { alignItems: 'center', height: 20, justifyContent: 'center', width: 20 },
  dot: { backgroundColor: c.textPrimary, borderRadius: radius.full, height: 6, width: 6 },
  label: { ...type(16, c.textPrimary), flex: 1, lineHeight: 22, minWidth: 0 },
  labelDanger: { color: c.danger },
  keys: { flexDirection: 'row', gap: space[0.5] },
  groupLabel: { ...type(12, c.textSecondary), lineHeight: 16, paddingBottom: space[1], paddingHorizontal: space[2.5], paddingTop: space[2] },
  separator: { backgroundColor: c.ink5, height: 1, marginHorizontal: space[1.5], marginVertical: space[1] },
  custom: { paddingHorizontal: space[2.5], paddingVertical: space[1.5] },
})
