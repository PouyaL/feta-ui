import { useMemo, useState } from 'react'
import { FlatList, StyleSheet, Text, View, type ListRenderItem, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { Easing, FadeInDown, FadeInUp, FadeOutUp } from 'react-native-reanimated'
import { pressedState, radius, space, type Colors } from '../kit'
import { Avatar } from './avatar'
import { type BadgeTone } from './badge'
import { Button, SELF } from './button'
import { panelEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { Checkbox } from './checkbox'
import { DropdownMenu } from './dropdown-menu'
import { IconButton } from './icon-button'
import { initials } from './member-row'

const BAR_MS = 200
// Long lists recycle fixed 56 point rows with a one line subject, as the web's long list does.
const ROW_HEIGHT = 56
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
      <View style={[styles.row, long && styles.rowLong, on ? styles.rowOn : null]}>
        <Checkbox accessibilityLabel={`Select message from ${message.from}`} checked={on} onCheckedChange={(next: boolean) => setPicked((was) => (next ? [...was, message.id] : was.filter((id) => id !== message.id)))} animated={animated} />
        <Avatar size="sm" initials={initials(message.from)} animated={animated} />
        <View style={styles.text}>
          <View style={styles.line}>
            <Text style={[styles.from, unread ? styles.unread : null]} numberOfLines={1}>{message.from}</Text>
            <Text style={styles.time}>{message.time}</Text>
          </View>
          {/* The label tag is a wide screen extra; the Mobile row is sender and time over the subject. */}
          <Text style={styles.subject} numberOfLines={long ? 1 : undefined}>{message.subject}</Text>
        </View>
      </View>
    )
  }

  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} accessibilityLabel={title} style={[styles.panel, style]}>
      <View style={[styles.head, bulk && styles.headBulk]}>
        <Checkbox accessibilityLabel="Select all" checked={all} indeterminate={bulk && !all} onCheckedChange={(on: boolean) => setPicked(on ? list.map((message) => message.id) : [])} animated={animated} />
        {bulk ? (
          <Animated.View key="bulk" {...(still ? {} : { entering: barIn, exiting: barOut })} style={styles.bar}>
            <Text accessibilityLiveRegion="polite" style={styles.title}>{picked.length} selected</Text>
            <View style={styles.actions}>
              <Button style={SELF.center} variant="secondary" size="sm" shape="pill" leadingIcon={renderIcon('archive', 14)} onPress={() => remove(onArchive)} animated={animated}>Archive</Button>
              <IconButton style={SELF.center} variant="ghost" size="sm" label="Mark read" icon={renderIcon('check-check', 16)} onPress={() => { onMarkRead?.(picked); setRead((was) => [...was, ...picked]); setPicked([]) }} animated={animated} />
              <IconButton style={SELF.center} variant="ghost" size="sm" label="Delete" icon={renderIcon('trash', 16)} onPress={() => remove(onDelete)} animated={animated} />
            </View>
          </Animated.View>
        ) : (
          <Animated.View key="title" {...(still ? {} : { entering: FadeInUp.duration(BAR_MS) })} style={styles.bar}>
            <View style={styles.titles}>
              <Text style={styles.title}>{title}</Text>
              <Text style={styles.count}>{list.length.toLocaleString('en-US')} conversations</Text>
            </View>
            <View style={styles.actions}>
              <IconButton style={SELF.center} variant="ghost" size="sm" label="Show unread only" {...pressedState(unreadOnly)} icon={renderIcon('filter', 16)} onPress={() => setUnreadOnly(!unreadOnly)} animated={animated} />
              <DropdownMenu
                label="Inbox actions"
                align="end"
                animated={animated}
                entries={[{ label: 'Mark all read', onSelect: () => { const ids = list.map((message) => message.id); onMarkRead?.(ids); setRead((was) => [...was, ...ids]) } }]}
                trigger={(props) => <IconButton {...props} style={SELF.center} variant="ghost" size="sm" label="Inbox actions" icon={renderIcon('more-horizontal', 16)} animated={animated} />}
              />
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
        {...(long ? { style: styles.scroll, getItemLayout: (_: unknown, index: number) => ({ length: ROW_HEIGHT, offset: ROW_HEIGHT * index, index }) } : {})}
      />
    </Animated.View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  panel: { width: '100%', maxWidth: 640, overflow: 'hidden', borderRadius: radius.panel, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  head: { flexDirection: 'row', alignItems: 'center', gap: space[3], minHeight: 52, paddingLeft: space[4], paddingRight: space[3], borderBottomWidth: 1, borderBottomColor: c.ink5 },
  headBulk: { backgroundColor: c.ink4 },
  bar: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space[2], minWidth: 0 },
  titles: { flexDirection: 'row', alignItems: 'baseline', gap: space[2], flexShrink: 1 },
  title: { ...type(16, c.textPrimary, '500'), lineHeight: 22 },
  count: type(12, c.textTertiary),
  actions: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  scroll: { height: VIEWPORT },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2], minHeight: 48, paddingHorizontal: space[4], paddingVertical: space[2] },
  rowLong: { height: ROW_HEIGHT },
  rowOn: { backgroundColor: c.ink4 },
  text: { flex: 1, minWidth: 0 },
  line: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  from: { ...type(16, c.textPrimary, '500'), lineHeight: 22, flex: 1 },
  unread: { fontWeight: '600' },
  subject: { ...type(14, c.textSecondary), lineHeight: 20 },
  time: type(12, c.textTertiary, '400', true),
})
