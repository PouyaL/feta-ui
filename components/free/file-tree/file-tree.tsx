'use client'
import { useMemo, useState } from 'react'
import { ChevronUpIcon } from '@fetaui/react/rounded/chevron-up'
import { FileCodeIcon } from '@fetaui/react/rounded/file-code'
import { FileTextIcon } from '@fetaui/react/rounded/file-text'
import { PaletteIcon } from '@fetaui/react/rounded/palette'
import { IconButton } from '../icon-button/icon-button'
import { Tree, TreeCard, type TreeNode } from '../tree/tree'
import styles from './file-tree.module.css'

export type FileNode = { name: string; /** Git status: `M` for modified, `U` for new. */ status?: 'M' | 'U'; children?: FileNode[] }

export type FileTreeProps = {
  files: FileNode[]
  title?: string
  /** Paths open at the start, like `app/dashboard`. */
  defaultExpanded?: string[]
  selected?: string
  defaultSelected?: string
  onSelect?: (path: string) => void
  animated?: boolean
  className?: string
}

const typeIcon = (name: string) => {
  if (name.endsWith('.css')) return <PaletteIcon />
  if (/\.(json|md|txt)$/.test(name)) return <FileTextIcon />
  return <FileCodeIcon />
}

const toNodes = (files: FileNode[], parent = ''): TreeNode[] => files.map((file) => {
  const id = parent ? `${parent}/${file.name}` : file.name
  return {
    id,
    label: file.name,
    ...(file.status ? { mark: file.status } : {}),
    ...(file.children ? { children: toNodes(file.children, id) } : { icon: typeIcon(file.name) }),
  }
})

const foldersOf = (nodes: TreeNode[]): string[] => nodes.flatMap((node) => (node.children ? [node.id, ...foldersOf(node.children)] : []))

/** A file explorer: folders with chevrons, files with type icons, git marks and a selected row. */
export function FileTree({ files, title = 'Explorer', defaultExpanded = [], selected, defaultSelected, onSelect, animated = true, className }: FileTreeProps) {
  const nodes = useMemo(() => toNodes(files), [files])
  const [open, setOpen] = useState(defaultExpanded)
  const folders = useMemo(() => foldersOf(nodes), [nodes])
  // Collapsed keeps the roots open, so the top level folders stay in view. With nothing deeper, it closes them.
  const rest = useMemo(() => {
    const roots = nodes.filter((node) => node.children).map((node) => node.id)
    return roots.length < folders.length ? roots : []
  }, [nodes, folders])
  const collapsed = open.every((id) => rest.includes(id))
  return (
    <TreeCard
      title={title}
      animated={animated}
      className={[styles.card, className].filter(Boolean).join(' ')}
      actions={<IconButton variant="ghost" size="sm" animated={animated} label={collapsed ? 'Expand folders' : 'Collapse folders'} icon={<span className={collapsed ? styles.down : undefined}><ChevronUpIcon /></span>} onClick={() => setOpen(collapsed ? folders : rest)} />}
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
