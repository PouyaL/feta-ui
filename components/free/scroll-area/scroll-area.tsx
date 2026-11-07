'use client'
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode, type Ref, type UIEvent } from 'react'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './scroll-area.module.css'

const SLEEP_MS = 800
const MIN_THUMB = 32
const INSET = 2

export type ScrollbarProps = {
  /** The element that scrolls. */
  viewport: HTMLElement | null
  orientation?: 'vertical' | 'horizontal'
  animated?: boolean
  className?: string
}

/** The overlay bar: quiet until needed, wider under the pointer, inked while dragged. */
export function Scrollbar({ viewport, orientation = 'vertical', animated = true, className }: ScrollbarProps) {
  const still = useStill(animated)
  const vertical = orientation === 'vertical'
  const bar = useRef<HTMLDivElement>(null)
  const thumb = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLSpanElement>(null)
  const sleep = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hovered = useRef(false)
  const dragging = useRef(false)
  const [hidden, setHidden] = useState(true)

  const place = useCallback(() => {
    const node = viewport
    const track = bar.current
    const handle = thumb.current
    if (!node || !track || !handle) return
    const view = vertical ? node.clientHeight : node.clientWidth
    const total = vertical ? node.scrollHeight : node.scrollWidth
    const offset = vertical ? node.scrollTop : node.scrollLeft
    const room = (vertical ? track.clientHeight : track.clientWidth) - INSET * 2
    const fits = total <= view + 1
    track.toggleAttribute('data-fits', fits)
    if (fits) return
    const size = Math.max(MIN_THUMB, (view / total) * room)
    const progress = offset / (total - view)
    const at = progress * (room - size)
    handle.style[vertical ? 'height' : 'width'] = `${size}px`
    handle.style.transform = vertical ? `translateY(${at}px)` : `translateX(${at}px)`
    if (tip.current) tip.current.textContent = `${Math.round(progress * 100)}%`
  }, [viewport, vertical])

  const wake = useCallback(() => {
    setHidden(false)
    clearTimeout(sleep.current)
    sleep.current = setTimeout(() => { if (!hovered.current && !dragging.current) setHidden(true) }, SLEEP_MS)
  }, [])

  useEffect(() => {
    if (!viewport) return
    place()
    const onScroll = (): void => { place(); wake() }
    const observer = new ResizeObserver(place)
    observer.observe(viewport)
    for (const child of viewport.children) observer.observe(child)
    viewport.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      clearTimeout(sleep.current)
      observer.disconnect()
      viewport.removeEventListener('scroll', onScroll)
    }
  }, [viewport, place, wake])

  function grab(e: ReactPointerEvent<HTMLDivElement>): void {
    const node = viewport
    const handle = thumb.current
    const track = bar.current
    if (!node || !handle || !track) return
    e.preventDefault()
    handle.setPointerCapture(e.pointerId)
    dragging.current = true
    track.toggleAttribute('data-dragging', true)
    const start = vertical ? e.clientY : e.clientX
    const from = vertical ? node.scrollTop : node.scrollLeft
    const room = (vertical ? track.clientHeight : track.clientWidth) - INSET * 2 - (vertical ? handle.offsetHeight : handle.offsetWidth)
    const scale = ((vertical ? node.scrollHeight - node.clientHeight : node.scrollWidth - node.clientWidth) || 1) / (room || 1)
    const move = (event: PointerEvent): void => {
      const delta = ((vertical ? event.clientY : event.clientX) - start) * scale
      if (vertical) node.scrollTop = from + delta
      else node.scrollLeft = from + delta
    }
    const up = (): void => {
      dragging.current = false
      track.removeAttribute('data-dragging')
      handle.removeEventListener('pointermove', move)
      handle.removeEventListener('pointerup', up)
      handle.removeEventListener('pointercancel', up)
      wake()
    }
    handle.addEventListener('pointermove', move)
    handle.addEventListener('pointerup', up)
    handle.addEventListener('pointercancel', up)
  }

  return (
    <div
      ref={bar}
      aria-hidden="true"
      className={cx(styles.bar, className)}
      data-orientation={orientation}
      data-hidden={hidden && !still ? '' : undefined}
      data-still={still ? '' : undefined}
      onPointerEnter={(e) => { if (e.pointerType === 'mouse') { hovered.current = true; wake() } }}
      onPointerLeave={() => { hovered.current = false; wake() }}
    >
      <div ref={thumb} className={styles.thumb} onPointerDown={grab}>
        <span ref={tip} className={styles.tip} />
      </div>
    </div>
  )
}

export type ScrollAreaProps = {
  /** Names the region. Needed when it holds non interactive content, so the keyboard can scroll it. */
  label: string
  children: ReactNode
  orientation?: 'vertical' | 'horizontal' | 'both'
  /** Edge fades show there is more. Default on. */
  fades?: boolean
  /** Wraps the area in the Soft tray with this header. */
  shell?: { title: ReactNode; meta?: ReactNode; actions?: ReactNode }
  /** Height of the viewport, such as 320. */
  height?: number | string
  viewportRef?: Ref<HTMLDivElement>
  animated?: boolean
  className?: string
}

/** A region that scrolls inside a fixed frame. Native wheel, touch and keyboard stay intact. */
export function ScrollArea({ label, children, orientation = 'vertical', fades = true, shell, height, viewportRef, animated = true, className }: ScrollAreaProps) {
  const still = useStill(animated)
  const root = useRef<HTMLDivElement>(null)
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null)

  const syncFades = useCallback((node: HTMLElement) => {
    const frame = root.current
    if (!frame) return
    frame.toggleAttribute('data-top', node.scrollTop > 1)
    frame.toggleAttribute('data-bottom', node.scrollTop + node.clientHeight < node.scrollHeight - 1)
    frame.toggleAttribute('data-end', node.scrollLeft + node.clientWidth < node.scrollWidth - 1)
    frame.toggleAttribute('data-start', node.scrollLeft > 1)
  }, [])

  useEffect(() => {
    if (!viewport) return
    syncFades(viewport)
    const observer = new ResizeObserver(() => syncFades(viewport))
    observer.observe(viewport)
    for (const child of viewport.children) observer.observe(child)
    return () => observer.disconnect()
  }, [viewport, syncFades])

  const setRef = useCallback((node: HTMLDivElement | null) => {
    setViewport(node)
    if (typeof viewportRef === 'function') viewportRef(node)
    else if (viewportRef) viewportRef.current = node
  }, [viewportRef])

  const area = (
    <div ref={root} className={cx(styles.frame, shell ? undefined : className)} data-fades={fades ? '' : undefined} data-still={still ? '' : undefined} data-orientation={orientation}>
      <div
        ref={setRef}
        role="region"
        aria-label={label}
        tabIndex={0}
        className={styles.viewport}
        style={height === undefined ? undefined : { height }}
        data-orientation={orientation}
        onScroll={(e: UIEvent<HTMLDivElement>) => syncFades(e.currentTarget)}
      >
        {children}
      </div>
      {orientation !== 'vertical' ? <span aria-hidden="true" className={styles.fadeEnd} /> : null}
      {orientation !== 'horizontal' ? <><span aria-hidden="true" className={styles.fadeTop} /><span aria-hidden="true" className={styles.fadeBottom} /></> : null}
      {orientation !== 'horizontal' ? <Scrollbar viewport={viewport} orientation="vertical" animated={animated} /> : null}
      {orientation !== 'vertical' ? <Scrollbar viewport={viewport} orientation="horizontal" animated={animated} /> : null}
    </div>
  )

  if (!shell) return area
  return (
    <div className={cx(styles.tray, className)}>
      <div className={styles.shellHeader}>
        <span className={styles.shellTitle}>{shell.title}</span>
        {shell.meta ? <span className={styles.shellMeta}>{shell.meta}</span> : null}
        {shell.actions ? <span className={styles.shellActions}>{shell.actions}</span> : null}
      </div>
      <div className={styles.body}>{area}</div>
    </div>
  )
}
