'use client'
import { DownloadIcon } from '@fetaui/react/rounded/download'
import { ReceiptIcon } from '@fetaui/react/rounded/receipt'
import { Button } from '../button/button'
import { IconButton } from '../icon-button/icon-button'
import { cx, useStill } from '../motion-kit/motion-kit'
import { Tag, kit, type Tone } from '../data-kit/data-kit'
import styles from './invoice-row.module.css'

export type InvoiceState = 'paid' | 'due' | 'overdue' | 'refunded'
const STATUS: Record<InvoiceState, [string, Tone]> = { paid: ['Paid', 'success'], due: ['Due', 'neutral'], overdue: ['Overdue', 'danger'], refunded: ['Refunded', 'info'] }

export type InvoiceRowProps = {
  number: string
  /** Line under the number, like Issued Oct 12. */
  date: string
  plan: string
  amount: string
  state: InvoiceState
  onDownload?: () => void
  onPay?: () => void
  animated?: boolean
  className?: string | undefined
}

/** One invoice. Overdue turns the date danger and swaps download for Pay now. */
export function InvoiceRow({ number, date, plan, amount, state, onDownload, onPay, animated = true, className }: InvoiceRowProps) {
  const still = useStill(animated)
  const [label, tone] = STATUS[state]
  return (
    <div className={cx(styles.row, kit.row, className)} data-state={state} data-still={still ? '' : undefined}>
      <span className={styles.tile} aria-hidden="true"><ReceiptIcon size={18} /></span>
      <span className={styles.main}><span className={styles.number}>{number}</span><span className={styles.date}>{date}</span></span>
      <span className={styles.plan}>{plan}</span>
      <span className={styles.money}>
        <span className={styles.amount}>{amount}</span>
        <Tag tone={tone} mark>{label}</Tag>
      </span>
      {state === 'overdue'
        ? <Button size="sm" shape="pill" onClick={onPay} animated={animated}>Pay now</Button>
        : <IconButton variant="ghost" size="sm" label={`Download ${number}`} icon={<DownloadIcon size={16} />} onClick={onDownload} animated={animated} />}
    </div>
  )
}
