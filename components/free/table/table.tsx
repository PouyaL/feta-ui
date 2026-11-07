'use client'
import { motion } from 'motion/react'
import { createContext, useContext, useLayoutEffect, useRef, type ComponentProps, type ReactNode, type RefObject } from 'react'
import { ArrowUpIcon } from '@fetaui/react/rounded/arrow-up'
import { ChevronRightIcon } from '@fetaui/react/rounded/chevron-right'
import { duration, ease } from '../../motion-tokens'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './table.module.css'

/** Rows slide to their sorted place. Past `SORT_ROW_LIMIT` rows they jump, so big tables stay instant. */
export const SORT_MS = 240
export const SORT_ROW_LIMIT = 200

export type TableDensity = 'compact' | 'comfortable'
export type TableStyle = 'grid' | 'plain'
export type TableCellType = 'text' | 'title' | 'muted' | 'number' | 'amount' | 'mono' | 'avatar' | 'badge' | 'checkbox' | 'action' | 'tree'
export type SortDirection = 'asc' | 'desc'

type Shared = { density: TableDensity; styleKind: TableStyle; still: boolean }
const TableContext = createContext<Shared>({ density: 'comfortable', styleKind: 'plain', still: false })

export type TableProps = ComponentProps<'table'> & {
  /** `compact` is 13 px on 36 px rows for grids. `comfortable` is 14 px on 44 px rows for app tables. Default `comfortable`. */
  density?: TableDensity
  /** `grid` has 8% dividers and rules on a 4% header. `plain` has only 5% row rules. Default `plain`. */
  styleKind?: TableStyle
  /** Washes every other row. */
  striped?: boolean
  /** Shown to everyone on the tray when set; read as the table's name. */
  caption?: ReactNode
  /** Turns off the sideways scroll frame, so row menus can float past the table. */
  noScroll?: boolean
  animated?: boolean
}

/** The native table, scrolling sideways inside its own frame when the columns need more room. */
export function Table({ density = 'comfortable', styleKind = 'plain', striped, caption, noScroll, animated = true, className, children, ...rest }: TableProps) {
  const still = useStill(animated)
  return (
    <TableContext.Provider value={{ density, styleKind, still }}>
      <div className={styles.scroll} data-no-scroll={noScroll ? '' : undefined}>
        <table {...rest} className={cx(styles.table, className)} data-density={density} data-style={styleKind} data-striped={striped ? '' : undefined} data-still={still ? '' : undefined}>
          {caption ? <caption className={styles.caption}>{caption}</caption> : null}
          {children}
        </table>
      </div>
    </TableContext.Provider>
  )
}

/** The Soft shell: a 4% tray holding the table in a surface card. `footer` sits on the tray. */
export function TableCard({ title, meta, caption, children, className, ...rest }: Omit<ComponentProps<'div'>, 'children' | 'title'> & { title?: ReactNode; /** Mono note at the right of the title. */ meta?: ReactNode; /** Centred on the tray, under the card. */ caption?: ReactNode; children: ReactNode }) {
  return (
    <div {...rest} className={cx(styles.tray, className)}>
      {title || meta ? <div className={styles.trayHead}><span className={styles.trayTitle}>{title}</span>{meta ? <span className={styles.trayMeta}>{meta}</span> : null}</div> : null}
      <div className={styles.card}><div className={styles.frame}>{children}</div></div>
      {caption ? <p className={styles.trayCaption}>{caption}</p> : null}
    </div>
  )
}

export const TableHeader = (props: ComponentProps<'thead'>) => <thead {...props} />
export const TableBody = ({ ref, ...props }: ComponentProps<'tbody'>) => <tbody {...props} ref={ref} />
export const TableFooter = ({ className, ...props }: ComponentProps<'tfoot'>) => <tfoot {...props} className={cx(styles.footer, className)} />

export type TableRowProps = ComponentProps<'tr'> & {
  /** A stable id, used to slide the row when the order changes. */
  rowKey?: string
  selected?: boolean
}

export function TableRow({ rowKey, selected, className, ...rest }: TableRowProps) {
  return <tr {...rest} className={cx(styles.row, className)} data-row-key={rowKey} data-selected={selected ? '' : undefined} aria-selected={selected === undefined ? undefined : selected} />
}

export type TableHeadProps = Omit<ComponentProps<'th'>, 'scope'> & {
  /** `number`, `amount` and `mono` align right, like their cells. */
  type?: TableCellType
  /** Show a sort button. `false` when sortable but not the sorted column. */
  sort?: SortDirection | false
  onSort?: () => void
  width?: number | string
  /** Set `true` to hide the 8% divider in `grid`. */
  noDivider?: boolean
}

/** A column header. Sorting uses `aria-sort` and a real button, so it works from the keyboard. */
export function TableHead({ type = 'text', sort, onSort, width, noDivider, className, style, children, ...rest }: TableHeadProps) {
  const { still } = useContext(TableContext)
  const sortable = sort !== undefined
  const label = sortable
    ? (
      <button type="button" className={styles.sortButton} onClick={onSort}>
        <span>{children}</span>
        <motion.span
          className={styles.arrow}
          data-on={sort ? '' : undefined}
          initial={false}
          animate={{ rotate: sort === 'desc' ? 180 : 0 }}
          transition={still ? { duration: 0 } : { duration: duration.fast, ease: ease.out }}
        >
          <ArrowUpIcon size={14} aria-hidden="true" />
        </motion.span>
      </button>
    )
    : children
  return (
    <th
      {...rest}
      scope="col"
      className={cx(styles.cell, styles.head, className)}
      style={{ ...style, ...(width === undefined ? {} : { width }) }}
      data-type={type}
      data-sorted={sort ? '' : undefined}
      data-no-divider={noDivider ? '' : undefined}
      aria-sort={sort === 'asc' ? 'ascending' : sort === 'desc' ? 'descending' : undefined}
    >
      {label}
    </th>
  )
}

export type TableCellProps = Omit<ComponentProps<'td'>, 'children'> & {
  type?: TableCellType
  /** Second line, for `title` and `tree`. */
  sub?: ReactNode
  /** The picture, for `avatar`. */
  avatar?: ReactNode
  /** Grid: ink ring and fill handle. Plain: 4% wash. */
  selected?: boolean
  /** Lifts onto the surface with a 2 px ring. Put the input in `children`. */
  editing?: boolean
  /** Lifts onto the surface with an 8% ring and the soft elevation. */
  elevated?: boolean
  /** Part of the sorted column: 4% wash. */
  sorted?: boolean
  /** Hide the divider in `grid`. */
  noDivider?: boolean
  /** Hide the row rule. */
  noRule?: boolean
  /** Tree depth, 0 to 2. Each level draws a guide. */
  level?: number
  /** Tree chevron state. Leave it out on leaf rows. */
  expanded?: boolean
  onToggle?: () => void
  children?: ReactNode
}

/** The building block for every table: eleven types, set by `type`. */
export function TableCell({ type = 'text', sub, avatar, selected, editing, elevated, sorted, noDivider, noRule, level = 0, expanded, onToggle, className, children, ...rest }: TableCellProps) {
  const { still } = useContext(TableContext)
  const content = type === 'tree'
    ? (
      <span className={styles.tree}>
        {Array.from({ length: level }, (_, i) => <span key={i} className={styles.guide} aria-hidden="true" />)}
        {expanded === undefined
          ? <span className={styles.chevronSlot} aria-hidden="true" />
          : (
            <button type="button" className={styles.chevron} aria-expanded={expanded} aria-label={expanded ? 'Collapse' : 'Expand'} onClick={onToggle}>
              <motion.span className={styles.chevronIcon} initial={false} animate={{ rotate: expanded ? 90 : 0 }} transition={still ? { duration: 0 } : { duration: SORT_MS / 1000, ease: ease.out }}>
                <ChevronRightIcon size={14} aria-hidden="true" />
              </motion.span>
            </button>
          )}
        <span className={styles.treeName}><span className={styles.truncate}>{children}</span>{sub ? <span className={styles.sub}>{sub}</span> : null}</span>
      </span>
    )
    : type === 'avatar'
      ? <span className={styles.avatar}>{avatar}<span className={styles.truncate}>{children}</span></span>
      : sub
        ? <span className={styles.stack}><span className={styles.truncate}>{children}</span><span className={styles.sub}>{sub}</span></span>
        : children
  return (
    <td
      {...rest}
      className={cx(styles.cell, styles.body, className)}
      data-type={type}
      data-selected={selected ? '' : undefined}
      data-editing={editing ? '' : undefined}
      data-elevated={elevated ? '' : undefined}
      data-sorted={sorted ? '' : undefined}
      data-no-divider={noDivider ? '' : undefined}
      data-no-rule={noRule ? '' : undefined}
    >
      {content}
      {selected ? <span className={styles.handle} aria-hidden="true" /> : null}
    </td>
  )
}

/**
 * Slides rows to their new place when `order` changes: transform only, through the Web Animations API,
 * so nothing re-renders per frame. Off when `still` or past `SORT_ROW_LIMIT` rows.
 */
export function useRowReorder(body: RefObject<HTMLElement | null>, order: string, still: boolean, ms: number = SORT_MS): void {
  const tops = useRef(new Map<string, number>())
  useLayoutEffect(() => {
    const rows = Array.from(body.current?.querySelectorAll<HTMLElement>('[data-row-key]') ?? [])
    const next = new Map<string, number>()
    for (const row of rows) next.set(row.dataset.rowKey ?? '', row.offsetTop)
    if (!still && rows.length <= SORT_ROW_LIMIT) {
      for (const row of rows) {
        const before = tops.current.get(row.dataset.rowKey ?? '')
        const after = next.get(row.dataset.rowKey ?? '')
        if (before === undefined || after === undefined || before === after) continue
        row.animate([{ transform: `translateY(${before - after}px)` }, { transform: 'translateY(0)' }], { duration: ms, easing: `cubic-bezier(${ease.out.join(',')})` })
      }
    }
    tops.current = next
  }, [body, order, still, ms])
}
