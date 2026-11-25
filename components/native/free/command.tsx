import { useMemo, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeIn, FadeInLeft, FadeInUp, FadeOut, ZoomIn } from 'react-native-reanimated'
import { pressedState, radius, space, useColors, type Colors } from '../kit'
import { Button } from './button'
import { type, useStill, useThemed } from './card'
import { Modal, useDisclosure, type DisclosureProps, type ModalMotion } from './dialog'
import { Keycaps } from './dropdown-menu'
import { EASE_IN, EASE_OUT, Mark, soft, useCompact } from './popover'
import { Spinner } from './spinner'

const SUBMENU_X = 16
const FADE_MS = 120
const LIST_HEIGHT = 360
const DIALOG_WIDTH = 580

const ROW_IN = FadeIn.duration(FADE_MS).easing(EASE_OUT)
const ROW_OUT = FadeOut.duration(FADE_MS)
const WASH_IN = FadeIn.duration(100)
const WASH_OUT = FadeOut.duration(100)
const LIST_IN = FadeInLeft.duration(200).easing(EASE_OUT).withInitialValues({ transform: [{ translateX: -SUBMENU_X }] })
const CONFIRM_IN = FadeInUp.springify().stiffness(420).damping(26).withInitialValues({ transform: [{ translateY: -4 }] })
const CHIP_IN = ZoomIn.springify().stiffness(420).damping(26).withInitialValues({ transform: [{ scale: 0.8 }] })

export type CommandItem = {
  id: string
  title: string
  description?: string
  icon?: ReactNode
  /** Keycaps on tablets. */
  shortcut?: string[]
  disabled?: boolean
  /** May return a promise: the row keeps a spinner until it settles. */
  onRun?: () => void | Promise<void>
  /** Opens a submenu in place. */
  items?: CommandItem[]
  /** Holds the command behind an inline danger confirm. */
  confirm?: { title: string; body: string; action: string }
}
export type CommandGroup = { label: string; items: CommandItem[] }

export type CommandProps = {
  groups: CommandGroup[]
  placeholder?: string
  /** Starts with this query. */
  defaultQuery?: string
  /** Offered when nothing matches, with the query. */
  onAsk?: (query: string) => void
  /** Fires after a command runs and on Cancel. */
  onClose?: () => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** Every letter in order, so `shr` finds Share. */
export function fuzzy(query: string, text: string): boolean {
  let at = 0
  const haystack = text.toLowerCase()
  for (const char of query.toLowerCase().replace(/\s+/g, '')) {
    at = haystack.indexOf(char, at)
    if (at < 0) return false
    at += 1
  }
  return true
}

const countItems = (groups: CommandGroup[]): number => groups.reduce((sum, group) => sum + group.items.length, 0)

/** A menu for every action in the product: type to narrow it, tap a row, or press return for the top match. */
export function Command({ groups, placeholder = 'Search commands', defaultQuery = '', onAsk, onClose, animated = true, style }: CommandProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const compact = useCompact()
  const [query, setQuery] = useState(defaultQuery)
  const [path, setPath] = useState<CommandItem[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [running, setRunning] = useState<string | null>(null)
  const level = path[path.length - 1]

  const base = useMemo<CommandGroup[]>(() => (level ? [{ label: level.title, items: level.items ?? [] }] : groups), [level, groups])
  const shownGroups = useMemo(() => {
    const q = query.trim()
    if (!q) return base
    return base.map((group) => ({ ...group, items: group.items.filter((item) => fuzzy(q, `${item.title} ${item.description ?? ''}`)) })).filter((group) => group.items.length)
  }, [base, query])
  const flat = useMemo(() => shownGroups.flatMap((group) => group.items), [shownGroups])
  const enabled = useMemo(() => flat.filter((item) => !item.disabled), [flat])
  const askable = Boolean(onAsk && query.trim() && !flat.length)
  const active = enabled.some((item) => item.id === activeId) ? activeId : enabled[0]?.id ?? null

  async function run(item: CommandItem): Promise<void> {
    if (item.disabled) return
    if (item.items) { setPath((held) => [...held, item]); setQuery(''); setActiveId(null); return }
    if (item.confirm && confirming !== item.id) { setConfirming(item.id); return }
    const result = item.onRun?.()
    if (result) {
      setRunning(item.id)
      await result
      setRunning(null)
    }
    setConfirming(null)
    onClose?.()
  }

  function submit(): void {
    if (askable) { onAsk?.(query.trim()); return }
    const item = enabled.find((entry) => entry.id === active)
    if (item) void run(item)
  }

  const pop = (): void => setPath((held) => held.slice(0, -1))
  const fade = still ? {} : { entering: ROW_IN, exiting: ROW_OUT }

  const row = (item: CommandItem): ReactNode => {
    const on = item.id === active
    if (confirming === item.id && item.confirm) {
      return (
        <Animated.View key={item.id} {...(still ? {} : { entering: CONFIRM_IN })} accessibilityRole="alert" accessibilityLabel={item.confirm.title} style={styles.confirm}>
          <View style={styles.confirmWash} />
          {item.icon ? <View style={styles.icon}>{item.icon}</View> : null}
          <View style={styles.stacked}>
            <Text style={styles.confirmTitle}>{item.confirm.title}</Text>
            <Text style={styles.confirmBody}>{item.confirm.body}</Text>
            <View style={styles.confirmActions}>
              <Button variant="ghost" size="sm" animated={animated} onPress={() => setConfirming(null)}>Cancel</Button>
              <Button variant="destructive" size="sm" animated={animated} onPress={() => { void run(item) }}>{item.confirm.action}</Button>
            </View>
          </View>
        </Animated.View>
      )
    }
    return (
      <Animated.View key={item.id} {...fade}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={item.title}
          accessibilityHint={item.description}
          {...pressedState(on)}
          aria-disabled={Boolean(item.disabled)}
          aria-busy={running === item.id}
          disabled={item.disabled}
          onPressIn={() => setActiveId(item.id)}
          onPress={() => { void run(item) }}
          style={[styles.row, Boolean(item.disabled) && styles.off]}
        >
          {on ? <Animated.View {...(still ? {} : { entering: WASH_IN, exiting: WASH_OUT })} style={styles.wash} /> : null}
          {item.icon ? <View style={styles.icon}>{item.icon}</View> : null}
          <View style={styles.text}>
            <Text numberOfLines={1} style={styles.title}>{item.title}</Text>
            {item.description && !compact ? <Text numberOfLines={1} style={styles.description}>{item.description}</Text> : null}
          </View>
          {running === item.id ? <Spinner size={16} label={null} animated={animated} /> : item.shortcut && !compact ? <Keycaps keys={item.shortcut} /> : null}
        </Pressable>
      </Animated.View>
    )
  }

  const footer = confirming ? 'Needs confirmation' : level ? level.title : query.trim() ? `${flat.length} of ${countItems(groups)}` : `${countItems(groups)} commands`

  return (
    <View style={[styles.command, style]}>
      <View style={styles.search}>
        <Mark name="search" size={18} color={colors.textSecondary} />
        {level ? (
          <Animated.View {...(still ? {} : { entering: CHIP_IN })}>
            <Pressable accessibilityRole="button" accessibilityLabel={`Back from ${level.title}`} onPress={pop} hitSlop={8} style={styles.chip}><Text style={styles.chipLabel}>{level.title}</Text></Pressable>
          </Animated.View>
        ) : null}
        <TextInput
          accessibilityLabel={placeholder}
          autoCapitalize="none"
          autoComplete="off"
          autoCorrect={false}
          autoFocus={Boolean(onClose)}
          submitBehavior="submit"
          placeholder={level ? `Pick ${level.title.toLowerCase()}` : placeholder}
          placeholderTextColor={colors.textTertiary}
          returnKeyType="go"
          style={styles.input}
          value={query}
          onChangeText={(text) => { setQuery(text); setActiveId(null) }}
          onKeyPress={(e) => { if (e.nativeEvent.key === 'Backspace' && !query && level) pop() }}
          onSubmitEditing={submit}
        />
        {onClose ? <Button variant="ghost" size="sm" animated={animated} style={styles.cancel} onPress={onClose}>Cancel</Button> : null}
      </View>
      <View style={styles.body}>
        <ScrollView keyboardShouldPersistTaps="handled" style={styles.scroll}>
          <Animated.View key={path.length} {...(still || !path.length ? {} : { entering: LIST_IN })} style={styles.list}>
            {flat.length ? shownGroups.map((group) => (
              <View key={group.label}>
                <Text style={styles.groupLabel}>{query.trim() ? `${group.items.length} result${group.items.length === 1 ? '' : 's'}` : group.label}</Text>
                {group.items.map(row)}
              </View>
            )) : (
              <View style={styles.empty}>
                <View style={styles.emptyIcon}><Mark name="search" size={18} color={colors.textSecondary} /></View>
                <Text style={styles.emptyTitle}>No commands for “{query.trim()}”</Text>
                <Text style={styles.emptyText}>{onAsk ? 'Try a project action, or ask the assistant instead.' : 'Try a different word.'}</Text>
                {onAsk ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={`Ask about ${query.trim()}`} onPress={() => onAsk(query.trim())} style={[styles.row, styles.ask]}>
                    <View style={styles.text}>
                      <Text style={styles.title}>Ask about “{query.trim()}”</Text>
                      <Text numberOfLines={1} style={styles.description}>Get an answer from the assistant</Text>
                    </View>
                  </Pressable>
                ) : null}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </View>
      <View style={styles.footer}>
        <Text style={styles.caption}>Tap a command to run it</Text>
        <Text accessibilityLiveRegion="polite" style={styles.caption}>{footer}</Text>
      </View>
    </View>
  )
}

const POSE: ModalMotion = { from: { opacity: 0, scale: 0.96 }, exit: { opacity: 0, scale: 0.98 }, open: { duration: 180, easing: EASE_OUT }, close: { duration: 120, easing: EASE_IN } }

export type CommandDialogProps = Omit<CommandProps, 'onClose'> & DisclosureProps & {
  /** Spoken name of the panel. */
  label?: string
}

/** The palette in a modal, with the field focused as it opens. */
export function CommandDialog({ open, defaultOpen, onOpenChange, trigger, label = 'Command menu', animated = true, style, ...rest }: CommandDialogProps) {
  const styles = useThemed(createStyles)
  const { open: shown, set, opener } = useDisclosure({ open, defaultOpen, onOpenChange, trigger })
  return (
    <>
      {opener}
      <Modal open={shown} onDismiss={() => set(false)} placement="top" label={label} pose={() => POSE} animated={animated} width={DIALOG_WIDTH}>
        <View style={[styles.dialog, style]}>
          <Command {...rest} animated={animated} onClose={() => set(false)} />
        </View>
      </Modal>
    </>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  command: { backgroundColor: c.muted, borderRadius: radius.sheet, maxWidth: '100%', padding: space[1] },
  dialog: { backgroundColor: c.surface, borderRadius: radius.sheet, marginTop: space[14] },
  search: { alignItems: 'center', flexDirection: 'row', gap: space[2], height: 52, paddingLeft: space[3.5], paddingRight: space[3] },
  input: { ...type(17, c.textPrimary), flex: 1, lineHeight: 22, minHeight: 44, minWidth: 0, padding: 0 },
  // Button hugs the top of a row by default; Cancel sits level with the field.
  cancel: { alignSelf: 'center' },
  chip: { backgroundColor: c.ink8, borderRadius: radius.full, paddingHorizontal: space[2], paddingVertical: space[0.5] },
  chipLabel: { ...type(12, c.textPrimary, '500'), lineHeight: 16 },
  body: { ...soft(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: 1, overflow: 'hidden' },
  scroll: { maxHeight: LIST_HEIGHT },
  list: { paddingBottom: space[1.5], paddingHorizontal: space[1.5], paddingTop: space[1] },
  groupLabel: { ...type(12, c.textSecondary), lineHeight: 16, paddingBottom: space[1], paddingHorizontal: space[3], paddingTop: space[2] },
  row: { alignItems: 'center', borderRadius: radius.control, flexDirection: 'row', gap: space[2.5], minHeight: 44, paddingLeft: space[3], paddingRight: space[2.5], paddingVertical: space[3] },
  off: { opacity: 0.4 },
  wash: { ...StyleSheet.absoluteFill, backgroundColor: c.ink4, borderRadius: radius.control },
  icon: { flexShrink: 0 },
  text: { alignItems: 'baseline', flex: 1, flexDirection: 'row', gap: space[2], minWidth: 0 },
  stacked: { flex: 1, gap: space[1] },
  title: { ...type(16, c.textPrimary), flexShrink: 0, lineHeight: 22 },
  description: { ...type(13, c.textTertiary), flexShrink: 1, lineHeight: 18 },
  confirm: { borderRadius: radius.control, flexDirection: 'row', gap: space[2.5], overflow: 'hidden', padding: space[3] },
  confirmWash: { ...StyleSheet.absoluteFill, backgroundColor: c.danger, opacity: 0.08 },
  confirmTitle: { ...type(14, c.textPrimary, '500'), lineHeight: 20 },
  confirmBody: { ...type(12, c.textSecondary), lineHeight: 16 },
  confirmActions: { flexDirection: 'row', gap: space[2], justifyContent: 'flex-end', marginTop: space[1] },
  empty: { alignItems: 'center', gap: space[1], paddingBottom: space[1], paddingHorizontal: space[1], paddingTop: space[5] },
  emptyIcon: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.full, height: 40, justifyContent: 'center', marginBottom: space[1], width: 40 },
  emptyTitle: { ...type(14, c.textPrimary, '500'), lineHeight: 20, textAlign: 'center' },
  emptyText: { ...type(12, c.textSecondary), lineHeight: 16, textAlign: 'center' },
  ask: { alignSelf: 'stretch', backgroundColor: c.ink4, marginTop: space[4] },
  footer: { alignItems: 'center', flexDirection: 'row', height: 40, justifyContent: 'space-between', paddingHorizontal: space[3] },
  caption: { ...type(12, c.textTertiary), lineHeight: 16 },
})
