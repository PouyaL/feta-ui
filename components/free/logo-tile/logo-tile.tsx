'use client'
import type { ReactNode } from 'react'
import { SparklesIcon } from '@fetaui/react/rounded/sparkles'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './logo-tile.module.css'

export type LogoTileProps = {
  name: string
  /** `mark` adds a small icon before the name. Default `mark`. */
  kind?: 'mark' | 'wordmark'
  /** Replaces the mark. */
  icon?: ReactNode
  /** Shows a state without the pointer, as the Figma specimens do. Default `default`. */
  state?: 'default' | 'hover'
  animated?: boolean
  className?: string | undefined
}

/** A neutral placeholder for a customer or partner logo. */
export function LogoTile({ name, kind = 'mark', icon, state = 'default', animated = true, className }: LogoTileProps) {
  const still = useStill(animated)
  return (
    <div className={cx(styles.tile, className)} data-kind={kind} data-state={state === 'hover' ? 'hover' : undefined} data-still={still ? '' : undefined}>
      {kind === 'mark' ? <span className={styles.mark}>{icon ?? <SparklesIcon size={14} aria-hidden="true" />}</span> : null}
      <span className={styles.name}>{name}</span>
    </div>
  )
}
