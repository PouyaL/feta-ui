import { useEffect } from 'react'
import { FlatList, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { type, useStill, useThemed } from './card'

const ROW = 44
export type RequestEntry = { id: string; status: number | null; method: string; path: string; duration: string; time: string }
type State = 'pending' | 'success' | 'client' | 'server'
const stateOf = (status: number | null): State => (status === null ? 'pending' : status >= 500 ? 'server' : status >= 400 ? 'client' : 'success')
const NAMES: Record<State, string> = { pending: 'Pending', success: 'Success', client: 'Client error', server: 'Server error' }

export type RequestLogProps = Omit<RequestEntry, 'id'> & { animated?: boolean; style?: StyleProp<ViewStyle> }

/** One request in mono. 2xx success, 4xx warning, 5xx danger, and Pending pulses its dot. */
export function RequestLog({ status, method, path, duration, time, animated = true, style }: RequestLogProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const state = stateOf(status)
  const opacity = useSharedValue(1)
  useEffect(() => {
    if (state !== 'pending' || still) { cancelAnimation(opacity); opacity.value = 1; return undefined }
    opacity.value = withRepeat(withTiming(0.3, { duration: 700, easing: Easing.inOut(Easing.ease) }), -1, true)
    return () => cancelAnimation(opacity)
  }, [state, still, opacity])
  const pulse = useAnimatedStyle(() => ({ opacity: opacity.value }))
  return (
    <View accessible accessibilityLabel={`${NAMES[state]}, ${method} ${path}, ${duration}, ${time}`} style={[styles.row, style]}>
      <View style={styles.status}>
        <Animated.View style={[styles.dot, state === 'success' && styles.dotSuccess, (state === 'client' || state === 'server') && styles.dotDanger, pulse]} />
        <Text style={styles.mono}>{status ?? '···'}</Text>
      </View>
      <Text style={styles.mono}>{method}</Text>
      <Text style={[styles.mono, styles.path]} numberOfLines={1}>{path}</Text>
      <Text style={styles.dim}>{duration}</Text>
      <Text style={styles.dim}>{time}</Text>
    </View>
  )
}

export type RequestLogListProps = { entries: RequestEntry[]; label?: string; animated?: boolean; style?: StyleProp<ViewStyle> }

/** A live tail of any length: FlatList renders only the rows near the viewport. */
export function RequestLogList({ entries, label = 'Requests', animated = true, style }: RequestLogListProps) {
  return (
    <FlatList
      accessibilityLabel={label}
      data={entries}
      keyExtractor={(entry) => entry.id}
      getItemLayout={(_, index) => ({ length: ROW, offset: ROW * index, index })}
      renderItem={({ item: { id: _id, ...entry } }) => <RequestLog {...entry} animated={animated} />}
      style={style}
    />
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: space[3], height: ROW, paddingHorizontal: space[3] },
  status: { alignItems: 'center', flexDirection: 'row', gap: space[1.5], width: 52 },
  dot: { backgroundColor: c.textTertiary, borderRadius: radius.full, height: 6, width: 6 },
  dotSuccess: { backgroundColor: c.success },
  dotDanger: { backgroundColor: c.danger },
  mono: type(12, c.textPrimary, '400', true),
  path: { flex: 1 },
  dim: type(12, c.textTertiary, '400', true),
})
