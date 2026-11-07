'use client'
import { Fragment, useState, type CSSProperties, type ReactNode } from 'react'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { MinusIcon } from '@fetaui/react/rounded/minus'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Switch } from '../switch/switch'
import { kit } from '../data-kit/data-kit'
import styles from './comparison-table.module.css'

export type ComparisonPlan = { id: string; name: string; short?: string; price: string; /** Washes the column. */ home?: boolean; /** Dropped first on Mobile. */ secondary?: boolean }
export type ComparisonMark = boolean | 'partial' | { mark: boolean | 'partial'; note: string }
export type ComparisonRow = { feature: string; hint?: string; values: Record<string, ComparisonMark> }
export type ComparisonGroup = { label: string; rows: ComparisonRow[] }

export type ComparisonTableProps = {
  title: string
  subtitle?: ReactNode
  plans: ComparisonPlan[]
  groups: ComparisonGroup[]
  defaultDifferences?: boolean
  animated?: boolean
  className?: string
}

const markOf = (value: ComparisonMark | undefined): boolean | 'partial' => (typeof value === 'object' ? value.mark : value ?? false)
const differs = (row: ComparisonRow, plans: ComparisonPlan[]): boolean => new Set(plans.map((plan) => JSON.stringify(row.values[plan.id] ?? false))).size > 1

function Mark({ value, home }: { value: ComparisonMark | undefined; home: boolean }) {
  const mark = markOf(value)
  const label = mark === 'partial' ? 'Partial' : mark ? 'Yes' : 'No'
  return (
    <span className={styles.cell}>
      <span className={styles.mark} data-mark={String(mark)} data-home={home ? '' : undefined} role="img" aria-label={label}>
        {mark === 'partial' ? null : mark ? <CheckIcon size={12} aria-hidden="true" /> : <MinusIcon size={14} aria-hidden="true" />}
      </span>
      {typeof value === 'object' ? <span className={styles.note}>{value.note}</span> : null}
    </span>
  )
}

/** Plans as columns with yes, no and partial marks. Marks repeat as icons and labels, never color alone. */
export function ComparisonTable({ title, subtitle, plans, groups, defaultDifferences = false, animated = true, className }: ComparisonTableProps) {
  const still = useStill(animated)
  const [only, setOnly] = useState(defaultDifferences)
  const shown = groups.map((group) => ({ ...group, rows: only ? group.rows.filter((row) => differs(row, plans)) : group.rows })).filter((group) => group.rows.length > 0)
  let index = 0
  return (
    <section className={cx(kit.enter, styles.root, className)} data-still={still ? '' : undefined} aria-label={title}>
      <header className={styles.head}>
        <h3 className={styles.title}>{title}</h3>
        {subtitle ? <p className={styles.subtitle}>{subtitle}</p> : null}
        <label className={styles.toggle}><span>Only differences</span><Switch checked={only} onCheckedChange={setOnly} animated={animated} aria-label="Only differences" /></label>
      </header>
      <table className={styles.table} aria-label={title}>
        <thead>
          <tr>
            <td className={styles.corner} />
            {plans.map((plan) => (
              <th key={plan.id} scope="col" className={styles.plan} data-home={plan.home ? '' : undefined} data-secondary={plan.secondary ? '' : undefined}>
                <span className={styles.planName}><span className={styles.long}>{plan.name}</span><span className={styles.short}>{plan.short ?? plan.name}</span></span>
                <span className={styles.price}>{plan.price}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((group) => (
            <Fragment key={group.label || 'top'}>
              {group.label ? <tr><th scope="colgroup" colSpan={plans.length + 1} className={styles.group}>{group.label}</th></tr> : null}
              {group.rows.map((row) => (
                <tr key={row.feature} className={kit.row} style={{ '--i': index++ % 12 } as CSSProperties}>
                  <th scope="row" className={styles.feature}>{row.feature}{row.hint ? <span className={styles.hint}>{row.hint}</span> : null}</th>
                  {plans.map((plan) => <td key={plan.id} className={styles.value} data-home={plan.home ? '' : undefined} data-secondary={plan.secondary ? '' : undefined}><Mark value={row.values[plan.id]} home={Boolean(plan.home)} /></td>)}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </section>
  )
}
