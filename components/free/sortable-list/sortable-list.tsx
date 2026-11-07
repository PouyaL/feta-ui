'use client'
import { animate, motion, useMotionValue } from 'motion/react'
import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { GripVerticalIcon } from '@fetaui/react/rounded/grip-vertical'
import { useRowReorder } from '../table/table'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './sortable-list.module.css'

/** The Table Motion frame: neighbors slide 200 ms. */
const NEIGHBOR_MS = 200
const LIFT = { scale: 1.02, rotate: -2 }
const LIFT_SPRING = { type: 'spring', bounce: 0, visualDuration: 0.2 } as const
const DROP_SPRING = { type: 'spring', bounce: 0.2, visualDuration: 0.3 } as const

export type SortableItem = { id: string; title: ReactNode; subtitle?: ReactNode; /** Text for announcements, when `title` is not text. */ text?: string }

export type SortableListProps = {
  items: SortableItem[]
  onReorder?: (items: SortableItem[]) => void
  label: string
  animated?: boolean
  className?: string
}

const pad = (n: number): string => String(n).padStart(2, '0')
const move = <T,>(list: T[], from: number, to: number): T[] => {
  const next = [...list]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

/** Reorder by dragging the grip, or Space then arrows. The item lifts at −2° over a dashed slot. */
export function SortableList({ items: start, onReorder, label, animated = true, className }: SortableListProps) {
  const still = useStill(animated)
  const [items, setItems] = useState(start)
  const [lifted, setLifted] = useState<string | null>(null)
  const [said, setSaid] = useState('')
  const list = useRef<HTMLOListElement>(null)
  const y = useMotionValue(0)
  const drag = useRef({ startY: 0, startIndex: 0, index: 0, height: 0 })

  useRowReorder(list, items.map((item) => item.id).join(), still, NEIGHBOR_MS)
  const name = (item: SortableItem | undefined): string => item?.text ?? (typeof item?.title === 'string' ? item.title : 'Item')

  function commit(next: SortableItem[]): void {
    setItems(next)
    onReorder?.(next)
  }
  function onPointerDown(e: PointerEvent<HTMLButtonElement>, id: string): void {
    const box = e.currentTarget.closest('li')?.getBoundingClientRect()
    const index = items.findIndex((item) => item.id === id)
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { startY: e.clientY, startIndex: index, index, height: (box?.height ?? 64) + 4 }
    setLifted(id)
  }
  function onPointerMove(e: PointerEvent<HTMLButtonElement>): void {
    if (!lifted) return
    const { startY, startIndex, index, height } = drag.current
    const moved = e.clientY - startY
    const target = Math.max(0, Math.min(items.length - 1, startIndex + Math.round(moved / height)))
    y.set(moved - (target - startIndex) * height)
    if (target !== index) {
      drag.current.index = target
      setItems((list) => move(list, index, target))
    }
  }
  function drop(): void {
    if (!lifted) return
    setLifted(null)
    onReorder?.(items)
    setSaid(`${name(items[drag.current.index])} dropped at position ${drag.current.index + 1}.`)
    if (still) y.set(0)
    else animate(y, 0, DROP_SPRING)
  }
  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, id: string): void {
    const index = items.findIndex((item) => item.id === id)
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      setLifted(lifted ? null : id)
      setSaid(lifted ? `${name(items[index])} dropped at position ${index + 1}.` : `${name(items[index])} picked up. Use the arrow keys, then Space to drop.`)
    } else if (lifted === id && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault()
      const to = index + (e.key === 'ArrowUp' ? -1 : 1)
      if (to < 0 || to >= items.length) return
      commit(move(items, index, to))
      setSaid(`Moved to position ${to + 1} of ${items.length}.`)
    } else if (lifted === id && e.key === 'Escape') {
      setLifted(null)
      setSaid('Move finished.')
    }
  }

  return (
    <div className={cx(styles.list, className)} data-still={still ? '' : undefined}>
      <ol ref={list} className={styles.items} aria-label={label}>
        {items.map((item, index) => {
          const on = lifted === item.id
          return (
            <li key={item.id} {...(on ? {} : { 'data-row-key': item.id })} className={styles.slot} data-lifted={on ? '' : undefined}>
              <motion.div
                className={styles.item}
                data-lifted={on ? '' : undefined}
                style={on ? { y } : {}}
                initial={false}
                animate={on && !still ? LIFT : { scale: 1, rotate: 0 }}
                transition={still ? { duration: 0 } : on ? LIFT_SPRING : DROP_SPRING}
              >
                <button
                  type="button"
                  className={styles.grip}
                  aria-label={`Reorder ${name(item)}, position ${index + 1} of ${items.length}`}
                  aria-pressed={on}
                  onPointerDown={(e) => onPointerDown(e, item.id)}
                  onPointerMove={onPointerMove}
                  onPointerUp={drop}
                  onPointerCancel={drop}
                  onKeyDown={(e) => onKeyDown(e, item.id)}
                >
                  <GripVerticalIcon size={16} aria-hidden="true" />
                </button>
                <span className={styles.text}>
                  <span className={styles.title}>{item.title}</span>
                  {item.subtitle ? <span className={styles.subtitle}>{item.subtitle}</span> : null}
                </span>
                <span className={styles.order}>{pad(index + 1)}</span>
              </motion.div>
            </li>
          )
        })}
      </ol>
      <span className={styles.srOnly} aria-live="polite">{said}</span>
    </div>
  )
}
