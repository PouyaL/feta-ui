import { useRef, useState } from 'react'
import { StyleSheet, Text, View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native'
import { Gesture, GestureDetector } from 'react-native-gesture-handler'
import { radius, space, useColors, type Colors } from '../kit'
import { Badge } from './badge'
import { Button, withInk } from './button'
import { Panel, PanelBody, type RenderIcon, type, useFlash, useThemed } from './card'
import { Input } from './input'
import { Switch } from './switch'

const money = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`
const cents = (value: number): string => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
/** The lowest threshold, marked on the track. */
const THRESHOLD_FLOOR = 50
const STEP = 5
const THUMB = 16

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
  /** Shows the confirmed state, as after a save. */
  defaultSaved?: boolean
  renderIcon: RenderIcon
  onSave?: (settings: { budget: number; threshold: number }) => void
  onTest?: () => void
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** The threshold track: the web's Warning meter with a mark at the floor, and a white thumb that drags in 5% steps. */
function Threshold({ value, onChange, label }: { value: number; onChange: (next: number) => void; label: string }) {
  const styles = useThemed(createStyles)
  const [width, setWidth] = useState(0)
  const grabbed = useRef(value)
  const at = (x: number): number => Math.min(100, Math.max(THRESHOLD_FLOOR, Math.round(((x / Math.max(1, width)) * 100) / STEP) * STEP))
  const tap = Gesture.Tap().runOnJS(true).onEnd((e) => onChange(at(e.x)))
  const pan = Gesture.Pan().runOnJS(true).minDistance(2)
    .onBegin(() => { grabbed.current = value })
    .onUpdate((e) => onChange(at((grabbed.current / 100) * width + e.translationX)))
  const left = (value / 100) * width
  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel="Alert threshold"
        aria-valuemin={THRESHOLD_FLOOR}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={label}
        accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
        onAccessibilityAction={(e) => onChange(Math.min(100, Math.max(THRESHOLD_FLOOR, value + (e.nativeEvent.actionName === 'increment' ? STEP : -STEP))))}
        onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}
        style={styles.track}
      >
        <View style={styles.bar}>
          <View style={[styles.fill, { width: left }]} />
          <View style={[styles.mark, { left: (THRESHOLD_FLOOR / 100) * width - 1 }]} />
        </View>
        <View style={[styles.thumb, { left: Math.min(Math.max(0, left - THUMB / 2), Math.max(0, width - THUMB)) }]} />
      </View>
    </GestureDetector>
  )
}

/** Budget alerts: budget, threshold, channels, a hard stop and a live preview of the message. */
export function SpendAlerts({ scope, resets, defaultBudget = 5000, defaultThreshold = 80, spent, forecast, email, channel, pager, edited, defaultSaved = false, renderIcon, onSave, onTest, animated = true, style }: SpendAlertsProps) {
  const styles = useThemed(createStyles)
  const colors = useColors()
  const [budget, setBudget] = useState(defaultBudget)
  const [threshold, setThreshold] = useState(defaultThreshold)
  const [on, setOn] = useState({ email: true, chat: true, pager: false, stop: false })
  const [saved, flash] = useFlash(2400)
  const showSaved = saved || defaultSaved
  const at = (budget * threshold) / 100
  const used = budget > 0 ? spent / budget : 0
  const health = used >= 1 ? 'Over budget' : forecast.amount > budget ? 'Forecast over budget' : 'On track'
  const healthy = health === 'On track'
  const tone = showSaved || healthy ? colors.success : colors.warning
  const rows = [
    { key: 'email' as const, icon: 'mail', title: 'Email', sub: email },
    { key: 'chat' as const, icon: 'message', title: 'Chat', sub: channel },
    { key: 'pager' as const, icon: 'bell', title: 'Pager', sub: pager },
  ]
  return (
    <Panel
      label="Spend alerts"
      animated={animated}
      style={style}
      footer={(
        <>
          <Text style={styles.small}>{edited}</Text>
          <View style={styles.actions}>
            <Button variant="secondary" size="sm" shape="pill" onPress={onTest} animated={animated}>Send test</Button>
            <Button size="sm" shape="pill" onPress={() => { onSave?.({ budget, threshold }); flash() }} animated={animated}>{showSaved ? 'Saved' : 'Save'}</Button>
          </View>
        </>
      )}
    >
      {/* Mobile header, as the web at 390: title, scope, then the health line under them. */}
      <View style={styles.head}>
        <Text style={styles.headTitle} accessibilityRole="header">Spend alerts</Text>
        <Text style={styles.headScope}>{scope}</Text>
        <View accessibilityLiveRegion="polite" style={styles.state}>{withInk(renderIcon(showSaved ? 'check-check' : healthy ? 'check' : 'alert-02', 14), tone)}<Text style={[styles.stateText, { color: tone }]}>{showSaved ? 'Saved' : health}</Text></View>
      </View>
      <PanelBody>
        <View style={styles.text}><Text style={styles.title}>Monthly budget</Text><Text style={styles.small}>{resets}</Text></View>
        <Input accessibilityLabel="Monthly budget in USD" keyboardType="number-pad" value={budget.toLocaleString('en-US')} onChangeText={(text) => setBudget(Number(text.replace(/\D/g, '')) || 0)} leading={<Text style={styles.currency}>$</Text>} animated={animated} />
      </PanelBody>
      <PanelBody title="Alert at" meta={<Text style={styles.at}>{threshold}% · {money(at)}</Text>}>
        <View>
          <Threshold value={threshold} onChange={setThreshold} label={`${threshold}%, ${money(at)}`} />
          <View aria-hidden style={styles.ticks}>
            <Text style={[styles.tick, { right: `${100 - THRESHOLD_FLOOR}%` }]}>{THRESHOLD_FLOOR}%</Text>
            {threshold === 100 ? null : <Text style={[styles.tick, styles.tickNow, { right: `${100 - threshold}%` }]}>{threshold}%</Text>}
            <Text style={[styles.tick, { right: 0 }]}>100%</Text>
          </View>
        </View>
        {/* Mobile keeps Spent and the share used; the forecast lives in the chat preview, as on the web under 480. */}
        <View style={styles.legend}>
          <View style={styles.spent}><View style={styles.dot} /><Text style={styles.small}>Spent {cents(spent)}</Text></View>
          <Text style={styles.percent}>{Math.round(used * 100)}% used</Text>
        </View>
      </PanelBody>
      <PanelBody title="Notify">
        <View style={styles.rows}>
          {rows.map((row) => (
            <View key={row.key} style={styles.row}>
              {renderIcon(row.icon, 16)}
              <View style={styles.text}><Text style={styles.title}>{row.title}</Text><Text numberOfLines={1} style={styles.small}>{row.sub}</Text></View>
              <Switch accessibilityLabel={`Notify by ${row.title}`} checked={on[row.key]} onCheckedChange={(next) => setOn((all) => ({ ...all, [row.key]: next }))} animated={animated} />
            </View>
          ))}
        </View>
      </PanelBody>
      <PanelBody>
        <View style={styles.row}>
          <View style={styles.text}><Text style={styles.title}>Hard stop at 100%</Text><Text style={styles.small}>{on.stop ? 'Stop serving at the budget' : 'Keep serving past the budget'}</Text></View>
          <Switch accessibilityLabel="Hard stop at 100%" checked={on.stop} onCheckedChange={(next) => setOn((all) => ({ ...all, stop: next }))} animated={animated} />
        </View>
      </PanelBody>
      <PanelBody title="Chat preview" meta={<Text style={styles.channel}>{channel}</Text>}>
        <View style={styles.chat}>
          <View style={styles.tile}><Text style={styles.tileText}>N</Text></View>
          <View style={styles.message}>
            <View style={styles.sender}><Text style={styles.title}>Northwind Billing</Text><Badge size="sm" mark={false}>App</Badge><Text style={[styles.small, styles.time]}>9:41 AM</Text></View>
            <View style={styles.alertRow}><View style={styles.alertIcon}>{withInk(renderIcon('alert-02', 14), colors.danger)}</View><Text style={styles.alert}>Production passed {threshold}% of budget</Text></View>
            <View style={styles.facts}>
              <View><Text style={styles.dt}>Used</Text><Text style={styles.dd}>{money(at)} of {money(budget)}</Text></View>
              <View><Text style={styles.dt}>Forecast</Text><Text style={styles.dd}>{money(forecast.amount)} by {forecast.by}</Text></View>
            </View>
          </View>
        </View>
      </PanelBody>
    </Panel>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  head: { gap: space[0.5], padding: space[4] },
  headTitle: type(16, c.textPrimary, '500'),
  headScope: type(14, c.textSecondary),
  state: { alignItems: 'center', flexDirection: 'row', gap: space[1], paddingTop: space[1.5] },
  stateText: { ...type(14, c.success, '500'), lineHeight: 20 },
  small: { ...type(12, c.textSecondary), lineHeight: 16 },
  currency: type(16, c.textSecondary),
  title: { ...type(14, c.textPrimary, '500'), lineHeight: 18 },
  text: { flex: 1, minWidth: 0 },
  at: { ...type(14, c.textPrimary), lineHeight: 20 },
  channel: { ...type(12, c.textTertiary), lineHeight: 16 },
  actions: { flexDirection: 'row', gap: space[2] },
  track: { height: 20, justifyContent: 'center' },
  bar: { backgroundColor: c.ink8, borderRadius: radius.full, height: 6, overflow: 'hidden' },
  fill: { backgroundColor: c.warning, bottom: 0, left: 0, position: 'absolute', top: 0 },
  mark: { backgroundColor: c.surface, bottom: 0, position: 'absolute', top: 0, width: 2 },
  thumb: {
    backgroundColor: c.surface, borderColor: c.ink10, borderRadius: radius.full, borderWidth: 1, height: THUMB, position: 'absolute', top: 2, width: THUMB,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4,
  },
  ticks: { height: 14, marginTop: space[1] },
  tick: { ...type(10, c.textTertiary), letterSpacing: -0.2, lineHeight: 14, position: 'absolute', top: 0 },
  tickNow: { color: c.textPrimary, fontWeight: '500' },
  legend: { alignItems: 'center', flexDirection: 'row', gap: space[4] },
  spent: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  dot: { backgroundColor: c.textPrimary, borderRadius: radius.full, height: 6, width: 6 },
  percent: { ...type(12, c.textTertiary), lineHeight: 16, marginLeft: 'auto' },
  rows: { gap: space[2.5] },
  row: { alignItems: 'center', flexDirection: 'row', gap: space[2], minHeight: 28 },
  chat: { borderColor: c.ink8, borderRadius: radius.control, borderWidth: 1, flexDirection: 'row', gap: space[2], padding: space[3] },
  tile: { alignItems: 'center', backgroundColor: c.inverse, borderRadius: radius.lg, height: 28, justifyContent: 'center', width: 28 },
  tileText: type(12, c.textInverse, '500'),
  message: { flex: 1, minWidth: 0 },
  sender: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: space[1.5] },
  time: { width: '100%' },
  alertRow: { alignItems: 'flex-start', flexDirection: 'row', gap: space[1.5], marginBottom: space[2], marginTop: space[1] },
  alertIcon: { paddingTop: 3 },
  alert: { ...type(14, c.textPrimary), flex: 1, lineHeight: 20 },
  facts: { gap: space[2], marginLeft: space[5] },
  dt: { ...type(12, c.textTertiary), lineHeight: 16 },
  dd: { ...type(14, c.textPrimary), lineHeight: 18 },
})
