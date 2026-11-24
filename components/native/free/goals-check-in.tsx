import { useEffect, useState } from 'react'
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInUp, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { Avatar, type AvatarPerson } from './avatar'
import { Button } from './button'
import { EASE_STANDARD, panelEnter, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'
import { Input } from './input'
import { Progress } from './progress'
import { Tabs } from './tabs'

const UPDATE_MS = 240
const STANDARD = Easing.bezier(0.25, 0.1, 0.25, 1)
const reveal = FadeInUp.duration(UPDATE_MS).easing(EASE_STANDARD).withInitialValues({ transform: [{ translateY: -4 }] })

export type GoalStatus = 'on-track' | 'at-risk' | 'off-track'
const STATUS: Record<GoalStatus, string> = { 'on-track': 'On track', 'at-risk': 'At risk', 'off-track': 'Off track' }

export type Goal = {
  id: string
  title: string
  owner: string
  person?: AvatarPerson
  status: GoalStatus
  progress: number
  keyResult: string
  target: string
  current: string
  note?: string
  /** Before and after this check-in, like 52% → 83%. */
  change?: string
}

export type GoalCheckIn = { id: string; value: string; status: GoalStatus; note: string }

export type GoalsCheckInProps = {
  title?: string
  /** Week and overall progress. */
  summary: string
  /** Periods to step through. */
  periods: string[]
  goals: Goal[]
  /** Footer note. */
  due: string
  /** Opens on the check-in for the first goal. */
  defaultChecking?: boolean
  onSave?: (checkIn: GoalCheckIn) => void
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

function Chevron({ open, still, renderIcon }: { open: boolean; still: boolean; renderIcon: RenderIcon }) {
  const turn = useSharedValue(open ? 1 : 0)
  useEffect(() => {
    turn.value = still ? (open ? 1 : 0) : withTiming(open ? 1 : 0, { duration: UPDATE_MS, easing: STANDARD })
  }, [open, still, turn])
  const motion = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 90}deg` }] }))
  return <Animated.View style={motion}>{renderIcon('chevron-right', 16)}</Animated.View>
}

/** Quarterly goals. Check in opens the first goal with a key result, status and a note. */
export function GoalsCheckIn({ title = 'Company goals', summary, periods, goals, due, defaultChecking = false, onSave, renderIcon, animated = true, style }: GoalsCheckInProps) {
  const styles = useThemed(makeStyles)
  const colors = useColors()
  const still = useStill(animated)
  const [period, setPeriod] = useState(0)
  const [open, setOpen] = useState<string | null>(defaultChecking ? (goals[0]?.id ?? null) : null)
  const [draft, setDraft] = useState<GoalCheckIn | null>(null)
  const current = goals.find(({ id }) => id === open)
  const value = current ? (draft?.id === current.id ? draft : { id: current.id, value: current.current, status: current.status, note: current.note ?? '' }) : null
  const patch = (next: Partial<GoalCheckIn>): void => { if (value) setDraft({ ...value, ...next }) }
  const barColor: Record<GoalStatus, string> = { 'on-track': colors.success, 'at-risk': colors.textSecondary, 'off-track': colors.danger }
  const statusText = { 'on-track': styles.onTrack, 'at-risk': styles.atRisk, 'off-track': styles.offTrack } as const

  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} style={[styles.ring, style]}>
      <View style={styles.goals}>
        <View style={styles.header}>
          <View style={styles.titles}>
            <Text accessibilityRole="header" style={styles.title}>{title}</Text>
            <Text style={styles.sub}>{summary}</Text>
          </View>
          <View style={styles.period}>
            <IconButton variant="ghost" size="sm" icon={renderIcon('chevron-left', 16)} label="Previous period" disabled={period === 0} animated={animated} onPress={() => setPeriod((p) => p - 1)} />
            <Text accessibilityLiveRegion="polite" style={styles.periodText}>{periods[period]}</Text>
            <IconButton variant="ghost" size="sm" icon={renderIcon('chevron-right', 16)} label="Next period" disabled={period === periods.length - 1} animated={animated} onPress={() => setPeriod((p) => p + 1)} />
          </View>
        </View>
        {goals.map((goal, i) => {
          const expanded = goal.id === open
          return (
            <Animated.View key={goal.id} {...(still ? {} : { entering: rowEnter(i) })} style={i > 0 ? styles.goalRule : null}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${goal.title}, ${goal.owner}, ${STATUS[goal.status]}, ${goal.progress}%`}
                aria-expanded={expanded}
                onPress={() => setOpen(expanded ? null : goal.id)}
                style={({ pressed }) => [styles.row, pressed ? styles.rowPressed : null]}
              >
                <Chevron open={expanded} still={still} renderIcon={renderIcon} />
                <View style={styles.body}>
                  <Text style={styles.name}>{goal.title}</Text>
                  <View style={styles.owner}>
                    <Avatar size="xs" {...(goal.person ? { person: goal.person } : { initials: goal.owner.slice(0, 1) })} renderIcon={renderIcon} animated={animated} />
                    <Text style={styles.sub}>{goal.owner}</Text>
                    <View style={styles.status}>
                      {renderIcon(goal.status === 'on-track' ? 'check' : 'alert-circle', 14)}
                      <Text style={[styles.sub, statusText[goal.status]]}>{STATUS[goal.status]}</Text>
                    </View>
                  </View>
                </View>
                <View style={styles.progress}>
                  <Text style={styles.percent}>{goal.progress}%</Text>
                  <Progress size="sm" value={goal.progress} label={goal.title} fillColor={barColor[goal.status]} animated={animated} />
                </View>
              </Pressable>
              {expanded && value ? (
                <Animated.View {...(still ? {} : { entering: reveal })} style={styles.panel}>
                  <View style={styles.keyResult}><Text style={styles.keyText}>{goal.keyResult}</Text><Text style={styles.target}>{goal.target}</Text></View>
                  <Input accessibilityLabel={goal.keyResult} value={value.value} onChangeText={(text: string) => patch({ value: text })} animated={animated} />
                  <Tabs label="Status" items={(Object.keys(STATUS) as GoalStatus[]).map((status) => ({ value: status, label: STATUS[status] }))} value={value.status} onValueChange={(status: string) => patch({ status: status as GoalStatus })} animated={animated} />
                  <Input accessibilityLabel="Note" placeholder="What changed?" value={value.note} onChangeText={(text: string) => patch({ note: text })} animated={animated} />
                  <View style={styles.save}>
                    <Text style={styles.change}>{goal.change}</Text>
                    <View style={styles.saveActions}>
                      <Button variant="ghost" size="sm" animated={animated} onPress={() => setOpen(null)}>Cancel</Button>
                      <Button size="sm" animated={animated} onPress={() => { onSave?.(value); setOpen(null) }}>Save check-in</Button>
                    </View>
                  </View>
                </Animated.View>
              ) : null}
            </Animated.View>
          )
        })}
        <View style={styles.footer}>
          <Text style={styles.due}>{due}</Text>
          <Button variant="secondary" size="sm" animated={animated} onPress={() => setOpen(goals[0]?.id ?? null)}>Check in</Button>
        </View>
      </View>
    </Animated.View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  ring: { width: '100%', maxWidth: 358, padding: space[1], borderRadius: radius.frame, backgroundColor: c.ink4 },
  goals: { overflow: 'hidden', borderRadius: radius.panel, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], padding: space[4], borderBottomWidth: 1, borderBottomColor: c.ink8 },
  titles: { flex: 1, minWidth: 0 },
  title: { ...type(15, c.textPrimary, '500'), lineHeight: 20 },
  sub: type(12, c.textSecondary),
  period: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  periodText: { ...type(14, c.textPrimary, '500'), fontVariant: ['tabular-nums'] },
  goalRule: { borderTopWidth: 1, borderTopColor: c.ink8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], paddingVertical: space[3], paddingLeft: space[4], paddingRight: space[4] },
  rowPressed: { backgroundColor: c.ink4 },
  body: { flex: 1, minWidth: 0, gap: space[1] },
  name: type(14, c.textPrimary, '500'),
  owner: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[1.5] },
  status: { flexDirection: 'row', alignItems: 'center', gap: space[1], marginLeft: space[1] },
  onTrack: { color: c.success },
  atRisk: { color: c.textPrimary },
  offTrack: { color: c.danger },
  progress: { alignItems: 'flex-end', gap: space[1], width: 72 },
  percent: { ...type(14, c.textPrimary, '500'), fontVariant: ['tabular-nums'] },
  panel: { gap: space[3], paddingLeft: space[10], paddingRight: space[4], paddingBottom: space[4] },
  keyResult: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space[3] },
  keyText: { ...type(14, c.textPrimary, '500'), flexShrink: 1 },
  target: type(12, c.textTertiary),
  save: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: space[3] },
  change: type(12, c.textSecondary, '400', true),
  saveActions: { flexDirection: 'row', gap: space[1] },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], paddingVertical: space[2.5], paddingHorizontal: space[4], borderTopWidth: 1, borderTopColor: c.ink8 },
  due: { ...type(12, c.textTertiary), flexShrink: 1 },
})
