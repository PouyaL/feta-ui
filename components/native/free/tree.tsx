import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown, FadeInUp, FadeOut, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { currentState, font, pressedState, radius, space, useColors, type Colors } from '../kit'
import { type, useStill, useThemed, type RenderIcon } from './card'
import { withInk } from './button'
import { Checkbox } from './checkbox'
import { Copy, Mark } from './popover'

const ROW_MS = 240
const ROW_Y = -4
const INDENT = 16
const ENTER_MS = 400
const ENTER_Y = 8
const STANDARD = Easing.bezierFn(0.25, 0.1, 0.25, 1)

const ROW_IN = FadeInUp.duration(ROW_MS).easing(STANDARD).withInitialValues({ transform: [{ translateY: ROW_Y }] })
const ROW_OUT = FadeOut.duration(ROW_MS / 2)
const CARD_IN = FadeInDown.duration(ENTER_MS).easing(STANDARD).withInitialValues({ transform: [{ translateY: ENTER_Y }] })

const AnimatedPressable = Animated.createAnimatedComponent(Pressable)

export type TreeNode = {
  id: string
  label: string
  icon?: ReactNode
  count?: number | string
  /** A short trailing mark, like a git status. */
  mark?: string
  disabled?: boolean
  children?: TreeNode[]
}

export type TreeItemProps = {
  label: string
  /** Default none: pass a folder or file icon by name through your icon set. */
  icon?: ReactNode
  count?: number | string | undefined
  mark?: string | undefined
  level?: number
  branch?: boolean
  expanded?: boolean
  selected?: boolean
  disabled?: boolean
  animated?: boolean
  /** Lines down the ancestors' indent. */
  guides?: boolean
  /** Replaces the icon, like a checkbox. */
  lead?: ReactNode
  /** For rows with a checkbox lead. */
  checked?: boolean | 'mixed'
  /** Draws the default icons, as the web does: an open folder on branches and a file on leaves. */
  renderIcon?: RenderIcon
  style?: StyleProp<ViewStyle>
  onPress?: () => void
}

/** One row: chevron, icon, label and an optional mono count, 16 in per level. */
export function TreeItem({ label, icon, count, mark, level = 0, branch = false, expanded = false, selected = false, disabled = false, animated = true, guides = false, lead, checked, renderIcon, style, onPress }: TreeItemProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const still = useStill(animated)
  const turn = useSharedValue(expanded ? 90 : 0)
  useEffect(() => { turn.value = withTiming(expanded ? 90 : 0, { duration: still ? 0 : ROW_MS, easing: STANDARD }) }, [expanded, still, turn])
  const turned = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  const indent = useAnimatedStyle(() => ({ paddingLeft: 8 + level * INDENT }), [level])
  return (
    <AnimatedPressable
      accessibilityRole={checked === undefined ? 'button' : 'checkbox'}
      accessibilityLabel={label}
      aria-valuetext={`Level ${level + 1}`}
      {...(checked === undefined ? pressedState(selected) : currentState(selected, 'true'))}
      aria-disabled={disabled}
      {...(branch ? { 'aria-expanded': expanded } : {})}
      {...(checked === undefined ? {} : { 'aria-checked': checked })}
      disabled={disabled}
      onPress={onPress}
      style={[styles.item, selected && styles.itemSelected, disabled && styles.off, indent, style]}
    >
      {guides ? Array.from({ length: level }, (_, i) => <Guide key={i} index={i} />) : null}
      {lead ?? null}
      <View style={styles.chevron}>
        {branch ? <Animated.View style={turned}><Mark name="chevron-right" size={14} color={colors.textSecondary} /></Animated.View> : null}
      </View>
      {lead ? null : withInk(icon ?? renderIcon?.(branch ? 'folder-open' : 'file', 20) ?? null, colors.textSecondary)}
      <Text numberOfLines={1} style={[styles.label, selected && styles.labelSelected]}>{label}</Text>
      {count === undefined ? null : <Text style={styles.count}>{count}</Text>}
      {mark ? <Text style={[styles.count, mark === 'U' && styles.markNew, mark === 'M' && styles.markChanged]}>{mark}</Text> : null}
    </AnimatedPressable>
  )
}

function Guide({ index }: { index: number }) {
  const styles = useThemed(createStyles)
  const left = useAnimatedStyle(() => ({ left: 15 + index * INDENT }), [index])
  return <Animated.View style={[styles.guide, left]} />
}

export type TreeProps = {
  nodes: TreeNode[]
  /** The tree's spoken name. */
  label: string
  /** `checkbox` adds a checkbox with parent states. `guides` draws 1 px indent lines. Default `files`. */
  kind?: 'files' | 'navigation' | 'checkbox' | 'guides'
  expanded?: string[]
  defaultExpanded?: string[]
  onExpandedChange?: (ids: string[]) => void
  selected?: string
  defaultSelected?: string
  onSelect?: (id: string) => void
  /** `checkbox`: ids of the checked leaves. */
  checked?: string[]
  defaultChecked?: string[]
  onCheckedChange?: (ids: string[]) => void
  /** Draws the default folder and file icons. */
  renderIcon?: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Row = { node: TreeNode; level: number }

const leavesOf = (node: TreeNode): string[] => (node.children?.length ? node.children.flatMap(leavesOf) : [node.id])

/** A hierarchy of rows. Branches open with a fade. */
export function Tree({ nodes, label, kind = 'files', expanded, defaultExpanded = [], onExpandedChange, selected, defaultSelected, onSelect, checked, defaultChecked = [], onCheckedChange, renderIcon, animated = true, style }: TreeProps) {
  const still = useStill(animated)
  const [heldOpen, setHeldOpen] = useState(defaultExpanded)
  const [heldSelected, setHeldSelected] = useState(defaultSelected)
  const [heldChecked, setHeldChecked] = useState(defaultChecked)
  const open = expanded ?? heldOpen
  const current = selected ?? heldSelected
  const ticks = checked ?? heldChecked

  const rows = useMemo(() => {
    const walk = (list: TreeNode[], level: number): Row[] => list.flatMap((node) => [
      { node, level },
      ...(node.children && open.includes(node.id) ? walk(node.children, level + 1) : []),
    ])
    return walk(nodes, 0)
  }, [nodes, open])

  function setOpen(next: string[]): void {
    setHeldOpen(next)
    onExpandedChange?.(next)
  }

  const toggle = (id: string): void => setOpen(open.includes(id) ? open.filter((item) => item !== id) : [...open, id])

  function choose(node: TreeNode): void {
    if (node.children) toggle(node.id)
    setHeldSelected(node.id)
    onSelect?.(node.id)
  }

  function tick(node: TreeNode): void {
    const leaves = leavesOf(node)
    const all = leaves.every((id) => ticks.includes(id))
    const next = all ? ticks.filter((id) => !leaves.includes(id)) : [...new Set([...ticks, ...leaves])]
    setHeldChecked(next)
    onCheckedChange?.(next)
  }

  const fade = still ? {} : { entering: ROW_IN, exiting: ROW_OUT }

  return (
    <View role="group" accessibilityLabel={label} style={style}>
      {rows.map(({ node, level }) => {
        const leaves = kind === 'checkbox' ? leavesOf(node) : []
        const on = leaves.filter((id) => ticks.includes(id)).length
        const state: boolean | 'mixed' = on === 0 ? false : on === leaves.length ? true : 'mixed'
        return (
          <Animated.View key={node.id} {...fade}>
            <TreeItem
              label={node.label}
              icon={node.icon}
              {...(renderIcon ? { renderIcon } : {})}
              count={node.count}
              mark={node.mark}
              level={level}
              branch={Boolean(node.children)}
              expanded={open.includes(node.id)}
              selected={kind === 'checkbox' ? false : current === node.id}
              disabled={node.disabled ?? false}
              animated={animated}
              guides={kind === 'guides'}
              {...(kind === 'checkbox' ? {
                checked: state,
                lead: <Checkbox accessibilityLabel={node.label} checked={state === true} indeterminate={state === 'mixed'} animated={animated} onCheckedChange={() => tick(node)} />,
              } : {})}
              onPress={() => (kind === 'checkbox' ? (node.children ? toggle(node.id) : tick(node)) : choose(node))}
            />
          </Animated.View>
        )
      })}
    </View>
  )
}

export type TreeCardProps = { title: ReactNode; caption?: ReactNode; actions?: ReactNode; children: ReactNode; animated?: boolean; style?: StyleProp<ViewStyle> }

/** The Soft card trees sit in: a 4% tray around an inset body that holds the title and the rows. */
export function TreeCard({ title, caption, actions, children, animated = true, style }: TreeCardProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  return (
    <Animated.View {...(still ? {} : { entering: CARD_IN })} style={[styles.card, style]}>
      <View style={styles.body}>
        <View style={styles.head}>
          <View style={styles.heading}>
            <Copy style={styles.title}>{title}</Copy>
            {caption ? <Copy style={styles.caption}>{caption}</Copy> : null}
          </View>
          {actions ? <View style={styles.actions}>{actions}</View> : null}
        </View>
        {children}
      </View>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  // Mobile card: 358 wide on the web at 390, so it fills the column here.
  card: { alignSelf: 'stretch', backgroundColor: c.ink4, borderRadius: radius.frame, padding: space[1] },
  head: { alignItems: 'center', flexDirection: 'row', gap: space[2], paddingBottom: space[2], paddingHorizontal: space[2], paddingTop: space[2.5] },
  heading: { flex: 1, minWidth: 0 },
  title: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
  caption: { ...type(12, c.textSecondary), lineHeight: 16 },
  actions: { flexDirection: 'row', gap: space[0.5], marginLeft: 'auto' },
  body: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.panel, borderWidth: 1, paddingBottom: space[2], paddingHorizontal: space[2], paddingTop: space[1.5] },
  item: { alignItems: 'center', borderRadius: radius.field, flexDirection: 'row', gap: space[1.5], minHeight: 44, paddingRight: space[2] },
  itemSelected: { backgroundColor: c.ink8 },
  off: { opacity: 0.4 },
  guide: { backgroundColor: c.ink10, bottom: 0, position: 'absolute', top: 0, width: 1 },
  chevron: { alignItems: 'center', height: 14, justifyContent: 'center', width: 14 },
  label: { ...type(16, c.textPrimary), flex: 1, lineHeight: 22, minWidth: 0 },
  labelSelected: { fontWeight: '500' },
  count: { color: c.textSecondary, fontFamily: font.mono, fontSize: 12, lineHeight: 16 },
  markNew: { color: c.success },
  markChanged: { color: c.warning },
})
