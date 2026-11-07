'use client'
import { motion } from 'motion/react'
import { useCallback, useRef, type CSSProperties, type HTMLAttributes, type ReactNode, type Ref } from 'react'
import { ease } from '../../motion-tokens'
import { cx, useStill, watchOffscreen } from '../motion-kit/motion-kit'
import { Spinner } from '../spinner/spinner'
import styles from './skeleton.module.css'

const ARRIVE_S = 0.24
const ROW_STAGGER_S = 0.04

export type SkeletonProps = Omit<HTMLAttributes<HTMLSpanElement>, 'children' | 'ref'> & {
  /** Line for text and pills, Circle for avatars, Block for media and inputs. Default `line`. */
  shape?: 'line' | 'circle' | 'block'
  /** Length or percentage. Line defaults to 100%. */
  width?: number | string
  /** Height, and width too for a circle. */
  height?: number | string
  /** Shimmer on main content, `false` on secondary parts. Default `true`. */
  shimmer?: boolean
  /** Milliseconds to wait before showing. Use 300 on fast connections. */
  delay?: number
  /** `false` drops the sheen. */
  animated?: boolean
  ref?: Ref<HTMLSpanElement>
}

/** A placeholder in the shape of content on its way. Hidden from assistive tech. */
export function Skeleton({ shape = 'line', width, height, shimmer = true, delay = 0, animated = true, className, style, ref, ...rest }: SkeletonProps) {
  const loops = shimmer && animated
  // The caller's ref and the offscreen pause both get the node. The ref is read through `outer`,
  // so an inline callback ref does not re-attach the node on every parent render.
  const outer = useRef(ref)
  outer.current = ref
  const attach = useCallback((node: HTMLSpanElement | null): (() => void) | undefined => {
    if (!node) return undefined
    const stop = loops ? watchOffscreen(node) : undefined
    const given = outer.current
    if (typeof given === 'function') {
      const undo = given(node)
      return () => { stop?.(); if (typeof undo === 'function') undo(); else given(null) }
    }
    if (given) given.current = node
    return () => { stop?.(); if (given) given.current = null }
  }, [loops])
  return (
    <span
      ref={attach}
      aria-hidden="true"
      data-shape={shape}
      data-shimmer={shimmer ? '' : undefined}
      data-still={animated ? undefined : ''}
      data-delayed={delay > 0 ? '' : undefined}
      data-loop={loops ? '' : undefined}
      className={cx(styles.skeleton, className)}
      style={{ ...(width === undefined ? {} : { '--w': typeof width === 'number' ? `${width}px` : width }), ...(height === undefined ? {} : { '--h': typeof height === 'number' ? `${height}px` : height }), ...(delay > 0 ? { '--delay': `${delay}ms` } : {}), ...style } as CSSProperties}
      {...rest}
    />
  )
}

export type SkeletonShellProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** Keep what is already known. */
  title: ReactNode
  /** Mono status beside the ring. Default `LOADING`. */
  status?: string
  animated?: boolean
  children: ReactNode
}

/** The tray and inset card around a loading layout. The region is marked busy. */
export function SkeletonShell({ title, status = 'LOADING', animated = true, className, children, ...rest }: SkeletonShellProps) {
  return (
    <section aria-busy="true" className={cx(styles.shell, className)} {...rest}>
      <header className={styles.header}>
        <span className={styles.title}>{title}</span>
        <span className={styles.status}><Spinner size={10} label={null} animated={animated} />{status}</span>
      </header>
      <div className={styles.body}>{children}</div>
    </section>
  )
}

export type SkeletonArriveProps = {
  /** Row position, top to bottom, for the 40 ms stagger. */
  index?: number
  animated?: boolean
  className?: string
  children: ReactNode
}

/** Wraps real content as it replaces a skeleton, so it fades in over the shape. */
export function SkeletonArrive({ index = 0, animated = true, className, children }: SkeletonArriveProps) {
  const still = useStill(animated)
  return (
    <motion.div
      className={className}
      initial={still ? { opacity: 0 } : { opacity: 0, filter: 'blur(2px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      transition={{ duration: animated ? ARRIVE_S : 0, delay: still ? 0 : index * ROW_STAGGER_S, ease: ease.out }}
    >
      {children}
    </motion.div>
  )
}
