import { useMemo, useState } from 'react'
import { FlatList, StyleSheet, Text, View, type ListRenderItem, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown, FadeInUp, FadeOutUp } from 'react-native-reanimated'
import { pressedState, radius, space, type Colors } from '../kit'
import { Avatar } from './avatar'
import { Badge, type BadgeTone } from './badge'
import { Button } from './button'
import { panelEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { Checkbox } from './checkbox'
import { IconButton } from './icon-button'

const BAR_MS = 200
const ROW_HEIGHT = 64
const VIEWPORT = 420
const WINDOW_AFTER = 50
const BAR_EASE = Easing.bezierFn(0.23, 1, 0.32, 1)
const barIn = FadeInDown.duration(BAR_MS).easing(BAR_EASE).withInitialValues({ transform: [{ translateY: 4 }] })
const barOut = FadeOutUp.duration(BAR_MS).easing(BAR_EASE)

export type InboxMessage = { id: string; from: string; subject: string; time: string; label?: string; tone?: BadgeTone; unread?: boolean }

export type InboxBulkActionsProps = {
  messages: InboxMessage[]
  title?: string
  defaultSelected?: string[]
  onArchive?: (ids: string[]) => void
  onMarkRead?: (ids: string[]) => void
  onDelete?: (ids: string[]) => void
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A message list. Selecting rows swaps the header for a bulk toolbar. Long lists recycle their rows. */
export function InboxBulkActions({ messages, title = 'Inbox', defaultSelected = [], onArchive, onMarkRead, onDelete, renderIcon, animated = true, style }: InboxBulkActionsProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const [picked, setPicked] = useState(defaultSelected)
  const [gone, setGone] = useState<string[]>([])
  const [read, setRead] = useState<string[]>([])
  const [unreadOnly, setUnreadOnly] = useState(false)
  const list = useMemo(() => messages.filter((message) => !gone.includes(message.id) && (!unreadOnly || (message.unread && !read.includes(message.id)))), [messages, gone, unreadOnly, read])
  const bulk = picked.length > 0
  const all = list.length > 0 && picked.length === list.length
  const long = list.length > WINDOW_AFTER
  const remove = (run?: (ids: string[]) => void): void => {
    run?.(picked)
    setGone((was) => [...was, ...picked])
    setPicked([])
  }
  const row: ListRenderItem<InboxMessage> = ({ item: message }) => {
    const on = picked.includes(message.id)
    const unread = message.unread && !read.includes(message.id)
    return (
      <View style={[styles.row, on ? styles.rowOn : null]}>
        <Checkbox accessibilityLabel={`Select message from ${message.from}`} checked={on} onCheckedChange={(next: boolean) => setPicked((was) => (next ? [...was, message.id] : was.filter((id) => id !== message.id)))} animated={animated} />
        <Avatar size="sm" initials={message.from.slice(0, 1)} animated={animated} />
        <View style={styles.text}>
          <View style={styles.line}>
            <Text style={[styles.from, unread ? styles.unread : null]} numberOfLines={1}>{message.from}</Text>
            <Text style={styles.time}>{message.time}</Text>
          </View>
          <View style={styles.line}>
            {message.label ? <Badge size="sm" tone={message.tone ?? 'neutral'} animated={animated}>{message.label}</Badge> : null}
            <Text style={[styles.subject, unread ? styles.unread : null]} numberOfLines={1}>{message.subject}</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} accessibilityLabel={title} style={[styles.panel, style]}>
      <View style={styles.head}>
        <Checkbox accessibilityLabel="Select all" checked={all} indeterminate={bulk && !all} onCheckedChange={(on: boolean) => setPicked(on ? list.map((message) => message.id) : [])} animated={animated} />
        {bulk ? (
          <Animated.View key="bulk" {...(still ? {} : { entering: barIn, exiting: barOut })} style={styles.bar}>
            <Text accessibilityLiveRegion="polite" style={styles.title}>{picked.length} selected</Text>
            <View style={styles.actions}>
              <Button variant="secondary" size="sm" shape="pill" leadingIcon={renderIcon('archive', 14)} onPress={() => remove(onArchive)} animated={animated}>Archive</Button>
              <IconButton variant="ghost" size="sm" label="Mark read" icon={renderIcon('check-check', 16)} onPress={() => { onMarkRead?.(picked); setRead((was) => [...was, ...picked]); setPicked([]) }} animated={animated} />
              <IconButton variant="ghost" size="sm" label="Delete" icon={renderIcon('trash', 16)} onPress={() => remove(onDelete)} animated={animated} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="title" {...(still ? {} : { entering: FadeInUp.duration(BAR_MS) })} style={styles.bar}>
            <View style={styles.titles}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.count}>{list.length.toLocaleString('en-US')} conversations</Text>
            </View>
            <View style={styles.actions}>
              <IconButton variant="ghost" size="sm" label="Show unread only" {...pressedState(unreadOnly)} icon={renderIcon('filter', 16)} onPress={() => setUnreadOnly(!unreadOnly)} animated={animated} />
              <IconButton variant="ghost" size="sm" label="Mark all read" icon={renderIcon('check-check', 16)} onPress={() => { const ids = list.map((message) => message.id); onMarkRead?.(ids); setRead((was) => [...was, ...ids]) }} animated={animated} />
            </View>
          </Animated.View>
        )}
      </View>
      <FlatList
        data={list}
        keyExtractor={(message) => message.id}
        renderItem={row}
        extraData={[picked, read]}
        scrollEnabled={long}
        getItemLayout={(_, index) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index })}
        {...(long ? { style: styles.scroll } : {})}
      />
    </Animated.View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  panel: { width: '100%', maxWidth: 640, overflow: 'hidden', borderRadius: radius.panel, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[2], minHeight: 56, paddingHorizontal: space[3], borderBottomWidth: 1, borderBottomColor: c.ink8 },
  bar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], minWidth: 0 },
  titles: { flexShrink: 1 },
  title: type(14, c.textPrimary, '500'),
  count: type(12, c.textSecondary),
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  scroll: { height: VIEWPORT },
  row: { flexDirection: 'row', alignItems: 'center', gap: space[2], height: ROW_HEIGHT, paddingHorizontal: space[3], borderBottomWidth: 1, borderBottomColor: c.ink5 },
  rowOn: { backgroundColor: c.ink4 },
  text: { flex: 1, minWidth: 0, gap: space[0.5] },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  from: { ...type(13, c.textSecondary), flex: 1 },
  subject: { ...type(13, c.textSecondary), flex: 1 },
  unread: { fontWeight: '500', color: c.textPrimary },
  time: type(12, c.textTertiary, '400', true),
})
