import { useEffect, useMemo, useState, type ReactNode } from 'react'
import type { StyleProp, ViewStyle } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { useStill } from './card'
import { IconButton } from './icon-button'
import { EASE_OUT, Mark } from './popover'
import { Tree, TreeCard, type TreeNode } from './tree'

const TURN_MS = 160

export type FileNode = { name: string; /** Git status: `M` for modified, `U` for new. */ status?: 'M' | 'U'; children?: FileNode[] }

export type FileTreeProps = {
  files: FileNode[]
  title?: string
  /** Paths open at the start, like `app/dashboard`. */
  defaultExpanded?: string[]
  selected?: string
  defaultSelected?: string
  onSelect?: (path: string) => void
  /** Picks the icon for a file or a folder, so the app can draw it with its own fetaUI icons. */
  fileIcon?: (name: string, folder: boolean) => ReactNode
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const toNodes = (files: FileNode[], fileIcon: FileTreeProps['fileIcon'], parent = ''): TreeNode[] => files.map((file) => {
  const id = parent ? `${parent}/${file.name}` : file.name
  const icon = fileIcon?.(file.name, Boolean(file.children))
  return {
    id,
    label: file.name,
    ...(icon ? { icon } : {}),
    ...(file.status ? { mark: file.status } : {}),
    ...(file.children ? { children: toNodes(file.children, fileIcon, id) } : {}),
  }
})

const foldersOf = (nodes: TreeNode[]): string[] => nodes.flatMap((node) => (node.children ? [node.id, ...foldersOf(node.children)] : []))

/** A file explorer: folders with chevrons, files with type icons, git marks and a selected row. */
export function FileTree({ files, title = 'Explorer', defaultExpanded = [], selected, defaultSelected, onSelect, fileIcon, animated = true, style }: FileTreeProps) {
  const still = useStill(animated)
  const nodes = useMemo(() => toNodes(files, fileIcon), [files, fileIcon])
  const [open, setOpen] = useState(defaultExpanded)
  const folders = useMemo(() => foldersOf(nodes), [nodes])
  // Collapsed keeps the roots open, so the top level folders stay in view. With nothing deeper, it closes them.
  const rest = useMemo(() => {
    const roots = nodes.filter((node) => node.children).map((node) => node.id)
    return roots.length < folders.length ? roots : []
  }, [nodes, folders])
  const collapsed = open.every((id) => rest.includes(id))
  const turn = useSharedValue(collapsed ? 180 : 0)
  useEffect(() => { turn.value = withTiming(collapsed ? 180 : 0, { duration: still ? 0 : TURN_MS, easing: EASE_OUT }) }, [collapsed, still, turn])
  const turned = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value}deg` }] }))
  return (
    <TreeCard
      title={title}
      animated={animated}
      {...(style ? { style } : {})}
      actions={<IconButton variant="ghost" size="sm" animated={animated} label={collapsed ? 'Expand folders' : 'Collapse folders'} icon={<Animated.View style={turned}><Mark name="chevron-up" /></Animated.View>} onPress={() => setOpen(collapsed ? folders : rest)} />}
    >
      <Tree
        nodes={nodes}
        label={title}
        expanded={open}
        onExpandedChange={setOpen}
        animated={animated}
        {...(selected === undefined ? {} : { selected })}
        {...(defaultSelected === undefined ? {} : { defaultSelected })}
        {...(onSelect ? { onSelect } : {})}
      />
    </TreeCard>
  )
}
