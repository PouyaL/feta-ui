'use client'
import { useState, type CSSProperties, type DragEvent, type HTMLAttributes, type ReactNode } from 'react'
import { cx } from '../motion-kit/motion-kit'
import styles from './empty.module.css'

const STAGGER_MS = 40

export type EmptyProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** Dashed drop area, straight on the tray, or a tray with an inset card. Default `card`. */
  container?: 'outline' | 'background' | 'card'
  /** Empty Fan, an Avatar, an Avatar Group or a mono code. */
  media?: ReactNode
  /** Say what is missing. */
  title: ReactNode
  /** Why, or what happens next, in one line. */
  description?: ReactNode
  /** Heading level of the title, so it fits the page. Default 2. */
  level?: 2 | 3 | 4
  /** One main Button, and secondary ones. */
  actions?: ReactNode
  /** A search field, chips or a learn more link. */
  footer?: ReactNode
  /** Outline only: called with the dropped files. The outline reacts during a drag. */
  onFiles?: (files: File[]) => void
  animated?: boolean
}

/** Says what is missing and offers the one next step. */
export function Empty({ container = 'card', media, title, description, level = 2, actions, footer, onFiles, animated = true, className, children, ...rest }: EmptyProps) {
  const [over, setOver] = useState(false)
  const Heading = `h${level}` as 'h2'
  const step = (i: number): CSSProperties => ({ '--order': i, '--stagger': `${STAGGER_MS}ms` } as CSSProperties)
  const drop = container === 'outline' && onFiles ? {
    onDragOver: (e: DragEvent<HTMLElement>) => { e.preventDefault(); setOver(true) },
    onDragLeave: () => setOver(false),
    onDrop: (e: DragEvent<HTMLElement>) => { e.preventDefault(); setOver(false); onFiles([...e.dataTransfer.files]) },
  } : {}
  return (
    <section data-container={container} data-over={over ? '' : undefined} data-still={animated ? undefined : ''} className={cx(styles.empty, className)} {...drop} {...rest}>
      <div className={styles.body}>
        {media ? <div className={styles.media}>{media}</div> : null}
        <div className={styles.copy} style={step(1)}>
          <Heading className={styles.title}>{title}</Heading>
          {description ? <p className={styles.description}>{description}</p> : null}
        </div>
        {actions ? <div className={styles.actions} style={step(2)}>{actions}</div> : null}
        {footer || children ? <div className={styles.footer} style={step(3)}>{footer}{children}</div> : null}
      </div>
    </section>
  )
}

/** A fanned icon tile. Decorative. */
export function EmptyFan({ tone, children, className }: { tone?: 'danger'; children: ReactNode; className?: string }) {
  return (
    <span aria-hidden="true" data-tone={tone} className={cx(styles.fan, className)}>
      <span className={styles.ghost} data-side="left" />
      <span className={styles.ghost} data-side="right" />
      <span className={styles.tile}>{children}</span>
    </span>
  )
}

/** A large mono code, like 404. */
export const EmptyCode = ({ children }: { children: ReactNode }) => <span className={styles.code}>{children}</span>

/** A suggestion chip for No results. */
export function EmptyChip({ className, ...rest }: HTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={cx(styles.chip, className)} {...rest} />
}
