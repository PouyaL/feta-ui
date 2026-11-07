'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from 'react'
import { Tick02Icon } from '@fetaui/react/rounded/tick-02'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './focal-point-picker.module.css'

const KEY_STEP = 1
const SAVED_HOLD_MS = 1800
const CROPS = [{ name: 'Avatar', ratio: '1:1', value: 1 }, { name: 'Banner', ratio: '16:9', value: 16 / 9 }, { name: 'Story', ratio: '9:16', value: 9 / 16 }]

export type FocalPoint = { x: number; y: number }

export type FocalPointPickerProps = {
  src: string
  alt: string
  /** Percent, 0 to 100. */
  defaultPoint?: FocalPoint
  onChange?: (point: FocalPoint) => void
  /** Fires when a drag ends. Shows the saved chip. */
  onSave?: (point: FocalPoint) => void
  animated?: boolean
  className?: string
}

const clamp = (value: number): number => Math.min(100, Math.max(0, value))

/** Sets the point every crop keeps. Each crop centres on it as far as its edges allow. */
export function FocalPointPicker({ src, alt, defaultPoint = { x: 68, y: 38 }, onChange, onSave, animated = true, className }: FocalPointPickerProps) {
  const still = useStill(animated)
  const photo = useRef<HTMLDivElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [point, setPoint] = useState(defaultPoint)
  const [dragging, setDragging] = useState(false)
  const [saved, setSaved] = useState(false)
  const [hover, setHover] = useState<number | null>(null)
  const [box, setBox] = useState({ width: 1, height: 1 })

  useEffect(() => {
    const node = photo.current
    if (!node) return
    const observer = new ResizeObserver(() => setBox({ width: node.clientWidth, height: node.clientHeight }))
    observer.observe(node)
    return () => { observer.disconnect(); clearTimeout(timer.current) }
  }, [])

  function place(clientX: number, clientY: number): FocalPoint | null {
    const rect = photo.current?.getBoundingClientRect()
    if (!rect) return null
    const next = { x: Math.round(clamp(((clientX - rect.left) / rect.width) * 100)), y: Math.round(clamp(((clientY - rect.top) / rect.height) * 100)) }
    setPoint(next)
    onChange?.(next)
    return next
  }

  function save(next: FocalPoint): void {
    setSaved(true)
    onSave?.(next)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setSaved(false), SAVED_HOLD_MS)
  }

  function onPointerDown(e: PointerEvent<HTMLDivElement>): void {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging(true)
    setSaved(false)
    place(e.clientX, e.clientY)
  }

  function onPointerUp(e: PointerEvent<HTMLDivElement>): void {
    if (!dragging) return
    setDragging(false)
    const next = place(e.clientX, e.clientY)
    if (next) save(next)
  }

  function onKeyDown(e: KeyboardEvent<HTMLSpanElement>): void {
    const delta = { ArrowLeft: [-KEY_STEP, 0], ArrowRight: [KEY_STEP, 0], ArrowUp: [0, -KEY_STEP], ArrowDown: [0, KEY_STEP] }[e.key]
    if (!delta) return
    e.preventDefault()
    const next = { x: clamp(point.x + (delta[0] ?? 0)), y: clamp(point.y + (delta[1] ?? 0)) }
    setPoint(next)
    onChange?.(next)
    save(next)
  }

  // The hovered crop as a window on the photo, kept inside its edges.
  const crop = hover === null ? null : (() => {
    const ratio = CROPS[hover]?.value ?? 1
    const photoRatio = box.width / box.height
    const width = ratio < photoRatio ? (ratio / photoRatio) * 100 : 100
    const height = ratio < photoRatio ? 100 : (photoRatio / ratio) * 100
    return { left: Math.min(100 - width, Math.max(0, point.x - width / 2)), top: Math.min(100 - height, Math.max(0, point.y - height / 2)), width, height }
  })()

  return (
    <div className={cx(styles.tray, className)} data-still={still ? '' : undefined} data-dragging={dragging ? '' : undefined}>
      <div className={styles.body}>
        <div ref={photo} className={styles.photo} onPointerDown={onPointerDown} onPointerMove={(e) => { if (dragging) place(e.clientX, e.clientY) }} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
          <img src={src} alt={alt} className={styles.image} draggable={false} />
          {crop ? <span aria-hidden="true" className={styles.window} style={{ left: `${crop.left}%`, top: `${crop.top}%`, width: `${crop.width}%`, height: `${crop.height}%` }} /> : null}
          <span aria-hidden="true" className={styles.hairX} style={{ '--y': point.y } as CSSProperties} />
          <span aria-hidden="true" className={styles.hairY} style={{ '--x': point.x } as CSSProperties} />
          <span className={styles.rail} style={{ '--x': point.x, '--y': point.y } as CSSProperties}>
            <span role="slider" tabIndex={0} aria-label="Focal point" aria-valuemin={0} aria-valuemax={100} aria-valuenow={point.x} aria-valuetext={`${point.x}% across, ${point.y}% down`} className={styles.cross} onKeyDown={onKeyDown}>
              {dragging ? <span className={styles.chip}>{point.x}%  {point.y}%</span> : null}
            </span>
          </span>
          <AnimatePresence>
            {saved ? <motion.span role="status" className={styles.saved} initial={still ? false : { opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: still ? 0 : 0.15 }}><Tick02Icon />Focal point saved</motion.span> : null}
          </AnimatePresence>
        </div>
        <div className={styles.crops}>
          {CROPS.map((option, i) => (
            <div key={option.name} className={styles.crop} style={{ flexGrow: option.value }} data-hover={hover === i ? '' : undefined} onPointerEnter={(e) => { if (e.pointerType === 'mouse') setHover(i) }} onPointerLeave={() => setHover(null)}>
              <span className={styles.cropFrame} style={{ aspectRatio: option.value }}><img src={src} alt="" className={styles.cropImage} draggable={false} style={{ objectPosition: `${point.x}% ${point.y}%` }} /></span>
              <span className={styles.cropLabel}><span className={styles.cropName}>{option.name}</span> <span className={styles.cropRatio}>{option.ratio}</span></span>
            </div>
          ))}
        </div>
      </div>
      <p className={styles.footer}><span>{saved ? 'Every crop keeps this point' : 'Drag the point, or hover a crop'}</span><span className={styles.mono}>{point.x}%  {point.y}%</span></p>
    </div>
  )
}
