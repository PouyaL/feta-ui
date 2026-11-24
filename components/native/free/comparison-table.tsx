import { Fragment, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { panelEnter, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { Switch } from './switch'

const ROW_STAGGER_CAP = 12

export type ComparisonPlan = { id: string; name: string; short?: string; price: string; /** Washes the column. */ home?: boolean; /** Dropped first on small screens. */ secondary?: boolean }
export type ComparisonMark = boolean | 'partial' | { mark: boolean | 'partial'; note: string }
export type ComparisonRow = { feature: string; hint?: string; values: Record<string, ComparisonMark> }
export type ComparisonGroup = { label: string; rows: ComparisonRow[] }

export type ComparisonTableProps = {
  title: string
  subtitle?: ReactNode
  plans: ComparisonPlan[]
  groups: ComparisonGroup[]
  defaultDifferences?: boolean
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

const markOf = (value: ComparisonMark | undefined): boolean | 'partial' => (typeof value === 'object' ? value.mark : value ?? false)
const differs = (row: ComparisonRow, plans: ComparisonPlan[]): boolean => new Set(plans.map((plan) => JSON.stringify(row.values[plan.id] ?? false))).size > 1

function Mark({ value, home, renderIcon }: { value: ComparisonMark | undefined; home: boolean; renderIcon: RenderIcon }) {
  const styles = useThemed(makeStyles)
  const mark = markOf(value)
  const label = mark === 'partial' ? 'Partial' : mark ? 'Yes' : 'No'
  return (
    <View style={[styles.value, home ? styles.home : null]}>
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.mark, mark === true ? styles.markYes : null, mark === 'partial' ? styles.markPartial : null]}>
        {mark === 'partial' ? null : renderIcon(mark ? 'check' : 'minus', mark ? 12 : 14)}
      </View>
      {typeof value === 'object' ? <Text style={styles.note}>{value.note}</Text> : null}
    </View>
  )
}

/** Plans as columns with yes, no and partial marks. Marks repeat as icons and labels, never color alone. */
export function ComparisonTable({ title, subtitle, plans, groups, defaultDifferences = false, renderIcon, animated = true, style }: ComparisonTableProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [only, setOnly] = useState(defaultDifferences)
  const shownPlans = plans.filter((plan) => !plan.secondary)
  const shown = groups.map((group) => ({ ...group, rows: only ? group.rows.filter((row) => differs(row, plans)) : group.rows })).filter((group) => group.rows.length > 0)
  let index = 0
  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} accessibilityLabel={title} style={[styles.root, style]}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>
        {typeof subtitle === 'string' ? <Text style={styles.subtitle}>{subtitle}</Text> : subtitle}
        <View style={styles.toggle}>
          <Text style={styles.toggleText}>Only differences</Text>
          <Switch checked={only} onCheckedChange={setOnly} animated={animated} accessibilityLabel="Only differences" />
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.feature} />
        {shownPlans.map((plan) => (
          <View key={plan.id} style={[styles.plan, plan.home ? styles.home : null]}>
            <Text style={styles.planName} numberOfLines={1}>{plan.short ?? plan.name}</Text>
            <Text style={styles.price} numberOfLines={1}>{plan.price}</Text>
          </View>
        ))}
      </View>
      {shown.map((group) => (
        <Fragment key={group.label || 'top'}>
          {group.label ? <Text accessibilityRole="header" style={styles.group}>{group.label}</Text> : null}
          {group.rows.map((row) => {
            const at = index % ROW_STAGGER_CAP
            index += 1
            return (
              <Animated.View key={row.feature} {...(still ? {} : { entering: rowEnter(at) })} style={[styles.row, styles.rowRule]}>
                <View style={styles.feature}>
                  <Text style={styles.featureText}>{row.feature}</Text>
                  {row.hint ? <Text style={styles.hint}>{row.hint}</Text> : null}
                </View>
                {shownPlans.map((plan) => <Mark key={plan.id} value={row.values[plan.id]} home={plan.home ?? false} renderIcon={renderIcon} />)}
              </Animated.View>
            )
          })}
        </Fragment>
      ))}
    </Animated.View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  root: { width: '100%', overflow: 'hidden', borderRadius: radius.panel, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  head: { gap: space[1], padding: space[4] },
  title: { ...type(16, c.textPrimary, '600'), lineHeight: 22 },
  subtitle: type(13, c.textSecondary),
  toggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[3], minHeight: 44 },
  toggleText: type(14, c.textPrimary),
  row: { flexDirection: 'row', alignItems: 'stretch' },
  rowRule: { borderTopWidth: 1, borderTopColor: c.ink5 },
  feature: { flex: 2, justifyContent: 'center', minWidth: 0, paddingVertical: space[2.5], paddingLeft: space[4], paddingRight: space[2] },
  featureText: type(13, c.textPrimary),
  plan: { flex: 1, alignItems: 'center', minWidth: 0, paddingVertical: space[2.5], paddingHorizontal: space[1] },
  planName: type(13, c.textPrimary, '500'),
  price: type(12, c.textSecondary),
  home: { backgroundColor: c.ink4 },
  group: { ...type(11, c.textTertiary, '400', true), paddingTop: space[4], paddingBottom: space[1], paddingHorizontal: space[4] },
  value: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[0.5], minWidth: 0, paddingVertical: space[2.5], paddingHorizontal: space[1] },
  mark: { alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: radius.full, backgroundColor: c.ink5 },
  markYes: { backgroundColor: c.ink10 },
  markPartial: { borderWidth: 2, borderColor: c.ink10, backgroundColor: 'transparent' },
  note: { ...type(11, c.textTertiary), textAlign: 'center' },
  // Sits under its feature name, left aligned like the name.
  hint: type(11, c.textTertiary),
})
