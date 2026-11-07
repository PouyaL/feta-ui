'use client'
import type { ComponentProps, ReactNode } from 'react'
import { cx } from '../motion-kit/motion-kit'
import styles from './fieldset.module.css'

export type FieldsetProps = Omit<ComponentProps<'fieldset'>, 'children'> & {
  legend: ReactNode
  description?: ReactNode
  children: ReactNode
}

/** Fields grouped under a legend, in an inset card on the tray. */
export function Fieldset({ legend, description, children, className, ...rest }: FieldsetProps) {
  return (
    <fieldset className={cx(styles.fieldset, className)} {...rest}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.card}>
        {description ? <p className={styles.description}>{description}</p> : null}
        {children}
      </div>
    </fieldset>
  )
}

/** Two fields side by side on Web. They stack on Mobile. */
export const FieldRow = ({ children }: { children: ReactNode }) => <div className={styles.row}>{children}</div>
