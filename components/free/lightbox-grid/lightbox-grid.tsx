'use client'
import { AnimatePresence, animate, motion, type PanInfo } from 'motion/react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react'
import { ArrowLeftIcon } from '@fetaui/react/rounded/arrow-left'
import { ArrowRightIcon } from '@fetaui/react/rounded/arrow-right'
import { XIcon } from '@fetaui/react/rounded/x'
import { ZoomInIcon } from '@fetaui/react/rounded/zoom-in'
import { ZoomOutIcon } from '@fetaui/react/rounded/zoom-out'
import { duration, ease } from '../../motion-tokens'
import { Card } from '../card/card'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './lightbox-grid.module.css'

/** Open photo: 350 ms spring, bounce 0.25, tile to viewer. */
const ZOOM = { type: 'spring', duration: 0.35, bounce: 0.25 } as const
/** Dismiss photo: 300 ms in all, shrink first and then back to the tile. */
const DISMISS_STEP = 0.15
const DISMISS_SCALE = 0.9
/** Swipe down past this on touch screens to close. */
const SWIPE_CLOSE = 80

/** left, top, width, height on the 179 px tile of the design. */
type Shape = ['circle' | 'center' | 'oval' | 'bar' | 'reed' | 'block' | 'rect', number, number, number, number, ('deep' | 'paper' | undefined)?]

const WAVES: Shape[] = [[27, 111, 125], [36, 121, 107], [45, 132, 89], [54, 143, 71], [63, 154, 54]].map(([l = 0, t = 0, w = 0]) => ['bar', l, t, w, 3])
const ART: Shape[][] = [
  [['circle', 107, 32, 61, 61], ...WAVES],
  [['circle', 36, 29, 36, 36], ['oval', -36, 98, 250, 161], ['oval', 54, 129, 197, 125, 'deep']],
  [134, 107, 80, 54, 27].map((size, index): Shape => ['center', 0, (179 - size) / 2, size, size, index % 2 ? 'paper' : undefined]),
  [27, 71, 116].flatMap((top, row) => [27, 71, 116].map((left, column): Shape => ['block', left, top, 36, 36, (row + column) % 2 ? undefined : 'deep'])),
  [...[[36, 98, 54], [54, 71, 80], [71, 45, 107], [89, 98, 54], [107, 71, 80], [125, 45, 107], [143, 98, 54]].map(([l = 0, t = 0, h = 0]): Shape => ['reed', l, t, 3, h]), ['rect', 0, 152, 179, 27]],
  [['center', 0, 45, 89, 89, 'deep'], ['rect', 0, 89, 179, 89]],
]

const share = (value: number): string => `${(value / 1.79).toFixed(2)}%`

function shapeStyle([kind, left, top, width, height]: Shape): CSSProperties {
  const place = { top: share(top) }
  if (kind === 'circle' || kind === 'block') return { ...place, left: share(left), height: share(height) }
  if (kind === 'center') return { ...place, height: share(height) }
  if (kind === 'bar') return { ...place, left: share(left), width: share(width) }
  if (kind === 'reed') return { ...place, left: share(left), height: share(height) }
  return { ...place, left: share(left), width: share(width), height: share(height) }
}

/** One of the six stand-in photos. Paper and ink stay the same in both modes. */
export function LightboxArt({ art }: { art: number }) {
  return (
    <span className={styles.art} aria-hidden="true">
      {ART[art % ART.length]?.map((shape, index) => <i key={index} className={styles.shape} data-kind={shape[0]} data-tone={shape[5]} style={shapeStyle(shape)} />)}
    </span>
  )
}

export type LightboxPhoto = {
  /** The image. Leave it out to show the stand-in art. */
  src?: string
  /** Which stand-in art, from 0. */
  art?: number
  alt: string
  caption: string
  meta: string
}

export type LightboxState = 'grid' | 'open' | 'dismissing'

export type LightboxGridProps = {
  title?: string
  photos?: LightboxPhoto[]
  state?: LightboxState
  /** Default `grid`. */
  defaultState?: LightboxState
  onStateChange?: (state: LightboxState) => void
  /** The photo in the viewer. */
  index?: number
  defaultIndex?: number
  onIndexChange?: (index: number) => void
  animated?: boolean
  className?: string
}

const CAPTIONS: [string, string][] = [['Lake shore, early morning', 'Oct 12 · 06:42'], ['Moon over the ridge', 'Oct 12 · 05:58'], ['Trail marker', 'Oct 12 · 09:15'], ['Field station windows', 'Oct 12 · 11:30'], ['Reeds at the inlet', 'Oct 12 · 14:02'], ['Sun on the flats', 'Oct 12 · 18:47']]
const PHOTOS: LightboxPhoto[] = CAPTIONS.map(([caption, meta], art) => ({ art, alt: caption, caption, meta }))

const picture = (photo: LightboxPhoto | undefined) => (photo?.src ? <img className={styles.image} src={photo.src} alt={photo.alt} /> : <LightboxArt art={photo?.art ?? 0} />)
const FOCUSABLE = 'button:not(:disabled), a[href], input:not(:disabled)'

type Box = { left: number; top: number; width: number; height: number }

/** A photo grid that opens into a viewer. The photo zooms out of its tile and returns to it. */
export function LightboxGrid({ title = 'Field trip', photos = PHOTOS, state, defaultState = 'grid', onStateChange, index, defaultIndex = 0, onIndexChange, animated = true, className }: LightboxGridProps) {
  const still = useStill(animated)
  const [heldState, setHeldState] = useState(defaultState)
  const [heldIndex, setHeldIndex] = useState(defaultIndex)
  const [zoomed, setZoomed] = useState(false)
  const [touch, setTouch] = useState(false)
  const view = state ?? heldState
  const current = index ?? heldIndex
  const photo = photos[current]

  const root = useRef<HTMLDivElement>(null)
  const frame = useRef<HTMLDivElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const tiles = useRef<(HTMLButtonElement | null)[]>([])
  /** Where the photo came from, relative to the card. */
  const origin = useRef<Box | null>(null)
  const returnTo = useRef<number | null>(null)

  useEffect(() => setTouch(window.matchMedia('(pointer: coarse)').matches), [])

  function setView(next: LightboxState): void {
    setHeldState(next)
    onStateChange?.(next)
  }

  function go(next: number): void {
    const wrapped = (next + photos.length) % photos.length
    setHeldIndex(wrapped)
    setZoomed(false)
    onIndexChange?.(wrapped)
  }

  function offsetTo(box: Box): { x: number; y: number; scaleX: number; scaleY: number } | null {
    const node = frame.current
    const base = root.current?.getBoundingClientRect()
    if (!node || !base) return null
    const rect = node.getBoundingClientRect()
    return {
      x: box.left + base.left + box.width / 2 - (rect.left + rect.width / 2),
      y: box.top + base.top + box.height / 2 - (rect.top + rect.height / 2),
      scaleX: box.width / rect.width,
      scaleY: box.height / rect.height,
    }
  }

  function open(at: number): void {
    const base = root.current?.getBoundingClientRect()
    const rect = tiles.current[at]?.getBoundingClientRect()
    origin.current = base && rect ? { left: rect.left - base.left, top: rect.top - base.top, width: rect.width, height: rect.height } : null
    returnTo.current = at
    setHeldIndex(at)
    onIndexChange?.(at)
    setZoomed(false)
    setView('open')
  }

  // The frame takes the tile's box, then springs to its own. Transforms only.
  useLayoutEffect(() => {
    const node = frame.current
    if (view !== 'open' || !node) return
    // Only when a tile opened it, so a viewer shown from the start never takes the page's focus.
    if (returnTo.current !== null) close.current?.focus({ preventScroll: true })
    const box = origin.current
    const from = box && !still ? offsetTo(box) : null
    if (!from) return
    const run = animate(node, { x: [from.x, 0], y: [from.y, 0], scaleX: [from.scaleX, 1], scaleY: [from.scaleY, 1] }, ZOOM)
    return () => run.stop()
    // `offsetTo` reads refs only.
  }, [view, still])

  useEffect(() => {
    if (view === 'grid' && returnTo.current !== null) {
      tiles.current[returnTo.current]?.focus({ preventScroll: true })
      returnTo.current = null
    }
  }, [view])

  async function dismiss(): Promise<void> {
    if (view !== 'open') return
    setZoomed(false)
    const node = frame.current
    const box = origin.current
    if (still || !node) { setView('grid'); return }
    setView('dismissing')
    await animate(node, { scaleX: DISMISS_SCALE, scaleY: DISMISS_SCALE }, { duration: DISMISS_STEP, ease: ease.out })
    const to = box ? offsetTo(box) : null
    if (to) await animate(node, to, { duration: DISMISS_STEP, ease: ease.out })
    setView('grid')
    // A parent that holds `state` may keep the viewer open.
    node.style.removeProperty('transform')
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'Escape') { event.preventDefault(); void dismiss() }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); go(current - 1) }
    else if (event.key === 'ArrowRight') { event.preventDefault(); go(current + 1) }
    else if (event.key === 'Tab') {
      const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE))
      // Moved by hand: Safari skips buttons on Tab by default, which would walk out past the last one.
      event.preventDefault()
      const step = event.shiftKey ? -1 : 1
      const index = focusable.indexOf(document.activeElement as HTMLElement)
      focusable[(index + step + focusable.length) % focusable.length]?.focus()
    }
  }

  function onDragEnd(_: unknown, info: PanInfo): void {
    if (info.offset.y > SWIPE_CLOSE) void dismiss()
  }

  const fade = still ? {} : { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: duration.fast } }
  const held = view === 'dismissing'

  return (
    <Card aria-label={title} className={cx(styles.lightbox, className)} bodyClassName={styles.body} animated={animated} data-still={still ? '' : undefined}>
      <div ref={root} className={styles.root} data-state={view}>
        {view === 'grid' ? (
          <motion.div className={styles.stack} {...fade}>
            <div className={styles.header}>
              <h3 className={styles.title}>{title}</h3>
              <span className={styles.meta}>{photos.length} photos</span>
            </div>
            <ul className={styles.grid}>
              {photos.map((item, at) => (
                <li key={item.caption}>
                  <button ref={(node) => { tiles.current[at] = node }} type="button" className={styles.tile} aria-label={`Open ${item.alt}`} onClick={() => open(at)}>{picture(item)}</button>
                </li>
              ))}
            </ul>
          </motion.div>
        ) : (
          <div className={styles.viewer} role="dialog" aria-modal="true" aria-label={`${title}: photo ${current + 1} of ${photos.length}`} onKeyDown={onKeyDown}>
            <motion.div className={styles.toolbar} {...fade}>
              <span className={styles.counter}>{current + 1} / {photos.length}</span>
              <div className={styles.actions}>
                <IconButton size="sm" variant="ghost" icon={zoomed ? <ZoomOutIcon /> : <ZoomInIcon />} label={zoomed ? 'Zoom out' : 'Zoom in'} aria-pressed={zoomed} animated={animated} onClick={() => setZoomed(!zoomed)} />
                <IconButton ref={close} size="sm" variant="ghost" icon={<XIcon />} label="Close" animated={animated} onClick={() => void dismiss()} />
              </div>
            </motion.div>
            <motion.div className={styles.stage} drag={touch && !still && !zoomed && !held ? 'y' : false} dragConstraints={{ top: 0, bottom: 0 }} dragElastic={0.6} dragSnapToOrigin onDragEnd={onDragEnd}>
              <motion.div ref={frame} className={styles.frame} data-held={held && state === 'dismissing' ? '' : undefined}>
                <div className={styles.zoom} data-zoomed={zoomed ? '' : undefined}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div key={current} className={styles.photo} initial={still ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={still ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0 }} transition={{ duration: duration.fast }}>{picture(photo)}</motion.div>
                  </AnimatePresence>
                </div>
              </motion.div>
              <IconButton className={styles.previous} size="sm" variant="secondary" icon={<ArrowLeftIcon />} label="Previous photo" animated={animated} onClick={() => go(current - 1)} />
              <IconButton className={styles.next} size="sm" variant="secondary" icon={<ArrowRightIcon />} label="Next photo" animated={animated} onClick={() => go(current + 1)} />
            </motion.div>
            <motion.div className={styles.caption} aria-live="polite" {...fade}>
              <span className={styles.captionText}>{photo?.caption}</span>
              <span className={styles.meta}>{photo?.meta}</span>
            </motion.div>
            <motion.ul className={styles.thumbs} {...fade}>
              {photos.map((item, at) => (
                <li key={item.caption}>
                  <button type="button" className={styles.thumb} aria-label={item.alt} aria-current={at === current ? 'true' : undefined} onClick={() => go(at)}>{picture(item)}</button>
                </li>
              ))}
            </motion.ul>
          </div>
        )}
      </div>
    </Card>
  )
}
