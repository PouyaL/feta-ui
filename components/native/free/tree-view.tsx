import { useEffect, useMemo, useState } from 'react'
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { pressedState, radius, space, type Colors } from '../kit'
import { type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

const UNFOLD_MS = 240
const GUIDE = 16

export type TreeNode = { id: string; name: string; children?: TreeNode[]; /** A short git mark, like M. */ mark?: string }

export type TreeViewProps = {
  label: string
  nodes: TreeNode[]
  /** A small heading on the tray. */
  heading?: string
  defaultExpanded?: string[]
  defaultSelected?: string
  /** Long press renames. Fired on submit. */
  onRename?: (id: string, name: string) => void
  onSelect?: (id: string, path: string) => void
  /** Shows the plus in the heading. */
  onAdd?: () => void
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Flat = { node: TreeNode; level: number; path: string }

function walk(nodes: TreeNode[], open: string[], level: number, base: string, out: Flat[]): Flat[] {
  nodes.forEach((node) => {
    const path = base ? `${base}/${node.name}` : node.name
    out.push({ node, level, path })
    if (node.children && open.includes(node.id)) walk(node.children, open, level + 1, path, out)
  })
  return out
}
const countAll = (nodes: TreeNode[]): number => nodes.reduce((sum, node) => sum + 1 + countAll(node.children ?? []), 0)
const dot = (name: string): number => {
  const at = name.lastIndexOf('.')
  return at > 0 ? at : name.length
}

function Chevron({ open, still, renderIcon }: { open: boolean; still: boolean; renderIcon: RenderIcon }) {
  const turn = useSharedValue(open ? 90 : 0)
  useEffect(() => {
    turn.value = still ? (open ? 90 : 0) : withTiming(open ? 90 : 0, { duration: UNFOLD_MS })
  }, [open, still, turn])
  const motion = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  return <Animated.View style={motion}>{renderIcon('chevron-right', 14)}</Animated.View>
}

/** A file tree with guides. A tap opens and selects, a long press renames inline. */
export function TreeView({ label, nodes, heading, defaultExpanded, defaultSelected, onRename, onSelect, onAdd, renderIcon, animated = true, style }: TreeViewProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [open, setOpen] = useState(defaultExpanded ?? nodes.filter((node) => node.children).map((node) => node.id))
  const [selected, setSelected] = useState(defaultSelected)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const named = useMemo(() => {
    const apply = (list: TreeNode[]): TreeNode[] => list.map((node) => ({ ...node, name: names[node.id] ?? node.name, ...(node.children ? { children: apply(node.children) } : {}) }))
    return apply(nodes)
  }, [nodes, names])
  const flat = useMemo(() => walk(named, open, 0, '', []), [named, open])
  const selectedPath = flat.find((item) => item.node.id === selected)?.path
  const toggle = (id: string): void => setOpen((list) => (list.includes(id) ? list.filter((item) => item !== id) : [...list, id]))

  function choose(item: Flat): void {
    setSelected(item.node.id)
    onSelect?.(item.node.id, item.path)
    if (item.node.children) toggle(item.node.id)
  }

  function commit(id: string, value: string): void {
    const name = value.trim()
    if (name) {
      setNames((all) => ({ ...all, [id]: name }))
      onRename?.(id, name)
    }
    setRenaming(null)
  }

  return (
    <View style={[styles.tree, style]}>
      {heading ? (
        <View style={styles.headingRow}>
          <Text style={styles.heading}>{heading}</Text>
          {onAdd ? <IconButton variant="ghost" size="sm" label="New file" icon={renderIcon('plus', 16)} animated={animated} onPress={onAdd} /> : null}
        </View>
      ) : null}
      <View accessibilityLabel={label} style={styles.card}>
        {flat.map((item) => {
          const { node, level } = item
          const folder = Boolean(node.children)
          const on = selected === node.id
          return (
            <Pressable
              key={node.id}
              accessibilityRole="button"
              accessibilityLabel={node.name}
              {...pressedState(on)}
              {...(folder ? { 'aria-expanded': open.includes(node.id) } : {})}
              {...(onRename ? { accessibilityHint: 'Long press to rename', onLongPress: () => setRenaming(node.id) } : {})}
              onPress={() => choose(item)}
              style={[styles.item, on ? styles.itemOn : null]}
            >
              {Array.from({ length: level }, (_, i) => <View key={i} style={styles.guide} />)}
              <View style={styles.chevron}>{folder ? <Chevron open={open.includes(node.id)} still={still} renderIcon={renderIcon} /> : null}</View>
              {renderIcon(folder ? 'folder-open' : 'file-code', 16)}
              {renaming === node.id ? (
                <TextInput
                  autoFocus
                  accessibilityLabel={`Rename ${node.name}`}
                  defaultValue={node.name}
                  selection={{ start: 0, end: dot(node.name) }}
                  returnKeyType="done"
                  onSubmitEditing={(e) => commit(node.id, e.nativeEvent.text)}
                  onEndEditing={(e) => commit(node.id, e.nativeEvent.text)}
                  style={styles.rename}
                />
              ) : <Text style={styles.name} numberOfLines={1}>{node.name.slice(0, dot(node.name))}<Text style={styles.ext}>{node.name.slice(dot(node.name))}</Text></Text>}
              {node.mark ? <Text accessibilityLabel={`Git status ${node.mark}`} style={styles.mark}>{node.mark}</Text> : null}
            </Pressable>
          )
        })}
      </View>
      <Text style={styles.footer} numberOfLines={1}>{renaming ? 'Done to save' : selectedPath ?? `${countAll(nodes)} items`}</Text>
    </View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  tree: { width: '100%', padding: space[1], borderRadius: radius.tray, backgroundColor: c.ink4 },
  headingRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36, paddingHorizontal: space[3] },
  heading: type(12, c.textSecondary, '500'),
  card: { overflow: 'hidden', paddingVertical: space[1], borderRadius: radius.card, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  item: { flexDirection: 'row', alignItems: 'center', gap: space[1.5], minHeight: 44, paddingHorizontal: space[2] },
  itemOn: { backgroundColor: c.ink5 },
  guide: { alignSelf: 'stretch', width: GUIDE, marginRight: -space[1.5], borderLeftWidth: 1, borderLeftColor: c.ink8 },
  chevron: { alignItems: 'center', justifyContent: 'center', width: 14 },
  name: { ...type(14, c.textPrimary), flex: 1, minWidth: 0 },
  ext: { color: c.textTertiary },
  rename: { ...type(14, c.textPrimary), flex: 1, padding: 0 },
  mark: type(12, c.textTertiary, '400', true),
  footer: { ...type(12, c.textTertiary, '400', true), paddingVertical: space[2], paddingHorizontal: space[3] },
})
