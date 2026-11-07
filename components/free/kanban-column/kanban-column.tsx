'use client'
import { motion } from 'motion/react'
import { Children, useId, useState, type ReactNode } from 'react'
import { ArrowDownIcon } from '@fetaui/react/rounded/arrow-down'
import { InboxIcon } from '@fetaui/react/rounded/inbox'
import { MoreHorizontalIcon } from '@fetaui/react/rounded/more-horizontal'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { Button } from '../button/button'
import { DropdownMenu, type MenuEntry } from '../dropdown-menu/dropdown-menu'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { EASE_STANDARD, PANEL_S, kit, type TagTone } from '../product-kit/product-kit'
import styles from './kanban-column.module.css'

export type KanbanColumnProps = {
  title: string
  count: number
  tone?: TagTone
  /** Kanban Card rows. */
  children?: ReactNode
  /** Where the dashed slot opens among the children. Unset means no slot. */
  dropIndex?: number
  dropLabel?: string
  emptyTitle?: string
  emptyHint?: string
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  onAdd?: () => void
  /** Which Add buttons show: the header plus, the footer Add card, both or none. Default `both`. */
  addPlacement?: 'both' | 'header' | 'footer' | 'none'
  /** Rows added to the column's menu, after Collapse. `false` drops the menu. */
  menu?: MenuEntry[] | false
  /** Replaces the status dot before the title. `null` drops it. */
  icon?: ReactNode
  /** Rings the column, for a drag hovering over it. */
  over?: boolean
  /** Marks the cards as a list named by the title. Children should then be `role="listitem"`. */
  list?: boolean
  /** `false` skips the fade and rise, for a parent that runs its own entrance. Default `true`. */
  appear?: boolean
  animated?: boolean
  className?: string
} & { [data: `data-${string}`]: string | undefined }

/** A 4% ink tray with a status dot, title and mono count, holding cards. */
export function KanbanColumn({ title, count, tone = 'neutral', children, dropIndex, dropLabel = 'Drop to move here', emptyTitle = 'Nothing here', emptyHint = 'Drag a card here', collapsed, defaultCollapsed = false, onCollapsedChange, onAdd, addPlacement = 'both', menu = [], icon, over = false, list: asList = false, appear = true, animated = true, className, ...data }: KanbanColumnProps) {
  const still = useStill(animated)
  const uid = useId()
  const [heldClosed, setHeldClosed] = useState(defaultCollapsed)
  const closed = collapsed ?? heldClosed
  const cards = Children.toArray(children)
  const slot = <motion.div key="slot" className={styles.drop} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.12, ease: EASE_STANDARD }}>{dropLabel}</motion.div>
  const list = dropIndex === undefined ? cards : [...cards.slice(0, dropIndex), slot, ...cards.slice(dropIndex)]
  const empty = count === 0 && dropIndex === undefined
  const addInHeader = addPlacement === 'both' || addPlacement === 'header'
  const addInFooter = addPlacement === 'both' || addPlacement === 'footer'

  function setClosed(next: boolean): void {
    setHeldClosed(next)
    onCollapsedChange?.(next)
  }

  return (
    <motion.section {...data} aria-labelledby={uid} className={cx(styles.column, className)} data-tone={tone} data-closed={closed ? '' : undefined} data-over={over ? '' : undefined} initial={still || !appear ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: PANEL_S, ease: EASE_STANDARD }}>
      <header className={styles.header}>
        {icon === undefined ? <span className={styles.dot} aria-hidden="true" /> : icon}
        <h3 className={styles.title} id={uid}>{title}</h3>
        <span className={styles.count}>{count}<span className={kit.srOnly}> cards</span></span>
        {closed
          ? <IconButton variant="ghost" size="sm" animated={animated} label={`Expand ${title}`} aria-expanded={false} icon={<ArrowDownIcon size={16} />} onClick={() => setClosed(false)} />
          : addInHeader ? <IconButton variant="ghost" size="sm" animated={animated} label={`Add a card to ${title}`} icon={<PlusIcon size={16} />} {...(onAdd ? { onClick: onAdd } : {})} /> : null}
        {menu === false ? null : <DropdownMenu label={`${title} actions`} align="end" animated={animated} entries={[{ label: closed ? 'Expand' : 'Collapse', onSelect: () => setClosed(!closed) }, ...menu]} trigger={({ ref, ...props }) => <IconButton {...props} ref={ref} variant="ghost" size="sm" animated={animated} label={`${title} actions`} icon={<MoreHorizontalIcon size={16} />} />} />}
      </header>
      {closed ? null : (
        <>
          <div className={styles.cards} {...(asList && !empty ? { role: 'list', 'aria-labelledby': uid } : {})}>
            {empty ? (
              <div className={styles.empty}>
                <InboxIcon size={20} />
                <p className={styles.emptyTitle}>{emptyTitle}</p>
                <p className={styles.emptyHint}>{emptyHint}</p>
              </div>
            ) : list}
          </div>
          {addInFooter ? <div className={styles.add}><Button variant="ghost" shape="pill" size="sm" animated={animated} leadingIcon={<PlusIcon size={14} />} {...(onAdd ? { onClick: onAdd } : {})}>Add card</Button></div> : null}
        </>
      )}
    </motion.section>
  )
}
