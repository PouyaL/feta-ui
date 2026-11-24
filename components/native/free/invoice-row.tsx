import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Badge } from './badge'
import { Button } from './button'
import { rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { IconButton } from './icon-button'

export type InvoiceState = 'paid' | 'due' | 'overdue' | 'refunded'
type Tone = 'success' | 'neutral' | 'danger' | 'info'
const STATUS: Record<InvoiceState, [string, Tone]> = { paid: ['Paid', 'success'], due: ['Due', 'neutral'], overdue: ['Overdue', 'danger'], refunded: ['Refunded', 'info'] }

export type InvoiceRowProps = {
  number: string
  /** Line under the number, like Issued Oct 12. */
  date: string
  plan: string
  amount: string
  state: InvoiceState
  renderIcon: RenderIcon
  onDownload?: () => void
  onPay?: () => void
  /** Position in a list, for the 40 ms stagger. */
  index?: number
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** One invoice. Overdue turns the date danger and swaps download for Pay now. */
export function InvoiceRow({ number, date, plan, amount, state, renderIcon, onDownload, onPay, index = 0, animated = true, style }: InvoiceRowProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const [label, tone] = STATUS[state]
  return (
    <Animated.View {...(still ? {} : { entering: rowEnter(index) })} style={[styles.row, style]}>
      <View style={styles.tile}>{renderIcon('receipt', 18)}</View>
      <View style={styles.main}>
        <Text style={styles.number} numberOfLines={1}>{number}</Text>
        <Text style={[styles.date, state === 'overdue' && styles.overdue]} numberOfLines={1}>{date} · {plan}</Text>
      </View>
      <View style={styles.money}>
        <Text style={styles.amount}>{amount}</Text>
        <Badge size="sm" tone={tone} mark>{label}</Badge>
      </View>
      {state === 'overdue'
        ? <Button size="sm" shape="pill" onPress={onPay} animated={animated}>Pay now</Button>
        : <IconButton variant="ghost" size="sm" label={`Download ${number}`} icon={renderIcon('download', 16)} onPress={onDownload} animated={animated} />}
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: space[3], minHeight: 56, paddingVertical: space[2] },
  tile: { alignItems: 'center', backgroundColor: c.ink4, borderRadius: radius.field, height: 36, justifyContent: 'center', width: 36 },
  main: { flex: 1, gap: space[0.5] },
  number: type(14, c.textPrimary, '500'),
  date: type(12, c.textSecondary),
  overdue: { color: c.danger },
  money: { alignItems: 'flex-end', gap: space[1] },
  amount: type(14, c.textPrimary, '500'),
})
