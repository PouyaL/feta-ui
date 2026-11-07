'use client'
import { createContext, useContext, useId, type ReactNode } from 'react'
import styles from './form-kit.module.css'

// Shared by the form controls: the pill they all sit on, and the link between a Field and its control.
export const form = styles

export type FieldLink = { id: string; describedBy?: string | undefined; invalid: boolean; disabled: boolean; required: boolean }

const FieldContext = createContext<FieldLink | null>(null)

export function FieldProvider({ value, children }: { value: FieldLink; children: ReactNode }) {
  return <FieldContext.Provider value={value}>{children}</FieldContext.Provider>
}

/** Merges a control's own props with its Field, if it has one. */
export function useFieldControl({ id, invalid, disabled, required, describedBy }: { id?: string | undefined; invalid?: boolean | undefined; disabled?: boolean | undefined; required?: boolean | undefined; describedBy?: string | undefined }) {
  const field = useContext(FieldContext)
  const own = useId()
  const stateInvalid = invalid ?? field?.invalid ?? false
  return {
    id: id ?? field?.id ?? own,
    invalid: stateInvalid,
    disabled: disabled ?? field?.disabled ?? false,
    required: required ?? field?.required ?? false,
    describedBy: [describedBy, field?.describedBy].filter(Boolean).join(' ') || undefined,
    a11y: { 'aria-invalid': stateInvalid || undefined },
  }
}
