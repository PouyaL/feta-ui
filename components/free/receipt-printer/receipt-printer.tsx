'use client'
import { motion, type PanInfo } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { spring } from '../../motion-tokens'
import { Button } from '../button/button'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './receipt-printer.module.css'

/** Print: 40 ms per line of paper. */
const LINE_MS = 40
/** Lines the header, rules, totals, barcode and footer take, on top of the items. */
const BASE_LINES = 16
/** The Torn frame: the paper lands 118 px down and 21 px left, tilted 8 degrees. */
const TORN = { x: -21, y: 118, rotate: -8 }
/** A pull past this tears the paper. */
const PULL = 40
const PULL_LIMIT = 64
/** A drawn code, not a scannable one: [x, width] per bar. */
const BARS = '0:2 3:3 8:2 12:1 15:1 17:2 21:3 25:3 30:2 34:3 39:1 41:3 45:3 50:1 52:1 55:3 60:2 63:1 66:1 69:2 72:2 76:2 79:1 81:2 84:2 88:1 90:3 94:2 97:3 102:1 105:3 110:1 112:1 114:2 117:3 122:1 125:2 128:3'
  .split(' ').map((bar) => bar.split(':').map(Number))

export type ReceiptState = 'idle' | 'printing' | 'hanging' | 'torn'

export type ReceiptLine = { quantity: number; name: string; price: number }

export type ReceiptPrinterProps = {
  shop?: string
  date?: string
  order?: string
  items?: ReceiptLine[]
  /** Percent. Default 8. */
  taxRate?: number
  currency?: string
  thanks?: ReactNode
  state?: ReceiptState
  defaultState?: ReceiptState
  onStateChange?: (state: ReceiptState) => void
  /** Stops the paper halfway out at `printing`, for documentation. */
  frozen?: boolean
  /** `false` shows the receipt complete and drops it without motion. */
  animated?: boolean
  className?: string
}

const ITEMS: ReceiptLine[] = [
  { quantity: 2, name: 'Flat white', price: 9 },
  { quantity: 1, name: 'Almond croissant', price: 3.8 },
  { quantity: 2, name: 'Oat milk', price: 1.2 },
  { quantity: 1, name: 'Banana bread', price: 3.2 },
]

const STATUS: Record<ReceiptState, string> = { idle: 'Ready', printing: 'Printing…', hanging: 'Pull down to tear', torn: 'Ready' }

/** A receipt that prints out of an ink slot, hangs, and tears on a pull. */
export function ReceiptPrinter({
  shop = 'Feta Coffee', date = '14 Oct 2026 · 08:42', order = 'Order #4182', items = ITEMS, taxRate = 8, currency = '$', thanks = 'Thank you, come again',
  state, defaultState = 'idle', onStateChange, frozen = false, animated = true, className,
}: ReceiptPrinterProps) {
  const still = useStill(animated)
  const [held, setHeld] = useState(defaultState)
  const current = state ?? held
  const lines = BASE_LINES + items.length

  function move(next: ReceiptState): void {
    setHeld(next)
    onStateChange?.(next)
  }

  // Nothing feeds when still, so the paper arrives complete.
  useEffect(() => {
    if (still && current === 'printing' && !frozen) move('hanging')
  })

  const subtotal = items.reduce((sum, item) => sum + item.price, 0)
  const tax = subtotal * (taxRate / 100)

  function release(_: PointerEvent | MouseEvent | TouchEvent, info: PanInfo): void {
    if (info.offset.y > PULL) move('torn')
  }

  return (
    <article className={cx(styles.printer, className)} aria-label={`${shop} receipt`} data-state={current} data-still={still ? '' : undefined}>
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <h3 className={styles.title}>{shop}</h3>
          {current === 'torn'
            ? <Button className={styles.again} variant="link" size="sm" animated={animated} onClick={() => move('idle')}>Print again</Button>
            : <span className={styles.status} role="status">{STATUS[current]}</span>}
        </div>
        <div className={styles.slot}><span /></div>
      </div>
      <div className={styles.output}>
        {current === 'idle' ? null : (
          <motion.div
            className={styles.feed}
            style={{ transformOrigin: '0 0' }}
            initial={false}
            animate={current === 'torn' ? TORN : { x: 0, y: 0, rotate: 0 }}
            transition={still ? { duration: 0 } : spring.settle}
            drag={current === 'hanging' && !still ? 'y' : false}
            dragConstraints={{ top: 0, bottom: PULL_LIMIT }}
            dragElastic={0.1}
            dragSnapToOrigin
            onDragEnd={release}
          >
            <div
              className={styles.paper}
              data-frozen={frozen ? '' : undefined}
              data-state={current}
              style={{ animationDuration: `${lines * LINE_MS}ms`, animationTimingFunction: `steps(${lines}, end)` }}
              onAnimationEnd={() => { if (current === 'printing' && !frozen) move('hanging') }}
            >
              <div className={styles.head}><strong>{shop.toUpperCase()}</strong><span>{date}</span><span>{order}</span></div>
              <hr className={styles.rule} />
              <div className={styles.lines}>
                {items.map((item) => <p key={item.name} className={styles.line}><span>{item.quantity} × {item.name}</span><span>{item.price.toFixed(2)}</span></p>)}
              </div>
              <hr className={styles.rule} />
              <div className={styles.lines}>
                <p className={styles.line} data-soft=""><span>Subtotal</span><span>{subtotal.toFixed(2)}</span></p>
                <p className={styles.line} data-soft=""><span>Tax {taxRate}%</span><span>{tax.toFixed(2)}</span></p>
                <p className={styles.line} data-total=""><span>Total</span><span>{currency}{(subtotal + tax).toFixed(2)}</span></p>
              </div>
              <svg className={styles.barcode} viewBox="0 0 132 52" aria-hidden="true">
                {BARS.map(([x = 0, width = 1]) => <rect key={x} x={x} width={width} height="52" />)}
              </svg>
              <p className={styles.thanks}>{thanks}</p>
            </div>
          </motion.div>
        )}
        {current === 'torn' ? null : (
          <div className={styles.action}>
            {current === 'hanging'
              ? <Button shape="pill" size="lg" variant="secondary" animated={animated} onClick={() => move('torn')}>Tear receipt</Button>
              : <Button shape="pill" size="lg" status={current === 'printing' ? 'loading' : 'idle'} animated={animated} onClick={() => move('printing')}>Print receipt</Button>}
          </div>
        )}
      </div>
    </article>
  )
}
