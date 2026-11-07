'use client'
import { useState, type CSSProperties } from 'react'
import { Alert02Icon } from '@fetaui/react/rounded/alert-02'
import { BellIcon } from '@fetaui/react/rounded/bell'
import { CheckIcon } from '@fetaui/react/rounded/check'
import { CheckCheckIcon } from '@fetaui/react/rounded/check-check'
import { MailIcon } from '@fetaui/react/rounded/mail'
import { MessageIcon } from '@fetaui/react/rounded/message'
import { Button } from '../button/button'
import { Input } from '../input/input'
import { Switch } from '../switch/switch'
import { Body, Meter, Panel, Tag, useFlash } from '../data-kit/data-kit'
import styles from './spend-alerts.module.css'

const money = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`
/** The lowest threshold, marked on the track. */
const THRESHOLD_FLOOR = 50

export type SpendAlertChannels = { email: boolean; chat: boolean; pager: boolean }
export type SpendAlertSettings = { budget: number; threshold: number; channels: SpendAlertChannels; hardStop: boolean }

export type SpendAlertsProps = {
  scope: string
  resets: string
  defaultBudget?: number
  defaultThreshold?: number
  spent: number
  forecast: { amount: number; by: string }
  email: string
  channel: string
  pager: string
  edited: string
  /** Shows the confirmed state, as after a save, until the first edit. */
  defaultSaved?: boolean
  /** The channels to start with. Email and Chat are on by default. */
  defaultChannels?: Partial<SpendAlertChannels>
  defaultHardStop?: boolean
  /** The chat preview's sender, time and the name of what is being budgeted. */
  preview?: { sender?: string; time?: string; subject?: string }
  onSave?: (settings: SpendAlertSettings) => void
  onTest?: () => void
  animated?: boolean
  className?: string | undefined
}

/** Budget alerts: budget, threshold, channels, a hard stop and a live preview of the message. */
export function SpendAlerts({ scope, resets, defaultBudget = 5000, defaultThreshold = 80, spent, forecast, email, channel, pager, edited, defaultSaved = false, defaultChannels, defaultHardStop = false, preview, onSave, onTest, animated = true, className }: SpendAlertsProps) {
  const [budget, setBudget] = useState(defaultBudget)
  const [threshold, setThreshold] = useState(defaultThreshold)
  const [on, setOn] = useState({ email: true, chat: true, pager: false, ...defaultChannels, stop: defaultHardStop })
  const [saved, flash] = useFlash(2400)
  const [preset, setPreset] = useState(defaultSaved)
  const showSaved = saved || preset
  const sender = preview?.sender ?? 'Northwind Billing'
  const at = (budget * threshold) / 100
  const used = budget > 0 ? spent / budget : 0
  const health = used >= 1 ? 'Over budget' : forecast.amount > budget ? 'Forecast over budget' : 'On track'
  const healthy = health === 'On track'
  const rows = [
    { key: 'email' as const, icon: <MailIcon size={16} aria-hidden="true" />, title: 'Email', sub: email },
    { key: 'chat' as const, icon: <MessageIcon size={16} aria-hidden="true" />, title: 'Chat', sub: channel },
    { key: 'pager' as const, icon: <BellIcon size={16} aria-hidden="true" />, title: 'Pager', sub: pager },
  ]
  return (
    <Panel
      title="Spend alerts"
      subtitle={scope}
      width={560}
      animated={animated}
      className={className}
      actions={<span className={styles.state} role="status" data-warn={showSaved || healthy ? undefined : ''}>{showSaved ? <CheckCheckIcon size={14} aria-hidden="true" /> : healthy ? <CheckIcon size={14} aria-hidden="true" /> : <Alert02Icon size={14} aria-hidden="true" />}{showSaved ? 'Saved' : health}</span>}
      footer={<><span>{edited}</span><span className={styles.actions}><Button variant="secondary" size="sm" shape="pill" onClick={onTest} animated={animated}>Send test</Button><Button size="sm" shape="pill" onClick={() => { onSave?.({ budget, threshold, channels: { email: on.email, chat: on.chat, pager: on.pager }, hardStop: on.stop }); flash() }} animated={animated}>{showSaved ? 'Saved' : 'Save'}</Button></span></>}
    >
      <Body>
        <div className={styles.budget}>
          <span className={styles.text}><span className={styles.title}>Monthly budget</span><span className={styles.small}>{resets}</span></span>
          <Input className={styles.budgetInput ?? ''} aria-label="Monthly budget in USD" inputMode="numeric" value={budget.toLocaleString('en-US')} onChange={(e) => { setPreset(false); setBudget(Number(e.target.value.replace(/\D/g, '')) || 0) }} leading={<span aria-hidden="true">$</span>} animated={animated} />
        </div>
      </Body>
      <Body title="Alert at" meta={<span className={styles.at}>{threshold}% · {money(at)}</span>}>
        <div className={styles.track} style={{ '--at': `${threshold}%` } as CSSProperties}>
          <Meter value={threshold / 100} tone="warning" markers={[THRESHOLD_FLOOR / 100]} height={6} />
          <input className={styles.range} type="range" min={0} max={100} step={5} value={threshold} aria-label="Alert threshold" aria-valuetext={`${threshold}%, ${money(at)}`} onChange={(e) => { setPreset(false); setThreshold(Math.max(THRESHOLD_FLOOR, Number(e.target.value))) }} />
        </div>
        <div className={styles.ticks} aria-hidden="true"><span style={{ left: `${THRESHOLD_FLOOR}%` }}>50%</span><strong style={{ left: `${threshold}%` }}>{threshold === 100 ? '' : `${threshold}%`}</strong><span style={{ left: '100%' }}>100%</span></div>
        <p className={styles.legend}><span className={styles.spent}>Spent {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(spent)}</span><span className={styles.forecast}>Forecast {money(forecast.amount)} by {forecast.by}</span><span className={styles.percent}>{Math.round(used * 100)}% used</span></p>
      </Body>
      <Body title="Notify">
        <ul className={styles.rows}>
          {rows.map((row) => (
            <li key={row.key} className={styles.row}>
              {row.icon}<span className={styles.channel}><span className={styles.title}>{row.title}</span><span className={styles.small}>{row.sub}</span></span>
              <Switch aria-label={`Notify by ${row.title}`} checked={on[row.key]} onCheckedChange={(next) => { setPreset(false); setOn((all) => ({ ...all, [row.key]: next })) }} animated={animated} />
            </li>
          ))}
        </ul>
      </Body>
      <Body>
        <div className={styles.row}>
          <span className={styles.text}><span className={styles.title}>Hard stop at 100%</span><span className={styles.small}>{on.stop ? 'Stop serving at the budget' : 'Keep serving past the budget'}</span></span>
          <Switch aria-label="Hard stop at 100%" checked={on.stop} onCheckedChange={(next) => { setPreset(false); setOn((all) => ({ ...all, stop: next })) }} animated={animated} />
        </div>
      </Body>
      <Body title="Chat preview" meta={channel}>
        <div className={styles.chat}>
          <span className={styles.tile} aria-hidden="true">{sender.charAt(0).toUpperCase()}</span>
          <div className={styles.message}>
            <p className={styles.sender}>{sender} <Tag>App</Tag> <span className={styles.small}>{preview?.time ?? '9:41 AM'}</span></p>
            <p className={styles.alert}><Alert02Icon size={14} aria-hidden="true" />{preview?.subject ?? 'Production'} passed {threshold}% of budget</p>
            <dl className={styles.facts}><div><dt>Used</dt><dd>{money(at)} of {money(budget)}</dd></div><div><dt>Forecast</dt><dd>{money(forecast.amount)} by {forecast.by}</dd></div></dl>
          </div>
        </div>
      </Body>
    </Panel>
  )
}
