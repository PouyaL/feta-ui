import { Fragment, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { withInk } from './button'
import { panelEnter, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { Switch } from './switch'

const ROW_STAGGER_CAP = 12
/** Under this width the table drops secondary plans and uses short names, like the web's container query. */
const NARROW = 420

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
  const solid = mark === true && home
  return (
    <View style={[styles.value, home ? styles.home : null]}>
      <View accessible accessibilityRole="image" accessibilityLabel={label} style={[styles.mark, solid ? styles.markSolid : null, mark === false ? styles.markNo : null]}>
        {mark === 'partial' ? <View style={styles.half} /> : withInk(renderIcon(mark ? 'check' : 'minus', mark ? 12 : 14), solid ? styles.inkSolid.color : mark ? styles.ink.color : styles.inkNo.color)}
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
  const [wide, setWide] = useState(0)
  const narrow = wide <= NARROW
  const shownPlans = narrow ? plans.filter((plan) => !plan.secondary) : plans
  const shown = groups.map((group) => ({ ...group, rows: only ? group.rows.filter((row) => differs(row, plans)) : group.rows })).filter((group) => group.rows.length > 0)
  let index = 0
  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} accessibilityLabel={title} onLayout={(e) => setWide(e.nativeEvent.layout.width)} style={[styles.root, style]}>
      <View style={styles.head}>
        <Text accessibilityRole="header" style={[styles.title, narrow ? styles.titleNarrow : null]}>{title}</Text>
        {typeof subtitle === 'string' ? <Text style={styles.subtitle}>{subtitle}</Text> : subtitle}
        <View style={styles.toggle}>
          <Text style={styles.toggleText}>Only differences</Text>
          <Switch checked={only} onCheckedChange={setOnly} animated={animated} accessibilityLabel="Only differences" />
        </View>
      </View>
      <View style={styles.row}>
        <View style={[styles.corner, narrow ? styles.featureNarrow : null]} />
        {shownPlans.map((plan) => (
          <View key={plan.id} style={[styles.plan, plan.home ? styles.planHome : null]}>
            <Text style={styles.planName} numberOfLines={1}>{narrow ? plan.short ?? plan.name : plan.name}</Text>
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
              <Animated.View key={row.feature} {...(still ? {} : { entering: rowEnter(at) })} style={styles.row}>
                <View style={[styles.feature, narrow ? styles.featureNarrow : null]}>
                  <Text style={[styles.featureText, narrow ? styles.featureTextNarrow : null]}>{row.feature}</Text>
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
  root: { width: '100%', maxWidth: 760, overflow: 'hidden', padding: space[4], borderRadius: radius.frame, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  head: { gap: space[2], marginBottom: space[4] },
  title: { ...type(40, c.textPrimary, '600'), lineHeight: 48 },
  titleNarrow: { fontSize: 24, lineHeight: 32, letterSpacing: -0.96 },
  subtitle: { ...type(14, c.textSecondary), lineHeight: 20 },
  toggle: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space[2] },
  toggleText: { ...type(12, c.textSecondary), lineHeight: 16 },
  row: { flexDirection: 'row', alignItems: 'stretch' },
  corner: { flexBasis: '36%', flexGrow: 0, flexShrink: 0 },
  feature: { flexBasis: '36%', flexGrow: 0, flexShrink: 0, justifyContent: 'center', minWidth: 0, paddingVertical: space[3], paddingRight: space[3], borderTopWidth: 1, borderTopColor: c.ink8 },
  featureNarrow: { flexBasis: '30%' },
  featureText: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
  featureTextNarrow: { fontSize: 14, lineHeight: 18, letterSpacing: -0.56 },
  // Sits under its feature name, left aligned like the name.
  hint: { ...type(12, c.textTertiary), lineHeight: 16 },
  plan: { flex: 1, alignItems: 'center', minWidth: 0, paddingVertical: space[3], paddingHorizontal: space[1] },
  planName: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
  price: { ...type(12, c.textTertiary), lineHeight: 16, textAlign: 'center' },
  home: { backgroundColor: c.ink4 },
  planHome: { backgroundColor: c.ink4, borderTopLeftRadius: radius.card, borderTopRightRadius: radius.card },
  group: { ...type(12, c.textTertiary), lineHeight: 16, paddingTop: space[5], paddingBottom: space[2], borderTopWidth: 1, borderTopColor: c.ink8 },
  value: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space[0.5], minWidth: 0, paddingVertical: space[2.5], paddingHorizontal: space[2], borderTopWidth: 1, borderTopColor: c.ink8 },
  mark: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden', width: 20, height: 20, borderRadius: radius.full, backgroundColor: c.ink8 },
  markSolid: { backgroundColor: c.inverse },
  markNo: { backgroundColor: 'transparent' },
  // Partial: the left half filled, the right half the 8% well.
  half: { position: 'absolute', top: 0, bottom: 0, left: 0, width: 10, backgroundColor: c.textSecondary },
  ink: { color: c.textPrimary },
  inkSolid: { color: c.textInverse },
  inkNo: { color: c.textQuaternary },
  note: { ...type(10, c.textTertiary), lineHeight: 10, letterSpacing: -0.2, textAlign: 'center' },
})
