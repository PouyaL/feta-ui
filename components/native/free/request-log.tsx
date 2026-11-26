import { useEffect } from 'react'
import { FlatList, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'

const ROW = 38
export type RequestEntry = { id: string; status: number | null; method: string; path: string; duration: string; time: string }
type State = 'pending' | 'success' | 'client' | 'server'
const stateOf = (status: number | null): State => (status === null ? 'pending' : status >= 500 ? 'server' : status >= 400 ? 'client' : 'success')
const NAMES: Record<State, string> = { pending: 'Pending', success: 'Success', client: 'Client error', server: 'Server error' }

export type RequestLogProps = Omit<RequestEntry, 'id'> & { animated?: boolean; style?: StyleProp<ViewStyle> }

/** One request in mono. 2xx success, 4xx warning, 5xx danger, and Pending pulses its dot. */
export function RequestLog(props: RequestLogProps) {
  return <Row {...props} />
}

/** The row; `flat` drops its own edge inside the list, which draws one surface for every row. */
function Row({ status, method, path, duration, time, animated = true, style, flat = false }: RequestLogProps & { flat?: boolean }) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const state = stateOf(status)
  // Pending pulses like the web: 1.2 s, down to 0.35 opacity and 0.8 scale at the middle.
  const beat = useSharedValue(0)
  useEffect(() => {
    if (state !== 'pending' || still) { cancelAnimation(beat); beat.value = 0; return undefined }
    beat.value = withRepeat(withTiming(1, { duration: 600, easing: Easing.inOut(Easing.ease) }), -1, true)
    return () => cancelAnimation(beat)
  }, [state, still, beat])
  const pulse = useAnimatedStyle(() => ({ opacity: 1 - beat.value * 0.65, transform: [{ scale: 1 - beat.value * 0.2 }] }))
  return (
    <View accessible accessibilityLabel={`${NAMES[state]}, ${method} ${path}, ${duration}, ${time}`} style={[styles.row, flat ? styles.flat : state === 'server' && styles.server, style]}>
      <View style={styles.status}>
        <Animated.View style={[styles.dot, state === 'server' ? styles.serverDot : styles[state], pulse]} />
        <Text style={styles.code}>{status ?? '···'}</Text>
      </View>
      <Text style={styles.method}>{method}</Text>
      <Text style={[styles.mono, styles.path]} numberOfLines={1}>{path}</Text>
      <Text style={styles.duration}>{duration}</Text>
      {/* Mobile drops the time, as the web does under 640 px, so the path keeps its room. */}
    </View>
  )
}

export type RequestLogListProps = { entries: RequestEntry[]; label?: string; animated?: boolean; style?: StyleProp<ViewStyle> }

/** A live tail of any length: FlatList renders only the rows near the viewport. */
export function RequestLogList({ entries, label = 'Requests', animated = true, style }: RequestLogListProps) {
  const { list: listStyle } = useThemed(createStyles)
  return (
    <FlatList
      accessibilityLabel={label}
      data={entries}
      keyExtractor={(entry) => entry.id}
      getItemLayout={(_, index) => ({ length: ROW, offset: ROW * index, index })}
      renderItem={({ item: { id: _id, ...entry } }) => <Row {...entry} animated={animated} flat />}
      style={[listStyle, style]}
    />
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  row: { alignItems: 'center', borderColor: c.ink8, borderRadius: radius.field, borderWidth: 1, flexDirection: 'row', gap: space[3], height: ROW, paddingHorizontal: space[3] - 1 },
  flat: { borderRadius: 0, borderWidth: 0, paddingHorizontal: space[3] },
  server: { backgroundColor: 'rgba(239,68,68,0.08)' },
  list: { backgroundColor: c.surface, borderRadius: radius.card },
  status: { alignItems: 'center', flexDirection: 'row', gap: space[1.5], width: 52 },
  dot: { borderRadius: radius.full, height: 8, width: 8 },
  pending: { backgroundColor: c.textTertiary },
  success: { backgroundColor: c.success },
  client: { backgroundColor: c.warning },
  // `server` tints the row; its dot is Danger.
  serverDot: { backgroundColor: c.danger },
  code: type(12, c.textPrimary, '600', true),
  mono: type(12, c.textPrimary, '400', true),
  method: { ...type(12, c.textSecondary, '400', true), width: 44 },
  path: { flex: 1 },
  duration: { ...type(12, c.textSecondary, '400', true), textAlign: 'right' },
})
