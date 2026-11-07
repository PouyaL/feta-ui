'use client'
import { useId, useState, type ReactNode } from 'react'
import { Alert02Icon } from '@fetaui/react/rounded/alert-02'
import { CreditCardIcon } from '@fetaui/react/rounded/credit-card'
import { LockIcon } from '@fetaui/react/rounded/lock'
import { Button } from '../button/button'
import { Radio } from '../radio/radio'
import { Slider } from '../slider/slider'
import { Switch } from '../switch/switch'
import { Tabs } from '../tabs/tabs'
import { Body, Panel, Tween, cx } from '../data-kit/data-kit'
import styles from './credit-top-up.module.css'

export type CreditPack = { credits: number; price: number; rate: string; bonus: string; bonusCredits: number }

export type AutoTopUp = { enabled: boolean; /** Refill when the balance drops below this many credits. */ below: number }

export type CreditTopUpProps = {
  balance: number
  /** Credits used per day. */
  dailyUse: number
  /** Fourteen days of use. */
  trend: number[]
  packs: CreditPack[]
  defaultPack?: number
  card: { label: string; expires: string }
  /** Below this many days the panel warns and auto top-up turns off. */
  lowAfterDays?: number
  /** Price per credit for the custom amount. Default 0.01, shown as $10 per 1,000. */
  rate?: number
  /** Starts auto top-up on or off. Defaults to on unless the balance is low. */
  defaultAutoTopUp?: boolean
  /** The Refill when below choices, in credits. */
  refillOptions?: number[]
  defaultRefill?: number
  /** Fires when auto top-up or its threshold changes. */
  onAutoTopUpChange?: (autoTopUp: AutoTopUp) => void
  /** Gets the auto top-up settings too. */
  onBuy?: (credits: number, price: number, autoTopUp: AutoTopUp) => void
  /** The line under Buy. */
  note?: ReactNode
  onChangeCard?: () => void
  animated?: boolean
  className?: string | undefined
}

const count = (value: number): string => Math.round(value).toLocaleString('en-US')
const usd = (value: number): string => `$${value.toFixed(2)}`
const RATE = 0.01
const REFILLS = [500, 1000, 2500]

/** Credit purchase: balance with runway, a trend, packs, a custom amount, auto top-up and Buy. */
export function CreditTopUp({ balance, dailyUse, trend, packs, defaultPack = 1, card, lowAfterDays = 3, rate = RATE, defaultAutoTopUp, refillOptions = REFILLS, defaultRefill, onAutoTopUpChange, onBuy, note = 'Simulated checkout. Credits never expire.', onChangeCard, animated = true, className }: CreditTopUpProps) {
  const id = useId()
  const days = dailyUse > 0 ? Math.round(balance / dailyUse) : null
  const low = days !== null && days < lowAfterDays
  const start = packs[defaultPack]
  const [pack, setPack] = useState<number | null>(defaultPack)
  const [custom, setCustom] = useState(start?.credits ?? 5000)
  const [auto, setAuto] = useState(defaultAutoTopUp ?? !low)
  const [refill, setRefill] = useState(String(defaultRefill ?? refillOptions[Math.min(1, refillOptions.length - 1)] ?? 1000))
  const changeAuto = (enabled: boolean, below: string): void => {
    setAuto(enabled)
    setRefill(below)
    onAutoTopUpChange?.({ enabled, below: Number(below) })
  }
  const chosen = pack === null ? undefined : packs[pack]
  const credits = chosen ? chosen.credits + chosen.bonusCredits : custom
  const price = chosen ? chosen.price : custom * rate
  const top = Math.max(...trend, 1)
  return (
    <Panel width={480} animated={animated} className={className} label="Credit top-up">
      <Body>
        <div className={styles.balanceRow}>
          <div className={styles.balanceText}>
            <span className={styles.small}>Credit balance{low ? <span className={styles.low}><Alert02Icon size={14} aria-hidden="true" />Running low</span> : null}</span>
            <p className={styles.balance}><Tween className={styles.amount} value={balance} format={count} animated={animated} /> credits</p>
            <span className={styles.small}>{days === null ? 'No recent use' : `About ${days} days left at ${count(dailyUse)} a day`}</span>
          </div>
          <div className={styles.trendWrap}>
            <div className={styles.trend} role="img" aria-label={`Last 14 days of credit use, from ${count(trend[0] ?? 0)} to ${count(trend[trend.length - 1] ?? 0)} a day`}>
              {trend.map((value, i) => <span key={i} className={styles.bar} style={{ transform: `scaleY(${Math.max(0.06, value / top)})`, transitionDelay: `${i * 20}ms` }} />)}
            </div>
            <span className={styles.trendLabel}>Last 14 days</span>
          </div>
        </div>
      </Body>
      <Body title="Add credits" meta={`${usd(rate * 1000).replace(/\.00$/, '')} per 1,000`}>
        <div className={styles.packs} role="radiogroup" aria-label="Credit pack">
          {packs.map((item, i) => (
            <label key={item.credits} className={styles.pack} data-on={pack === i ? '' : undefined}>
              <span className={styles.packTop}><span className={styles.packCredits}>{count(item.credits)}</span><Radio name={`${id}-pack`} checked={pack === i} onChange={() => { setPack(i); setCustom(item.credits) }} animated={animated} /></span>
              <span className={styles.packPrice}>${item.price}</span>
              <span className={styles.rate}>{item.rate} / credit</span>
              <span className={styles.bonus}>{item.bonus}</span>
            </label>
          ))}
        </div>
        <div className={styles.customHead}><span>Custom amount</span><span className={styles.small}>{count(credits)} credits</span></div>
        <Slider label="Custom amount" min={1000} max={50000} step={500} value={custom} onValueChange={(next) => { setCustom(Array.isArray(next) ? next[0] ?? 0 : next); setPack(null) }} format={(v) => `${count(v)} credits`} animated={animated} />
      </Body>
      <Body>
        <div className={styles.line}><span className={styles.text}><span>Auto top-up</span><span className={styles.small}>Refills with your selected amount</span></span><Switch aria-label="Auto top-up" checked={auto} onCheckedChange={(on) => changeAuto(on, refill)} animated={animated} /></div>
        <div className={styles.line} data-off={auto ? undefined : ''}><span className={styles.small}>Refill when below</span><Tabs label="Refill when below" value={refill} onValueChange={(below) => changeAuto(auto, below)} animated={animated} items={refillOptions.map((value) => ({ value: String(value), label: count(value), disabled: !auto }))} /></div>
      </Body>
      <Body>
        <div className={styles.line}><span className={styles.cardTile}><CreditCardIcon size={16} aria-hidden="true" /></span><span className={styles.text}><span>{card.label}</span><span className={styles.small}>Expires {card.expires}</span></span><Button variant="ghost" size="sm" onClick={onChangeCard} animated={animated}>Change</Button></div>
      </Body>
      <Body>
        <div className={styles.total}><span className={styles.text}><span>{count(credits)} credits</span>{chosen?.bonusCredits ? <span className={styles.bonusLine}>Includes {count(chosen.bonusCredits)} bonus</span> : null}</span><Tween className={styles.price} value={price} format={usd} animated={animated} /></div>
        <Button size="lg" shape="pill" className={cx(styles.buy)} onClick={() => onBuy?.(credits, price, { enabled: auto, below: Number(refill) })} animated={animated}>Buy credits</Button>
        <p className={styles.fine}><LockIcon size={12} aria-hidden="true" />{note}</p>
      </Body>
    </Panel>
  )
}
