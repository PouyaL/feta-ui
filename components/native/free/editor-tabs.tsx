import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeIn, FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated'
import { font, radius, space, useColors, type Colors, hscroll } from '../kit'
import { useStill, useThemed } from './card'
import { DropdownMenu } from './dropdown-menu'
import { Mark, soft, Tap, useCompact } from './popover'

const ENTER_MS = 400
const ROW_MS = 240
const ROW_STAGGER_MS = 40
const ENTER_Y = 8
const STANDARD = Easing.bezierFn(0.25, 0.1, 0.25, 1)
const SLIDE = { stiffness: 420, damping: 34 }
/** Tabs kept on phones before the rest fold into a count. */
const COMPACT_TABS = 2
const CLOSE_REACH = 8

const PANEL_IN = FadeInDown.duration(ENTER_MS).easing(STANDARD).withInitialValues({ transform: [{ translateY: ENTER_Y }] })

export type EditorFile = { name: string; code: string; /** Shows the warning dot. */ modified?: boolean; icon?: ReactNode }

export type EditorTabsProps = {
  files: EditorFile[]
  value?: string
  defaultValue?: string
  onValueChange?: (name: string) => void
  /** Without it the close mark is hidden. */
  onClose?: (name: string) => void
  label?: string
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Tab({ file, on, closable, animated, onChoose, onClose, onLayout }: { file: EditorFile; on: boolean; closable: boolean; animated: boolean; onChoose: () => void; onClose: () => void; onLayout: (e: LayoutChangeEvent) => void }) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  return (
    <View onLayout={onLayout} style={styles.tabWrap}>
      <Pressable accessibilityRole="tab" accessibilityLabel={file.modified ? `${file.name}, unsaved changes` : file.name} aria-selected={on} onPress={onChoose} style={styles.tab}>
        {file.icon ?? null}
        <Text numberOfLines={1} style={[styles.name, on && styles.nameOn]}>{file.name}</Text>
        {file.modified ? <View style={styles.dot} /> : null}
      </Pressable>
      {closable && on ? (
        <Tap accessibilityLabel={`Close ${file.name}`} animated={animated} hitSlop={CLOSE_REACH} onPress={onClose} style={styles.close}>
          <Mark name="x" size={14} color={colors.textSecondary} />
        </Tap>
      ) : null}
    </View>
  )
}

/** File tabs for editors. The active tab sits on the surface, and unsaved files carry a warning dot. */
export function EditorTabs({ files, value, defaultValue, onValueChange, onClose, label = 'Open files', animated = true, style }: EditorTabsProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const compact = useCompact()
  const [held, setHeld] = useState(defaultValue ?? files[0]?.name)
  const current = value ?? held
  const file = files.find((item) => item.name === current) ?? files[0]
  const boxes = useRef<Record<string, { x: number; width: number }>>({})
  const placed = useRef(false)
  const plateX = useSharedValue(0)
  const plateWidth = useSharedValue(0)

  function choose(name: string): void {
    setHeld(name)
    onValueChange?.(name)
  }

  function place(name: string | undefined): void {
    const box = name === undefined ? undefined : boxes.current[name]
    if (!box) return
    const glides = !still && placed.current
    plateX.value = glides ? withSpring(box.x, SLIDE) : box.x
    plateWidth.value = glides ? withSpring(box.width, SLIDE) : box.width
    placed.current = true
  }

  // The plate rides to the chosen tab, whose width may grow by a close mark a moment later.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => place(file?.name), [file?.name])

  const measure = (name: string) => (e: LayoutChangeEvent): void => {
    const { x, width } = e.nativeEvent.layout
    boxes.current[name] = { x, width }
    if (name === file?.name) place(name)
  }

  const plate = useAnimatedStyle(() => ({ width: plateWidth.value, transform: [{ translateX: plateX.value }] }))
  const shown = compact ? files.slice(0, COMPACT_TABS) : files
  const folded = compact ? files.slice(COMPACT_TABS) : []
  const lines = file?.code.split('\n') ?? []
  const onScreen = shown.some((item) => item.name === file?.name)

  return (
    <Animated.View {...(still ? {} : { entering: PANEL_IN })} style={[styles.editor, style]}>
      <View style={styles.bar}>
        <View accessibilityRole="tablist" accessibilityLabel={label} style={styles.tabs}>
          <ScrollView style={hscroll} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
            {onScreen ? <Animated.View pointerEvents="none" style={[styles.plate, plate]} /> : null}
            {shown.map((item) => <Tab key={item.name} file={item} on={item.name === file?.name} closable={Boolean(onClose)} animated={animated} onChoose={() => choose(item.name)} onClose={() => onClose?.(item.name)} onLayout={measure(item.name)} />)}
          </ScrollView>
        </View>
        {folded.length ? (
          <DropdownMenu
            align="end"
            label={`${folded.length} more files`}
            animated={animated}
            entries={folded.map((item) => ({ label: item.name, onSelect: () => choose(item.name) }))}
            trigger={(props) => <Tap {...props} accessibilityLabel={`${folded.length} more files`} animated={animated} style={styles.more}><Text style={styles.name}>+{folded.length}</Text></Tap>}
          />
        ) : null}
      </View>
      <View style={styles.body}>
        <ScrollView style={hscroll} horizontal showsHorizontalScrollIndicator={false}>
          <View key={file?.name}>
            {lines.map((line, i) => (
              <Animated.View key={i} {...(still ? {} : { entering: FadeIn.duration(ROW_MS).delay(i * ROW_STAGGER_MS).easing(STANDARD) })} style={styles.line}>
                <Text accessibilityElementsHidden importantForAccessibility="no" style={styles.lineNumber}>{i + 1}</Text>
                <Text selectable style={styles.code}>{line || ' '}</Text>
              </Animated.View>
            ))}
          </View>
        </ScrollView>
      </View>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  editor: { backgroundColor: c.ink4, borderRadius: space[6], maxWidth: '100%', padding: space[1], width: 358 },
  bar: { alignItems: 'center', flexDirection: 'row', gap: space[1], minHeight: 44, padding: space[1] },
  tabs: { flex: 1, minWidth: 0 },
  track: { flexDirection: 'row', gap: space[0.5] },
  plate: { ...soft(c), backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.control, borderWidth: 1, bottom: 0, left: 0, position: 'absolute', top: 0 },
  tabWrap: { alignItems: 'center', borderRadius: radius.control, flexDirection: 'row' },
  tab: { alignItems: 'center', flexDirection: 'row', gap: space[1.5], height: 44, paddingHorizontal: space[2.5] },
  name: { color: c.textSecondary, fontFamily: font.mono, fontSize: 12, lineHeight: 16 },
  nameOn: { color: c.textPrimary },
  // kit.ts has no warning color yet, so the unsaved dot borrows danger.
  dot: { backgroundColor: c.danger, borderRadius: radius.full, height: 6, width: 6 },
  close: { alignItems: 'center', borderRadius: radius.lg, height: 28, justifyContent: 'center', marginLeft: -space[1], marginRight: space[1.5], width: 28 },
  more: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.control, height: 44, justifyContent: 'center', paddingHorizontal: space[2.5] },
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: space[5], borderWidth: 1, padding: space[4] },
  line: { flexDirection: 'row', gap: space[4] },
  lineNumber: { color: c.textTertiary, fontFamily: font.mono, fontSize: 12, lineHeight: 20, textAlign: 'right', width: 16 },
  code: { color: c.textPrimary, fontFamily: font.mono, fontSize: 12, lineHeight: 20 },
})
