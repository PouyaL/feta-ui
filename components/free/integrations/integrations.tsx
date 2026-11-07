'use client'
import { useMemo, useState, type CSSProperties, type ReactNode } from 'react'
import { PlusIcon } from '@fetaui/react/rounded/plus'
import { Button } from '../button/button'
import { useStill } from '../motion-kit/motion-kit'
import { Tabs } from '../tabs/tabs'
import { Body, Panel, Tag, kit } from '../data-kit/data-kit'
import { SearchField } from '../search/search'
import styles from './integrations.module.css'

export type Integration = { id: string; name: string; category: string; description: string; icon: ReactNode; connected?: boolean }

export type IntegrationsProps = {
  items: Integration[]
  /** Resolve when connected. */
  onConnect?: (id: string) => Promise<void> | void
  /** Shown on the row when `onConnect` rejects. The row returns to Connect. */
  failedMessage?: string
  onConfigure?: (id: string) => void
  /** Starts with this row in progress. */
  connecting?: string
  animated?: boolean
  className?: string | undefined
}

/** Search, category Tabs and rows with Connect, Configure or a Connected Badge. */
export function Integrations({ items, onConnect, failedMessage = 'Could not connect. Try again.', onConfigure, connecting, animated = true, className }: IntegrationsProps) {
  const still = useStill(animated)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all')
  const [connected, setConnected] = useState(items.filter((item) => item.connected).map((item) => item.id))
  const [busy, setBusy] = useState<string[]>(connecting ? [connecting] : [])
  const [failed, setFailed] = useState<string[]>([])
  const categories = useMemo(() => [...new Set(items.map((item) => item.category))], [items])
  const needle = query.trim().toLowerCase()
  const shown = items.filter((item) => (tab === 'all' || (tab === 'connected' ? connected.includes(item.id) : item.category === tab)) && (!needle || `${item.name} ${item.category}`.toLowerCase().includes(needle)))
  async function connect(id: string): Promise<void> {
    if (busy.includes(id)) return
    setBusy((list) => [...list, id])
    setFailed((list) => list.filter((item) => item !== id))
    try {
      await onConnect?.(id)
      setConnected((list) => [...list, id])
    } catch {
      setFailed((list) => [...list, id])
    } finally {
      setBusy((list) => list.filter((item) => item !== id))
    }
  }
  return (
    <Panel title="Integrations" subtitle="Connect the tools your team already works in." animated={animated} className={className} actions={<SearchField value={query} onValueChange={setQuery} placeholder="Search by name or category" aria-label="Search integrations" animated={animated} className={styles.search ?? ''} />}>
      <div className={styles.controls} data-still={still ? '' : undefined}>
        <Tabs label="Category" value={tab} onValueChange={setTab} animated={animated} items={[{ value: 'all', label: 'All', count: items.length }, { value: 'connected', label: 'Connected', count: connected.length }, ...categories.map((category) => ({ value: category, label: category, count: items.filter((item) => item.category === category).length }))]} />
      </div>
      <Body flush>
        <ul className={styles.list}>
          {shown.map((item, i) => {
            const isOn = connected.includes(item.id)
            const isBusy = busy.includes(item.id)
            return (
              <li key={item.id} className={`${styles.row} ${kit.row}`} style={{ '--i': i } as CSSProperties}>
                <span className={styles.tile} aria-hidden="true">{item.icon}</span>
                <span className={styles.text}><span className={styles.name}>{item.name}<span className={styles.category}>{item.category}</span></span><span className={styles.description}>{item.description}</span>{!isOn && failed.includes(item.id) ? <span className={styles.failed} role="alert">{failedMessage}</span> : null}</span>
                {isOn ? <span className={styles.status}><Button className={styles.configure ?? ''} variant="ghost" size="sm" onClick={() => onConfigure?.(item.id)} animated={animated}>Configure</Button><Tag tone="success" mark>Connected</Tag></span>
                  : <Button variant={isBusy ? 'primary' : 'secondary'} shape="pill" size="sm" leadingIcon={<PlusIcon size={14} />} status={isBusy ? 'loading' : 'idle'} loadingLabel="Connecting" onClick={() => void connect(item.id)} animated={animated}>Connect</Button>}
              </li>
            )
          })}
          {shown.length === 0 ? <li className={styles.empty}>No integrations match.</li> : null}
        </ul>
      </Body>
    </Panel>
  )
}
