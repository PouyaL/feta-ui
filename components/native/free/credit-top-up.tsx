import { useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, space, type Colors } from '../kit'
import { Button } from './button'
import { Panel, PanelBody, type RenderIcon, type, useThemed } from './card'
import { Radio } from './radio'
import { Slider } from './slider'
import { Switch } from './switch'
import { Tabs } from './tabs'
import { Tween } from './usage-meter'

export type CreditPack = { credits: number; price: number; rate: string; bonus: string; bonusCredits: number }

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
  renderIcon: RenderIcon
  onBuy?: (credits: number, price: number) => void
  onChangeCard?: () => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const count = (value: number): string => Math.round(value).toLocaleString('en-US')
const usd = (value: number): string => `$${value.toFixed(2)}`
const RATE = 0.01
const BAR_HEIGHT = 36

/** Credit purchase: balance with runway, a trend, packs, a custom amount, auto top-up and Buy. */
export function CreditTopUp({ balance, dailyUse, trend, packs, defaultPack = 1, card, lowAfterDays = 3, renderIcon, onBuy, onChangeCard, animated = true, style }: CreditTopUpProps) {
  const styles = useThemed(createStyles)
  const days = Math.round(balance / dailyUse)
  const low = days < lowAfterDays
  const [pack, setPack] = useState<number | null>(defaultPack)
  const [custom, setCustom] = useState(packs[defaultPack]?.credits ?? 5000)
  const [auto, setAuto] = useState(!low)
  const [refill, setRefill] = useState('1000')
  const chosen = pack === null ? undefined : packs[pack]
  const credits = chosen ? chosen.credits + chosen.bonusCredits : custom
  const price = chosen ? chosen.price : custom * RATE
  const top = Math.max(...trend, 1)
  return (
    <Panel animated={animated} label="Credit top-up" style={style}>
      <PanelBody>
        <View style={styles.line}>
          <View style={styles.text}>
            <View style={styles.low}><Text style={styles.small}>Credit balance</Text>{low ? <>{renderIcon('alert-02', 14)}<Text style={styles.danger}>Running low</Text></> : null}</View>
            <View style={styles.balance}><Tween value={balance} format={count} animated={animated} style={styles.amount} /><Text style={styles.small}>credits</Text></View>
            <Text style={styles.small}>About {days} days left at {count(dailyUse)} a day</Text>
          </View>
          <View accessible accessibilityRole="image" accessibilityLabel={`Last 14 days of credit use, from ${count(trend[0] ?? 0)} to ${count(trend[trend.length - 1] ?? 0)} a day`} style={styles.trendWrap}>
            <View style={styles.trend}>{trend.map((value, i) => <View key={i} style={[styles.bar, { height: Math.max(0.06, value / top) * BAR_HEIGHT }]} />)}</View>
            <Text style={styles.tiny}>Last 14 days</Text>
          </View>
        </View>
      </PanelBody>
      <PanelBody title="Add credits" meta="$10 per 1,000">
        <View accessibilityRole="radiogroup" style={styles.packs}>
          {packs.map((item, i) => {
            const on = pack === i
            return (
              <Pressable key={item.credits} accessibilityRole="radio" accessibilityLabel={`${count(item.credits)} credits, $${item.price}. ${item.bonus}`} aria-checked={on} onPress={() => setPack(i)} style={[styles.pack, on && styles.on]}>
                <View style={styles.line}><Text style={styles.name}>{count(item.credits)}</Text><Radio checked={on} onChange={() => setPack(i)} animated={animated} /></View>
                <Text style={styles.name}>${item.price}</Text>
                <Text style={styles.small}>{item.rate} / credit</Text>
                <Text style={styles.small}>{item.bonus}</Text>
              </Pressable>
            )
          })}
        </View>
        <View style={styles.line}><Text style={styles.name}>Custom amount</Text><Text style={styles.small}>{count(credits)} credits</Text></View>
        <Slider label="Custom amount" min={1000} max={50000} step={500} value={custom} onValueChange={(next) => { setCustom(Array.isArray(next) ? next[0] : next); setPack(null) }} format={(v) => `${count(v)} credits`} animated={animated} />
      </PanelBody>
      <PanelBody>
        <View style={styles.line}><View style={styles.text}><Text style={styles.name}>Auto top-up</Text><Text style={styles.small}>Refills with your selected amount</Text></View><Switch accessibilityLabel="Auto top-up" checked={auto} onCheckedChange={setAuto} animated={animated} /></View>
        <View style={[styles.line, !auto && styles.off]}><Text style={styles.small}>Refill when below</Text><Tabs style={styles.refill} label="Refill when below" value={refill} onValueChange={setRefill} animated={animated} items={['500', '1000', '2500'].map((value) => ({ value, label: count(Number(value)), disabled: !auto }))} /></View>
      </PanelBody>
      <PanelBody>
        <View style={styles.line}><View style={styles.tile}>{renderIcon('credit-card', 16)}</View><View style={styles.text}><Text style={styles.name}>{card.label}</Text><Text style={styles.small}>Expires {card.expires}</Text></View><Button variant="ghost" size="sm" onPress={onChangeCard} animated={animated}>Change</Button></View>
      </PanelBody>
      <PanelBody>
        <View style={styles.line}><View style={styles.text}><Text style={styles.name}>{count(credits)} credits</Text>{chosen?.bonusCredits ? <Text style={styles.small}>Includes {count(chosen.bonusCredits)} bonus</Text> : null}</View><Tween value={price} format={usd} animated={animated} style={styles.amount} /></View>
        <Button size="lg" shape="pill" onPress={() => onBuy?.(credits, price)} animated={animated}>Buy credits</Button>
        <View style={styles.fine}>{renderIcon('lock', 12)}<Text style={styles.tiny}>Simulated checkout. Credits never expire.</Text></View>
      </PanelBody>
    </Panel>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  line: { alignItems: 'center', flexDirection: 'row', gap: space[3], justifyContent: 'space-between' },
  text: { flex: 1, gap: space[0.5] },
  low: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
  small: type(12, c.textSecondary),
  tiny: type(10, c.textTertiary),
  danger: type(12, c.danger),
  balance: { alignItems: 'baseline', flexDirection: 'row', gap: space[1] },
  amount: type(24, c.textPrimary, '500'),
  trendWrap: { alignItems: 'flex-end', gap: space[1] },
  trend: { alignItems: 'flex-end', flexDirection: 'row', gap: 2, height: BAR_HEIGHT },
  bar: { backgroundColor: c.inverse, borderRadius: radius.xs, width: 4 },
  packs: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
  pack: { borderColor: c.ink8, borderRadius: radius.control, borderWidth: 1, flexBasis: '46%', flexGrow: 1, gap: space[0.5], padding: space[3] },
  on: { borderColor: c.textPrimary },
  name: type(14, c.textPrimary, '500'),
  off: { opacity: 0.5 },
  // Tabs fill their parent's width by default; here they sit beside a label, so they take only what they need.
  refill: { alignItems: 'flex-end', flexShrink: 1, width: 'auto' },
  tile: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.field, height: 36, justifyContent: 'center', width: 36 },
  fine: { alignItems: 'center', flexDirection: 'row', gap: space[1], justifyContent: 'center' },
})
