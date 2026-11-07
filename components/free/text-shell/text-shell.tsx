'use client'
import type { ReactNode } from 'react'
import { cx } from '../motion-kit/motion-kit'
import styles from './text-shell.module.css'

/** Style Soft for every text effect: a 4% tray, a 32 header with the name and a mono state, and a body card. */
export function TextShell({ name, state, className, children }: { name: string; state?: string | undefined; className?: string | undefined; children: ReactNode }) {
  return (
    <div className={cx(styles.tray, className)}>
      <div className={styles.header}>
        <span className={styles.name}>{name}</span>
        {state ? <span className={styles.state}>{state}</span> : null}
      </div>
      <div className={styles.body}>{children}</div>
    </div>
  )
}
