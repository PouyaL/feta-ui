import { useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import { radius, space, type Colors } from '../kit'
import { Badge } from './badge'
import { Button } from './button'
import { Panel, PanelBody, type RenderIcon, type, useFlash, useThemed } from './card'
import { Input } from './input'
import { Slider } from './slider'
import { Switch } from './switch'

const money = (value: number): string => `$${Math.round(value).toLocaleString('en-US')}`
/** The lowest threshold. */
const THRESHOLD_FLOOR = 50

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

/** Budget alerts: budget, threshold, channels, a hard stop and a live preview of the message. */
export function SpendAlerts({ scope, resets, defaultBudget = 5000, defaultThreshold = 80, spent, forecast, email, channel, pager, edited, defaultSaved = false, renderIcon, onSave, onTest, animated = true, style }: SpendAlertsProps) {
  const styles = useThemed(createStyles)
  const [budget, setBudget] = useState(defaultBudget)
  const [threshold, setThreshold] = useState(defaultThreshold)
  const [on, setOn] = useState({ email: true, chat: true, pager: false, stop: false })
  const [saved, flash] = useFlash(2400)
  const showSaved = saved || defaultSaved
  const at = (budget * threshold) / 100
  const used = budget > 0 ? spent / budget : 0
  const rows = [
    { key: 'email' as const, icon: 'mail', title: 'Email', sub: email },
    { key: 'chat' as const, icon: 'message', title: 'Chat', sub: channel },
    { key: 'pager' as const, icon: 'bell', title: 'Pager', sub: pager },
  ]
  return (
    <Panel
      title="Spend alerts"
      subtitle={scope}
      animated={animated}
      style={style}
      actions={<View accessibilityLiveRegion="polite" style={styles.state}>{renderIcon(showSaved ? 'check-check' : 'check', 14)}<Text style={styles.small}>{showSaved ? 'Saved' : 'On track'}</Text></View>}
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
      <PanelBody>
        <View style={styles.text}><Text style={styles.title}>Monthly budget</Text><Text style={styles.small}>{resets}</Text></View>
        <Input accessibilityLabel="Monthly budget in USD" keyboardType="number-pad" value={budget.toLocaleString('en-US')} onChangeText={(text) => setBudget(Number(text.replace(/\D/g, '')) || 0)} leading={<Text style={styles.small}>$</Text>} animated={animated} />
      </PanelBody>
      <PanelBody title="Alert at" meta={`${threshold}% · ${money(at)}`}>
        <Slider label="Alert threshold" min={THRESHOLD_FLOOR} max={100} step={5} value={threshold} onValueChange={(next) => setThreshold(Array.isArray(next) ? next[0] : next)} format={(value) => `${value}%, ${money((budget * value) / 100)}`} animated={animated} />
        <View style={styles.legend}>
          <Text style={styles.small}>Spent {money(spent)}</Text>
          <Text style={styles.small}>Forecast {money(forecast.amount)} by {forecast.by}</Text>
          <Text style={styles.small}>{Math.round(used * 100)}% used</Text>
        </View>
      </PanelBody>
      <PanelBody title="Notify">
        {rows.map((row) => (
          <View key={row.key} style={styles.row}>
            {renderIcon(row.icon, 16)}
            <View style={styles.text}><Text style={styles.title}>{row.title}</Text><Text style={styles.small}>{row.sub}</Text></View>
            <Switch accessibilityLabel={`Notify by ${row.title}`} checked={on[row.key]} onCheckedChange={(next) => setOn((all) => ({ ...all, [row.key]: next }))} animated={animated} />
          </View>
        ))}
      </PanelBody>
      <PanelBody>
        <View style={styles.row}>
          <View style={styles.text}><Text style={styles.title}>Hard stop at 100%</Text><Text style={styles.small}>{on.stop ? 'Stop serving at the budget' : 'Keep serving past the budget'}</Text></View>
          <Switch accessibilityLabel="Hard stop at 100%" checked={on.stop} onCheckedChange={(next) => setOn((all) => ({ ...all, stop: next }))} animated={animated} />
        </View>
      </PanelBody>
      <PanelBody title="Chat preview" meta={channel}>
        <View style={styles.chat}>
          <View style={styles.tile}><Text style={styles.title}>N</Text></View>
          <View style={styles.text}>
            <View style={styles.row}><Text style={styles.title}>Northwind Billing</Text><Badge size="sm" mark={false}>App</Badge><Text style={styles.small}>9:41 AM</Text></View>
            <View style={styles.row}>{renderIcon('alert-02', 14)}<Text style={styles.alert}>Production passed {threshold}% of budget</Text></View>
            <Text style={styles.small}>Used {money(at)} of {money(budget)}</Text>
            <Text style={styles.small}>Forecast {money(forecast.amount)} by {forecast.by}</Text>
          </View>
        </View>
      </PanelBody>
    </Panel>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  state: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
  small: type(12, c.textSecondary),
  title: type(14, c.textPrimary, '500'),
  text: { flex: 1, gap: space[0.5] },
  actions: { flexDirection: 'row', gap: space[2] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  row: { alignItems: 'center', flexDirection: 'row', gap: space[2], minHeight: 28 },
  chat: { flexDirection: 'row', gap: space[3] },
  tile: { alignItems: 'center', backgroundColor: c.ink5, borderRadius: radius.field, height: 36, justifyContent: 'center', width: 36 },
  alert: { ...type(14, c.textPrimary), flex: 1 },
})
