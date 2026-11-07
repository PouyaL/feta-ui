'use client'
import { motion, type HTMLMotionProps } from 'motion/react'
import { useEffect, useRef, useState, type CSSProperties, type PointerEvent, type ReactNode, type Ref } from 'react'
import { cx, kit, useStill } from '../motion-kit/motion-kit'
import styles from './gradient-button.module.css'

export type GradientButtonProps = Omit<HTMLMotionProps<'button'>, 'children' | 'ref' | 'color'> & {
  color?: 'emerald' | 'violet' | 'orange'
  icon?: ReactNode
  children?: ReactNode
  /** `false` turns off the pull, light, ring, sheen and press burst. */
  animated?: boolean
  ref?: Ref<HTMLButtonElement>
}

/** How far the button drifts toward the pointer, in px. A 2D pull keeps the label crisp, where a 3D tilt would blur it. */
const PULL_PX = 3
/** A press leaves a ripple and a few sparks for this long. */
const BURST_MS = 650
const SPARKS = 6

type Burst = { id: number; x: number; y: number }

/**
 * An accent button that keeps its color in Light and Dark. Under the pointer it drifts toward it, a soft light follows
 * the cursor and a ring of its own colors turns around the edge; entering sweeps a sheen. A press sinks it in and
 * sends a ripple and a few sparks out from where it was pressed.
 */
export function GradientButton({ color = 'emerald', icon, children, animated = true, className, disabled, type = 'button', ref, style, onPointerMove, onPointerLeave, onPointerDown, ...rest }: GradientButtonProps) {
  const still = useStill(animated)
  const self = useRef<HTMLButtonElement | null>(null)
  const frame = useRef(0)
  const [bursts, setBursts] = useState<Burst[]>([])
  const next = useRef(0)
  useEffect(() => () => cancelAnimationFrame(frame.current), [])
  const live = !still && !disabled

  // Pointer writes go straight to CSS variables, once per frame, so nothing re-renders while it moves.
  const follow = (e: PointerEvent<HTMLButtonElement>): void => {
    onPointerMove?.(e)
    const node = self.current
    if (!live || !node || e.pointerType !== 'mouse') return
    const { clientX, clientY } = e
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(() => {
      const box = node.getBoundingClientRect()
      const x = (clientX - box.left) / box.width
      const y = (clientY - box.top) / box.height
      node.style.setProperty('--mx', `${(x * 100).toFixed(1)}%`)
      node.style.setProperty('--my', `${(y * 100).toFixed(1)}%`)
      node.style.setProperty('--tx', `${((x - 0.5) * 2 * PULL_PX).toFixed(2)}px`)
      node.style.setProperty('--ty', `${((y - 0.5) * 2 * PULL_PX).toFixed(2)}px`)
    })
  }
  const settle = (e: PointerEvent<HTMLButtonElement>): void => {
    onPointerLeave?.(e)
    cancelAnimationFrame(frame.current)
    const node = self.current
    if (!node) return
    node.style.setProperty('--tx', '0px')
    node.style.setProperty('--ty', '0px')
  }
  const burst = (e: PointerEvent<HTMLButtonElement>): void => {
    onPointerDown?.(e)
    const node = self.current
    if (!live || !node) return
    const box = node.getBoundingClientRect()
    const id = next.current++
    setBursts((list) => [...list.slice(-2), { id, x: e.clientX - box.left, y: e.clientY - box.top }])
    window.setTimeout(() => setBursts((list) => list.filter((item) => item.id !== id)), BURST_MS)
  }

  return (
    <motion.button
      ref={(node: HTMLButtonElement | null) => {
        self.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      type={type}
      disabled={disabled}
      data-color={color}
      data-still={still ? '' : undefined}
      className={cx(kit.control, styles.button, className)}
      {...(style ? { style } : {})}
      onPointerMove={follow}
      onPointerLeave={settle}
      onPointerDown={burst}
      {...rest}
    >
      <span aria-hidden="true" className={styles.ring} />
      <span aria-hidden="true" className={styles.light} />
      {bursts.map(({ id, x, y }) => (
        <span key={id} aria-hidden="true" className={styles.burst} style={{ left: x, top: y } as CSSProperties}>
          <i className={styles.ripple} />
          {Array.from({ length: SPARKS }, (_, i) => <i key={i} className={styles.spark} style={{ '--a': `${(i / SPARKS) * 360 + 15}deg` } as CSSProperties} />)}
        </span>
      ))}
      {icon ? <span className={cx(kit.icon, styles.content, styles.icon)}>{icon}</span> : null}
      <span className={styles.content}>{children}</span>
    </motion.button>
  )
}
