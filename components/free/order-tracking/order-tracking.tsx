'use client'
import { PinIcon } from '@fetaui/react/rounded/pin'
import { type CSSProperties, type HTMLAttributes, type ReactNode } from 'react'
import { cx, useStill } from '../motion-kit/motion-kit'
import styles from './order-tracking.module.css'

/** 204 Motion: rows fade 40 ms apart, and stage bars tween 240 ms on the standard ease, 40 ms apart. */
const STAGGER_MS = 40

/** `id` keeps rows stable when two updates share a time. Default key: time plus title. */
export type OrderUpdate = { id?: string; time: string; title: string; detail: string }
export type OrderLine = { name: string; detail: string; media?: ReactNode }

export type OrderTrackingProps = Omit<HTMLAttributes<HTMLElement>, 'title'> & {
  /** Stage names, in order. */
  stages?: string[]
  /** Index into `stages`. */
  stage: number
  title: string
  subtitle: string
  /** The estimated time. */
  eta: string
  /** Default `Delivery window`, followed by the times. */
  window: string
  /** Newest first. */
  updates: OrderUpdate[]
  store: string
  items: OrderLine[]
  address: string
  updated: string
  /** One Button, which changes with the stage. */
  action: ReactNode
  animated?: boolean
}

/** Stage and ETA, a five stage track, a timeline of updates, the items and the address. */
export function OrderTracking({ stages = ['Ordered', 'Packed', 'Out for delivery', 'Arriving', 'Delivered'], stage, title, subtitle, eta, window: span, updates, store, items, address, updated, action, animated = true, className, ...rest }: OrderTrackingProps) {
  const still = useStill(animated)
  return (
    <section data-still={still ? '' : undefined} data-off={animated ? undefined : ''} className={cx(styles.order, className)} {...rest}>
      <header className={styles.top}>
        <div>
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.sub}>{subtitle}</p>
        </div>
        <div className={styles.eta}>
          <div className={styles.time}>{eta}</div>
          <p className={styles.sub}>{span}</p>
        </div>
      </header>
      <ol className={styles.track} aria-label="Delivery stages">
        {stages.map((name, i) => (
          <li key={name} data-reached={i <= stage ? '' : undefined} style={{ '--i': `${i * STAGGER_MS}ms` } as CSSProperties} {...(i === stage ? { 'aria-current': 'step' as const } : {})}>
            <span className={styles.bar} aria-hidden="true">
              <span className={styles.fill} />
              {i === stage ? <span key={stage} className={styles.head} /> : null}
            </span>
            <span className={styles.stage}>{name}</span>
          </li>
        ))}
      </ol>
      <div className={styles.details}>
        <div>
          <h4 className={styles.heading}>Updates</h4>
          <ol className={styles.updates}>
            {updates.map((update, i) => (
              <li key={update.id ?? `${update.time}·${update.title}`} data-latest={i === 0 ? '' : undefined} style={{ '--i': `${i * STAGGER_MS}ms` } as CSSProperties}>
                <time className={styles.clock}>{update.time}</time>
                <span className={styles.dot} />
                <span><span className={styles.line}>{update.title}</span><span className={styles.sub}>{update.detail}</span></span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <div className={styles.storeHead}><h4 className={styles.heading}>{store}</h4><span className={styles.count}>{items.length} items</span></div>
          <ul className={styles.items}>
            {items.map((item) => (
              <li key={item.name}>
                <span className={styles.thumb}>{item.media}</span>
                <span><span className={styles.line}>{item.name}</span><span className={styles.sub}>{item.detail}</span></span>
              </li>
            ))}
          </ul>
          <p className={styles.address}><PinIcon size={14} />{address}</p>
        </div>
      </div>
      <footer className={styles.footer}><span className={styles.count}>{updated}</span>{action}</footer>
    </section>
  )
}
