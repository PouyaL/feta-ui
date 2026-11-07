'use client'
import { useLayoutEffect, useRef, type ComponentProps, type MouseEvent, type ReactNode } from 'react'
import { FieldProvider, form, useFieldControl } from '../form-kit/form-kit'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './input-group.module.css'

const LINE = 22
const MAX_LINES = 6
const BASE_LINES = 1

export type InputGroupProps = {
  /** Inside the pill, before the value. */
  start?: ReactNode
  /** Inside the pill, after the value. */
  end?: ReactNode
  /** A row above the value. The pill becomes a radius 18 box. */
  blockStart?: ReactNode
  /** A row below the value. */
  blockEnd?: ReactNode
  invalid?: boolean
  disabled?: boolean
  animated?: boolean
  className?: string
  children: ReactNode
}

/** One control with addons inside the same ring. Focus and invalid belong to the whole group. */
export function InputGroup({ start, end, blockStart, blockEnd, invalid, disabled, animated = true, className, children }: InputGroupProps) {
  const still = useStill(animated)
  const field = useFieldControl({ invalid, disabled })
  const block = Boolean(blockStart || blockEnd)

  function focusEntry(e: MouseEvent<HTMLDivElement>): void {
    if ((e.target as Element).closest('button, a')) return
    e.currentTarget.querySelector<HTMLElement>('input, textarea')?.focus()
  }

  const inline = <>{start ? <span className={styles.addon}>{start}</span> : null}<FieldProvider value={{ id: field.id, describedBy: field.describedBy, invalid: field.invalid, disabled: field.disabled, required: field.required }}>{children}</FieldProvider>{end ? <span className={styles.addon}>{end}</span> : null}</>

  return (
    <div
      className={cx(block ? styles.box : form.pill, !block && styles.pill, className)}
      data-invalid={field.invalid ? '' : undefined}
      data-disabled={field.disabled ? '' : undefined}
      data-still={still ? '' : undefined}
      data-has-end={end ? '' : undefined}
      onClick={focusEntry}
    >
      {block ? (
        <>
          {blockStart ? <div className={styles.blockRow}>{blockStart}</div> : null}
          <div className={styles.blockBody}>{inline}</div>
          {blockEnd ? <div className={styles.blockRow}>{blockEnd}</div> : null}
        </>
      ) : inline}
    </div>
  )
}

export type InputGroupInputProps = Omit<ComponentProps<'input'>, 'size'>

/** The value of an Input Group. */
export function InputGroupInput({ id, disabled, required, className, 'aria-describedby': describedBy, ...rest }: InputGroupInputProps) {
  const field = useFieldControl({ id, disabled, required, describedBy })
  return <input {...rest} {...field.a11y} id={field.id} disabled={field.disabled} required={field.required} aria-describedby={field.describedBy} className={cx(form.entry, className)} />
}

export type InputGroupTextareaProps = ComponentProps<'textarea'> & { animated?: boolean }

/** A composer: it grows by a line at a time up to six, then scrolls. */
export function InputGroupTextarea({ id, disabled, required, className, onInput, animated = true, 'aria-describedby': describedBy, ref, ...rest }: InputGroupTextareaProps) {
  const still = useStill(animated)
  const field = useFieldControl({ id, disabled, required, describedBy })
  const inner = useRef<HTMLTextAreaElement | null>(null)

  function fit(): void {
    const node = inner.current
    if (!node) return
    node.style.height = '0'
    const lines = Math.min(MAX_LINES, Math.max(BASE_LINES, Math.round(node.scrollHeight / LINE)))
    node.style.height = `${lines * LINE}px`
    node.style.overflowY = node.scrollHeight > lines * LINE ? 'auto' : 'hidden'
  }

  useLayoutEffect(fit)

  return (
    <textarea
      {...rest}
      {...field.a11y}
      ref={(node) => {
        inner.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      rows={1}
      id={field.id}
      disabled={field.disabled}
      required={field.required}
      aria-describedby={field.describedBy}
      data-still={still ? '' : undefined}
      onInput={(e) => { fit(); onInput?.(e) }}
      className={cx(form.entry, styles.composer, className)}
    />
  )
}

/** Mono text for units and prefixes. */
export const InputGroupText = ({ children }: { children: ReactNode }) => <span className={styles.text}>{children}</span>

/** A unit in a small 5% chip. */
export const InputGroupChip = ({ children }: { children: ReactNode }) => <span className={styles.chip}>{children}</span>
