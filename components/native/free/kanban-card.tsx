import type { ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Avatar } from './avatar'
import { Badge } from './badge'
import { rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { initials } from './member-row'

export type KanbanTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'accent'

export type KanbanCardProps = {
  /** The tracker id, shown in mono. */
  id: string
  title: string
  tag?: { label: string; tone?: KanbanTone }
  assignee?: { name: string; src?: string }
  due?: string
  comments?: number
  subtasks?: [done: number, total: number]
  done?: boolean
  /** Forces a pose for previews. */
  state?: 'dragging'
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** One card: tag and id, a two line title, then assignee, due date, comments and subtasks. */
export function KanbanCard({ id, title, tag, assignee, due, comments, subtasks, done = false, state, renderIcon, animated = true, style }: KanbanCardProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const stat = (icon: string, label: string, children: ReactNode, mono = false): ReactNode => (
    <View accessible accessibilityLabel={label} style={styles.stat}>{renderIcon(icon, 12)}<Text style={mono ? styles.mono : styles.small}>{children}</Text></View>
  )
  return (
    <Animated.View {...(still ? {} : { entering: rowEnter() })} style={[styles.card, state === 'dragging' && styles.dragging, style]}>
      <View style={styles.top}>
        {tag ? <Badge size="sm" tone={tag.tone ?? 'neutral'} mark animated={animated}>{tag.label}</Badge> : <View />}
        <Text style={styles.mono}>{id}</Text>
      </View>
      <View style={styles.titleRow}>
        {done ? <View accessible accessibilityLabel="Done">{renderIcon('check', 16)}</View> : null}
        <Text style={[styles.title, done && styles.doneTitle]} numberOfLines={2}>{title}</Text>
      </View>
      <View style={styles.meta}>
        {assignee ? <View accessible accessibilityLabel={`Assigned to ${assignee.name}`}><Avatar initials={initials(assignee.name)} {...(assignee.src ? { src: assignee.src } : {})} size="xs" animated={animated} /></View> : null}
        {due ? stat('calendar', `Due ${due}`, due) : null}
        {comments === undefined ? null : stat('message', `${comments} comments`, comments)}
        {subtasks ? <View style={styles.end}>{stat('check-check', `${subtasks[0]} of ${subtasks[1]} subtasks`, `${subtasks[0]}/${subtasks[1]}`, true)}</View> : null}
      </View>
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  card: { backgroundColor: c.surface, borderColor: c.ink8, borderRadius: radius.control, borderWidth: StyleSheet.hairlineWidth, gap: space[2], padding: space[3] },
  dragging: { transform: [{ rotate: '2deg' }] },
  top: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  titleRow: { flexDirection: 'row', gap: space[1.5] },
  title: { ...type(14, c.textPrimary, '500'), flex: 1 },
  doneTitle: { color: c.textSecondary },
  meta: { alignItems: 'center', flexDirection: 'row', gap: space[2] },
  stat: { alignItems: 'center', flexDirection: 'row', gap: space[1] },
  small: type(12, c.textSecondary),
  mono: type(12, c.textTertiary, '400', true),
  end: { marginLeft: 'auto' },
})
