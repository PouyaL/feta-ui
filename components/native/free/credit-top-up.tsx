import { useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, space, useColors, type Colors } from '../kit'
import { Button, withInk, SELF } from './button'
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
  const colors = useColors()
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
        <View style={styles.balanceRow}>
          <View style={styles.text}>
            <View style={styles.low}><Text style={styles.small}>Credit balance</Text>{low ? <View style={styles.lowTag}>{withInk(renderIcon('alert-02', 14), colors.warning)}<Text style={styles.warning}>Running low</Text></View> : null}</View>
            <View style={styles.balance}><Tween value={balance} format={count} animated={animated} style={styles.amount} /><Text style={styles.small}>credits</Text></View>
            <Text style={styles.small}>About {days} days left at {count(dailyUse)} a day</Text>
          </View>
          <View accessible accessibilityRole="image" accessibilityLabel={`Last 14 days of credit use, from ${count(trend[0] ?? 0)} to ${count(trend[trend.length - 1] ?? 0)} a day`} style={styles.trendWrap}>
            <View style={styles.trend}>{trend.map((value, i) => <View key={i} style={[styles.bar, i === trend.length - 1 ? styles.barLast : null, { height: Math.max(0.06, value / top) * BAR_HEIGHT }]} />)}</View>
            <Text style={styles.trendLabel}>Last 14 days</Text>
          </View>
        </View>
      </PanelBody>
      <PanelBody title="Add credits" meta="$10 per 1,000">
        <View accessibilityRole="radiogroup" style={styles.packs}>
          {packs.map((item, i) => {
            const on = pack === i
            return (
              <Pressable key={item.credits} accessibilityRole="radio" accessibilityLabel={`${count(item.credits)} credits, $${item.price}. ${item.bonus}`} aria-checked={on} onPress={() => { setPack(i); setCustom(item.credits) }} style={[styles.pack, on && styles.on]}>
                <View style={styles.packTop}><Text style={styles.packCredits}>{count(item.credits)}</Text><Radio decorative checked={on} animated={animated} /></View>
                <Text style={styles.name}>${item.price}</Text>
                <Text numberOfLines={1} style={styles.rate}>{item.rate} / credit</Text>
                <Text style={[styles.small, on && styles.bonusOn]}>{item.bonus}</Text>
              </Pressable>
            )
          })}
        </View>
        <View style={styles.customHead}><Text style={styles.name}>Custom amount</Text><Text style={styles.small}>{count(credits)} credits</Text></View>
        <Slider label="Custom amount" min={1000} max={50000} step={500} value={custom} onValueChange={(next) => { setCustom(Array.isArray(next) ? next[0] : next); setPack(null) }} format={(v) => `${count(v)} credits`} animated={animated} />
      </PanelBody>
      <PanelBody>
        <View style={styles.line}><View style={styles.text}><Text style={styles.name}>Auto top-up</Text><Text style={styles.small}>Refills with your selected amount</Text></View><Switch accessibilityLabel="Auto top-up" checked={auto} onCheckedChange={setAuto} animated={animated} /></View>
        <View style={[styles.line, !auto && styles.off]}><Text style={[styles.small, styles.refillLabel]}>Refill when below</Text><Tabs style={styles.refill} label="Refill when below" value={refill} onValueChange={setRefill} animated={animated} items={['500', '1000', '2500'].map((value) => ({ value, label: count(Number(value)), disabled: !auto }))} /></View>
      </PanelBody>
      <PanelBody>
        <View style={styles.line}><View style={styles.tile}>{renderIcon('credit-card', 16)}</View><View style={styles.text}><Text style={styles.name}>{card.label}</Text><Text style={styles.small}>Expires {card.expires}</Text></View><Button style={SELF.center} variant="ghost" size="sm" onPress={onChangeCard} animated={animated}>Change</Button></View>
      </PanelBody>
      <PanelBody>
        <View style={styles.line}><View style={styles.text}><Text style={styles.name}>{count(credits)} credits</Text>{chosen?.bonusCredits ? <Text style={styles.bonusLine}>Includes {count(chosen.bonusCredits)} bonus</Text> : null}</View><Tween value={price} format={usd} animated={animated} style={styles.price} /></View>
        <Button size="lg" shape="pill" style={styles.buy} onPress={() => onBuy?.(credits, price)} animated={animated}>Buy credits</Button>
        <View style={styles.fine}>{withInk(renderIcon('lock', 12), colors.textTertiary)}<Text style={styles.small3}>Simulated checkout. Credits never expire.</Text></View>
      </PanelBody>
    </Panel>
  )
}

const createStyles = (c: Colors) => {
  const successText = c.canvas === '#ffffff' ? '#047857' : '#6ee7b7'
  const warningText = c.canvas === '#ffffff' ? '#c2410c' : '#fdba74'
  return StyleSheet.create({
    line: { alignItems: 'center', flexDirection: 'row', gap: space[3], justifyContent: 'space-between' },
    balanceRow: { alignItems: 'flex-end', flexDirection: 'row', gap: space[4], justifyContent: 'space-between' },
    text: { flex: 1, gap: space[0.5], minWidth: 0 },
    low: { alignItems: 'center', flexDirection: 'row', gap: space[3] },
    lowTag: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
    small: { ...type(12, c.textSecondary), lineHeight: 16 },
    small3: { ...type(12, c.textTertiary), lineHeight: 16 },
    warning: { ...type(12, warningText, '500'), lineHeight: 16 },
    balance: { alignItems: 'baseline', flexDirection: 'row', gap: space[1] },
    amount: { ...type(28, c.textPrimary, '600'), lineHeight: 32 },
    trendWrap: { flexBasis: 100, flexGrow: 0, flexShrink: 0, gap: space[1] },
    trend: { alignItems: 'flex-end', flexDirection: 'row', gap: space[1], height: BAR_HEIGHT },
    bar: { backgroundColor: c.ink10, borderRadius: radius.xs, flex: 1 },
    barLast: { backgroundColor: c.textPrimary },
    trendLabel: { ...type(10, c.textTertiary), lineHeight: 10, letterSpacing: -0.2, textAlign: 'right' },
    packs: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2] },
    // Two packs a row on a phone, like the web under 400 wide.
    pack: { borderColor: c.ink8, borderRadius: radius.control, borderWidth: 1, width: '48.5%', flexGrow: 0, flexShrink: 1, gap: space[1], padding: space[3] },
    on: { borderColor: c.textPrimary, borderWidth: 2, padding: space[3] - 1 },
    packTop: { alignItems: 'center', flexDirection: 'row', gap: space[1], justifyContent: 'space-between' },
    packCredits: { ...type(20, c.textPrimary, '500'), lineHeight: 28 },
    rate: { ...type(10, c.textTertiary, '400', true), lineHeight: 12 },
    bonusOn: { color: successText },
    customHead: { alignItems: 'baseline', flexDirection: 'row', gap: space[3], justifyContent: 'space-between' },
    name: { ...type(14, c.textPrimary, '500'), lineHeight: 18 },
    off: { opacity: 0.6 },
    refillLabel: { flexShrink: 1 },
    // Tabs fill their parent's width by default; here they sit beside a label, so they take only what they need.
    refill: { alignItems: 'flex-end', flexShrink: 1, width: 'auto' },
    tile: { alignItems: 'center', borderColor: c.ink8, borderRadius: radius.md, borderWidth: 1, height: 24, justifyContent: 'center', width: 36 },
    bonusLine: { ...type(12, successText), lineHeight: 16 },
    price: { ...type(20, c.textPrimary, '500'), lineHeight: 28 },
    // Full width, as on the web.
    buy: { alignSelf: 'stretch' },
    fine: { alignItems: 'center', flexDirection: 'row', gap: space[1], justifyContent: 'center' },
  })
}
