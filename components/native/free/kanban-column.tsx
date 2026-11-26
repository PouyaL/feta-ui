import { Children, useState, type ReactNode } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, { FadeIn } from 'react-native-reanimated'
import { radius, space, useColors, type Colors } from '../kit'
import { toneColors } from './badge'
import { Button, SELF } from './button'
import { EASE_STANDARD, panelEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { DropdownMenu, type MenuEntry } from './dropdown-menu'
import { IconButton } from './icon-button'
import type { KanbanTone } from './kanban-card'

export type KanbanColumnProps = {
  title: string
  count: number
  tone?: KanbanTone
  /** Kanban Card rows. */
  children?: ReactNode
  /** Where the dashed slot opens among the children. Unset means no slot. */
  dropIndex?: number
  dropLabel?: string
  emptyTitle?: string
  emptyHint?: string
  collapsed?: boolean
  defaultCollapsed?: boolean
  onCollapsedChange?: (collapsed: boolean) => void
  onAdd?: () => void
  /** Rows added to the column's menu, after Collapse. */
  menu?: MenuEntry[]
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

/** A 4% ink tray with a status dot, title and mono count, holding cards. */
export function KanbanColumn({ title, count, tone = 'neutral', children, dropIndex, dropLabel = 'Drop to move here', emptyTitle = 'Nothing here', emptyHint = 'Drag a card here', collapsed, defaultCollapsed = false, onCollapsedChange, onAdd, menu = [], renderIcon, animated = true, style }: KanbanColumnProps) {
  const styles = useThemed(createStyles)
  const still = useStill(animated)
  const colors = useColors()
  const [heldClosed, setHeldClosed] = useState(defaultCollapsed)
  const closed = collapsed ?? heldClosed
  const cards = Children.toArray(children)
  const slot = <Animated.View key="slot" {...(still ? {} : { entering: FadeIn.duration(120).easing(EASE_STANDARD) })} style={styles.drop}><Text style={styles.small}>{dropLabel}</Text></Animated.View>
  const list = dropIndex === undefined ? cards : [...cards.slice(0, dropIndex), slot, ...cards.slice(dropIndex)]

  function setClosed(next: boolean): void {
    setHeldClosed(next)
    onCollapsedChange?.(next)
  }

  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} accessibilityLabel={`${title}, ${count} cards`} style={[styles.column, style]}>
      <View style={styles.header}>
        <View style={[styles.dot, tone !== 'neutral' && { backgroundColor: toneColors(colors, tone).fill }]} />
        <Text style={styles.title} accessibilityRole="header" numberOfLines={1}>{title}</Text>
        <Text style={styles.count}>{count}</Text>
        {closed
          ? <IconButton style={SELF.center} variant="ghost" size="sm" animated={animated} label={`Expand ${title}`} aria-expanded={false} icon={renderIcon('arrow-down', 16)} onPress={() => setClosed(false)} />
          : <IconButton style={SELF.center} variant="ghost" size="sm" animated={animated} label={`Add a card to ${title}`} icon={renderIcon('plus', 16)} onPress={onAdd} />}
        <DropdownMenu label={`${title} actions`} align="end" animated={animated} entries={[{ label: closed ? 'Expand' : 'Collapse', onSelect: () => setClosed(!closed) }, ...menu]} trigger={(props) => <IconButton {...props} variant="ghost" size="sm" animated={animated} label={`${title} actions`} icon={renderIcon('more-horizontal', 16)} />} />
      </View>
      {closed ? null : (
        <>
          <View style={styles.cards}>
            {count === 0 && dropIndex === undefined ? (
              <View style={styles.empty}>
                {renderIcon('inbox', 20)}
                <Text style={styles.emptyTitle}>{emptyTitle}</Text>
                <Text style={styles.small}>{emptyHint}</Text>
              </View>
            ) : list}
          </View>
          <View style={styles.add}><Button variant="ghost" shape="pill" size="sm" animated={animated} leadingIcon={renderIcon('plus', 14)} onPress={onAdd}>Add card</Button></View>
        </>
      )}
    </Animated.View>
  )
}

const createStyles = (c: Colors) => StyleSheet.create({
  column: { backgroundColor: c.ink4, borderRadius: radius.panel, gap: space[2], paddingBottom: space[2], paddingHorizontal: space[1], paddingTop: space[1] },
  header: { alignItems: 'center', flexDirection: 'row', gap: space[2], minHeight: 40, paddingLeft: space[2], paddingRight: space[1.5], paddingVertical: space[1.5] },
  dot: { backgroundColor: c.textTertiary, borderRadius: radius.full, height: 8, width: 8 },
  title: { ...type(14, c.textPrimary, '500'), flexShrink: 1 },
  count: { ...type(12, c.textTertiary, '400', true), flex: 1 },
  cards: { gap: space[2] },
  drop: { alignItems: 'center', backgroundColor: c.ink8, borderColor: c.textTertiary, borderRadius: radius['2xl'], borderStyle: 'dashed', borderWidth: 1.5, height: 88, justifyContent: 'center', paddingHorizontal: space[4] },
  empty: { alignItems: 'center', borderColor: c.ink10, borderRadius: radius['2xl'], borderStyle: 'dashed', borderWidth: 1.5, gap: space[1.5], paddingHorizontal: space[4], paddingVertical: space[6] },
  emptyTitle: type(14, c.textPrimary, '500'),
  small: type(12, c.textSecondary),
  add: { alignItems: 'flex-start', paddingHorizontal: space[1] },
})
