'use client'
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ArrowLeftIcon } from '@fetaui/react/rounded/arrow-left'
import { ArrowRightIcon } from '@fetaui/react/rounded/arrow-right'
import { HeartIcon } from '@fetaui/react/rounded/heart'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './carousel.module.css'

const SETTLE_MS = 120

export type CarouselCard = {
  id: string
  scene: ReactNode
  /** Chip on the scene, like `2 nights`. */
  tag?: string
  title: string
  place: string
  meta?: string
  price?: string
}

export type CarouselProps = {
  label: string
  eyebrow?: ReactNode
  title?: ReactNode
  cards: CarouselCard[]
  /** Card ids saved at the start. */
  defaultSaved?: string[]
  onSavedChange?: (saved: string[]) => void
  defaultIndex?: number
  animated?: boolean
  className?: string
}

/** A rail of tall cards. The centred card grows to 106% and shows its details; the track never shifts layout. */
export function Carousel({ label, eyebrow, title, cards, defaultSaved = [], onSavedChange, defaultIndex = 0, animated = true, className }: CarouselProps) {
  const still = useStill(animated)
  const track = useRef<HTMLDivElement>(null)
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // The card a button or key asked for. Steps count from here until the scroll settles, so a fast double Next moves two cards.
  const target = useRef<number | null>(null)
  const [index, setIndex] = useState(defaultIndex)
  const [flicking, setFlicking] = useState(false)
  const [saved, setSaved] = useState(defaultSaved)

  // Scale is written straight to each card, so scrolling never re-renders.
  const paint = useCallback(() => {
    const node = track.current
    if (!node) return 0
    const middle = node.scrollLeft + node.clientWidth / 2
    let nearest = 0
    let best = Infinity
    Array.from(node.children).forEach((child, i) => {
      const card = child as HTMLElement
      const center = card.offsetLeft + card.offsetWidth / 2
      const distance = Math.abs(center - middle)
      if (distance < best) { best = distance; nearest = i }
      const near = Math.max(0, 1 - distance / card.offsetWidth)
      card.style.setProperty('--focus', still ? (distance < card.offsetWidth / 2 ? '1' : '0') : near.toFixed(3))
    })
    return nearest
  }, [still])

  const go = useCallback((to: number, instant = false) => {
    const node = track.current
    const card = node?.children[to] as HTMLElement | undefined
    if (!node || !card) return
    target.current = to
    setIndex(to)
    node.scrollTo({ left: card.offsetLeft + card.offsetWidth / 2 - node.clientWidth / 2, behavior: still || instant ? 'auto' : 'smooth' })
  }, [still])

  useEffect(() => {
    go(defaultIndex, true)
    paint()
    const node = track.current
    if (!node) return
    const observer = new ResizeObserver(() => paint())
    observer.observe(node)
    return () => { observer.disconnect(); clearTimeout(settle.current) }
  }, [go, paint, defaultIndex])

  function onScroll(): void {
    const nearest = paint()
    setFlicking(true)
    clearTimeout(settle.current)
    settle.current = setTimeout(() => { setFlicking(false); target.current = null; setIndex(nearest) }, SETTLE_MS)
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>): void {
    const by = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
    if (!by) return
    e.preventDefault()
    go(Math.min(cards.length - 1, Math.max(0, (target.current ?? index) + by)))
  }

  function toggleSave(id: string): void {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id]
    setSaved(next)
    onSavedChange?.(next)
  }

  const counter = `${String(index + 1).padStart(2, '0')} / ${String(cards.length).padStart(2, '0')}`
  return (
    <section className={cx(styles.tray, className)} aria-roledescription="carousel" aria-label={label} data-still={still ? '' : undefined} data-flicking={flicking ? '' : undefined}>
      <div className={styles.header}>
        <div className={styles.headText}>
          {eyebrow ? <span className={styles.eyebrow}>{eyebrow}</span> : null}
          {title ? <span className={styles.title}>{title}</span> : null}
        </div>
        <span className={styles.counter} aria-live="polite">{counter}</span>
        <span className={styles.arrows}>
          <IconButton variant="secondary" size="sm" icon={<ArrowLeftIcon />} label="Previous card" animated={animated} disabled={index === 0} onClick={() => go(Math.max(0, (target.current ?? index) - 1))} />
          <IconButton variant="secondary" size="sm" icon={<ArrowRightIcon />} label="Next card" animated={animated} disabled={index === cards.length - 1} onClick={() => go(Math.min(cards.length - 1, (target.current ?? index) + 1))} />
        </span>
      </div>
      <div ref={track} className={styles.track} tabIndex={0} role="group" aria-label={`${label} cards`} onScroll={onScroll} onKeyDown={onKeyDown}>
        {cards.map((card, i) => {
          const isSaved = saved.includes(card.id)
          return (
            <article key={card.id} className={styles.card} aria-roledescription="slide" aria-label={`${i + 1} of ${cards.length}: ${card.title}`} data-focused={i === index ? '' : undefined}>
              <div className={styles.scene}>
                {card.scene}
                {card.tag ? <span className={styles.tag}>{card.tag}</span> : null}
                <button type="button" className={styles.save} aria-pressed={isSaved} aria-label={`Save ${card.title}`} data-on={isSaved ? '' : undefined} onClick={() => toggleSave(card.id)}><HeartIcon /></button>
              </div>
              <div className={styles.details}>
                <p className={styles.cardTitle}>{card.title}</p>
                <p className={styles.place}>{card.place}</p>
                <p className={styles.meta}><span>{card.meta}</span><span>{card.price}</span></p>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
