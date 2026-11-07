'use client'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type CSSProperties } from 'react'
import { CopyIcon } from '@fetaui/react/rounded/copy'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { RefreshCwIcon } from '@fetaui/react/rounded/refresh-cw'
import { Button } from '../button/button'
import { useStill } from '../motion-kit/motion-kit'
import { Body, EASE_STANDARD, Initials, Panel, Tag, VALUE_MS, kit } from '../data-kit/data-kit'
import styles from './webhooks.module.css'

export type WebhookEndpoint = { id: string; name: string; url: string; events: string[]; extra?: number; rate: string; failing?: number }
export type WebhookDelivery = { id: string; status: number; event: string; duration: string; time: string; eventId?: string; attempt?: number; message?: string; payload?: string }
export type WebhookDetail = { addedBy: string; secret: string; total: number; failed: number; hours: { ok: number; failed: number }[]; axis: string[] }

export type WebhooksProps = {
  endpoints: WebhookEndpoint[]
  detail: WebhookDetail
  deliveries: WebhookDelivery[]
  defaultOpen?: string
  /** The endpoint selected first. Defaults to the first one. */
  defaultEndpoint?: string
  /** Fires when a different endpoint is selected, so you can pass its `detail`. */
  onEndpointChange?: (id: string) => void
  onAdd?: () => void
  /** Retry a delivery. The row waits for the result: resolve with the new status code, or with nothing for 200. A rejection keeps the failure and shows `failedMessage`. */
  onRetry?: (id: string) => void | number | Promise<void | number>
  /** Shown on a delivery when `onRetry` rejects. */
  failedMessage?: string
  animated?: boolean
  className?: string | undefined
}

/** Endpoints with health, a delivery histogram, recent deliveries with Retry, and one open delivery. */
export function Webhooks({ endpoints, detail, deliveries, defaultOpen, defaultEndpoint, onEndpointChange, onAdd, onRetry, failedMessage = 'Retry failed. Try again.', animated = true, className }: WebhooksProps) {
  const still = useStill(animated)
  const [active, setActive] = useState(defaultEndpoint ?? endpoints[0]?.id)
  const [open, setOpen] = useState(defaultOpen ?? null)
  /** Delivery id to the status its retry returned. */
  const [retried, setRetried] = useState<Record<string, number>>({})
  const [retrying, setRetrying] = useState<string[]>([])
  const [failed, setFailed] = useState<string[]>([])
  const statusOf = (item: WebhookDelivery): number => retried[item.id] ?? item.status

  async function retry(id: string): Promise<void> {
    if (retrying.includes(id)) return
    setRetrying((list) => [...list, id])
    setFailed((list) => list.filter((item) => item !== id))
    try {
      const status = await onRetry?.(id)
      setRetried((map) => ({ ...map, [id]: typeof status === 'number' ? status : 200 }))
    } catch {
      setFailed((list) => [...list, id])
    } finally {
      setRetrying((list) => list.filter((item) => item !== id))
    }
  }
  const current = endpoints.find((item) => item.id === active)
  const delivery = deliveries.find((item) => item.id === open)
  const top = Math.max(...detail.hours.map((hour) => hour.ok + hour.failed), 1)
  const failing = endpoints.filter((item) => item.failing).length
  const addedName = detail.addedBy.replace(/^Added by /, '').split(' on ')[0] ?? ''
  return (
    <Panel title="Webhooks" subtitle="Every event is signed and posted to your endpoints. Failed deliveries retry for three days, or you can retry them now." animated={animated} className={className}>
      <div className={styles.summary}><span>{endpoints.length} endpoints · {failing} with failed deliveries</span><Button variant="secondary" shape="pill" size="sm" leadingIcon={<PlusIcon size={14} />} onClick={onAdd} animated={animated}>Add endpoint</Button></div>
      <Body flush>
        <ul className={styles.list}>
          {endpoints.map((item, i) => (
            <li key={item.id} className={kit.row} style={{ '--i': i } as CSSProperties}>
              <button type="button" className={styles.endpoint} aria-pressed={item.id === active} onClick={() => { if (item.id !== active) { setActive(item.id); onEndpointChange?.(item.id) } }}>
                <span className={styles.main}><span className={styles.name}>{item.name}</span><code className={styles.url}>{item.url}</code></span>
                <span className={styles.events}>{item.events.map((event) => <Tag key={event} mono outline>{event}</Tag>)}{item.extra ? <Tag outline>+{item.extra}</Tag> : null}</span>
                <span className={styles.rate}><strong>{item.rate}</strong> delivered</span>
                {item.failing ? <Tag tone="warning" mark>{item.failing} failing</Tag> : <Tag tone="success" mark>Healthy</Tag>}
              </button>
            </li>
          ))}
        </ul>
      </Body>
      <Body title={current?.name}>
        <p className={styles.who}><Initials name={addedName} /><span>{detail.addedBy}</span><code className={styles.secret}>{detail.secret}</code></p>
        <p className={styles.counts}>{detail.total} events<span className={styles.failedCount}>{detail.failed} failed</span></p>
        <div className={styles.histogram} role="img" aria-label={`${detail.total} events over 24 hours, ${detail.failed} failed`}>
          {detail.hours.map((hour, i) => <span key={i} className={styles.column} style={{ transform: `scaleY(${(hour.ok + hour.failed) / top})` }}>{hour.failed ? <span className={styles.failed} style={{ height: `${(hour.failed / (hour.ok + hour.failed)) * 100}%` }} /> : null}</span>)}
        </div>
        <div className={styles.axis} aria-hidden="true">{detail.axis.map((tick) => <span key={tick}>{tick}</span>)}</div>
      </Body>
      <Body>
        <p className={styles.recent}>Recent deliveries</p>
        <ul className={styles.list}>
          {deliveries.map((item) => {
            const status = statusOf(item)
            const bad = status >= 400
            return (
              <li key={item.id} className={styles.delivery} data-open={open === item.id ? '' : undefined}>
                <button type="button" className={styles.deliveryOpen} aria-expanded={open === item.id} onClick={() => setOpen(open === item.id ? null : item.id)}>
                  <Tag tone={bad ? 'danger' : 'success'} mark mono>{status}</Tag>
                  <code className={styles.event}>{item.event}</code>
                  <span className={styles.duration}>{item.duration}</span>
                  <time className={styles.timeCol}>{item.time}</time>
                </button>
                {failed.includes(item.id) ? <span className={styles.retryFailed} role="alert">{failedMessage}</span> : null}
                {bad ? <Button variant="secondary" shape="pill" size="sm" leadingIcon={<RefreshCwIcon size={14} />} status={retrying.includes(item.id) ? 'loading' : 'idle'} loadingLabel="Retrying" onClick={() => void retry(item.id)} animated={animated}>Retry</Button> : null}
              </li>
            )
          })}
        </ul>
      </Body>
      <AnimatePresence initial={false}>
        {delivery ? (
          <motion.div key={delivery.id} initial={still ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: still ? 0 : VALUE_MS / 1000, ease: EASE_STANDARD }}>
            <Body>
              <div className={styles.detailHead}>
                <span className={styles.detailTitle}><code className={styles.name}>{delivery.event}</code><span className={styles.small}>{delivery.eventId}, attempt {delivery.attempt ?? 1}</span></span>
                <Button variant="secondary" shape="pill" size="sm" leadingIcon={<CopyIcon size={14} />} onClick={() => void navigator.clipboard?.writeText(delivery.payload ?? '').catch(() => undefined)} animated={animated}>Copy</Button>
              </div>
              <p className={styles.response}><span className={styles.small}>Response</span><Tag tone={statusOf(delivery) >= 400 ? 'danger' : 'success'} mark mono>{statusOf(delivery)}</Tag><span>{delivery.message}</span></p>
              <div className={styles.code}><pre className={styles.gutter} aria-hidden="true">{(delivery.payload ?? '').split('\n').map((_, i) => `${i + 1}\n`).join('')}</pre><pre className={styles.payload}>{delivery.payload}</pre></div>
            </Body>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </Panel>
  )
}
