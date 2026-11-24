import { useMemo, useState } from 'react'
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated from 'react-native-reanimated'
import { radius, space, type Colors } from '../kit'
import { Avatar, type AvatarPerson } from './avatar'
import { Badge, type BadgeTone } from './badge'
import { Button } from './button'
import { panelEnter, rowEnter, type RenderIcon, type, useStill, useThemed } from './card'
import { Tabs } from './tabs'
import { VoteButton } from './vote-button'

export type FeatureStatus = 'Planned' | 'In progress' | 'Shipped' | 'Under review'

const STATUS_TONE: Record<FeatureStatus, BadgeTone> = { Planned: 'info', 'In progress': 'warning', Shipped: 'success', 'Under review': 'neutral' }

export type FeatureRequest = {
  id: string
  title: string
  description?: string
  /** Total votes, including this person's. */
  votes: number
  /** This person has voted. */
  voted?: boolean
  status: FeatureStatus
  comments: number
  category?: string
  author?: { name: string; person?: AvatarPerson; ago: string }
  /** Days old, for the New tab. */
  age?: number
  /** Votes this week, for the Trending tab. */
  momentum?: number
}

export type FeatureVotingProps = {
  /** Compact is a short top list. Board adds descriptions and categories. Default `compact`. */
  styleKind?: 'compact' | 'board'
  title: string
  description?: string
  items: FeatureRequest[]
  /** The button in the header. Default `Suggest`. */
  suggestShortLabel?: string
  onSuggest?: () => void
  /** Default `Vote on what your team needs most.`. */
  footer?: string
  onVote?: (id: string, voted: boolean) => void
  renderIcon: RenderIcon
  animated?: boolean
  style?: StyleProp<ViewStyle>
}

type Tab = { value: string; label: string; filter?: FeatureStatus; sort: (a: FeatureRequest, b: FeatureRequest) => number }

const TOP = (a: FeatureRequest, b: FeatureRequest): number => b.votes - a.votes

/** A feature request board: vote counters, status and comments, filtered by tabs. */
export function FeatureVoting({ styleKind = 'compact', title, description, items, suggestShortLabel = 'Suggest', onSuggest, footer = 'Vote on what your team needs most.', onVote, renderIcon, animated = true, style }: FeatureVotingProps) {
  const styles = useThemed(makeStyles)
  const still = useStill(animated)
  const board = styleKind === 'board'
  const tabs = useMemo<Tab[]>(() => {
    if (!board) return [{ value: 'top', label: 'Top', sort: TOP }, { value: 'new', label: 'New', sort: (a, b) => (a.age ?? 0) - (b.age ?? 0) }, { value: 'trending', label: 'Trending', sort: (a, b) => (b.momentum ?? 0) - (a.momentum ?? 0) }]
    const count = (status: FeatureStatus): number => items.filter((item) => item.status === status).length
    return [{ value: 'all', label: `All ${items.length}`, sort: TOP }, ...(['Under review', 'Planned', 'In progress'] as const).map((filter) => ({ value: filter, label: `${filter} ${count(filter)}`, filter, sort: TOP }))]
  }, [board, items])
  const [tab, setTab] = useState(tabs[0]?.value ?? 'top')
  const active = tabs.find(({ value }) => value === tab) ?? tabs[0]
  const shown = items.filter((item) => !active?.filter || item.status === active.filter).sort(active?.sort ?? TOP)

  return (
    <Animated.View {...(still ? {} : { entering: panelEnter })} style={[styles.ring, style]}>
      <View style={styles.voting}>
        <View style={styles.header}>
          <View style={styles.top}>
            <View style={styles.titles}>
              <Text accessibilityRole="header" style={[styles.title, board ? styles.titleBoard : null]}>{title}</Text>
              {description ? <Text style={styles.description}>{description}</Text> : null}
            </View>
            <Button size="sm" leadingIcon={renderIcon('plus', 16)} animated={animated} {...(onSuggest ? { onPress: onSuggest } : {})}>{suggestShortLabel}</Button>
          </View>
          <Tabs items={tabs.map(({ value, label }) => ({ value, label }))} value={tab} onValueChange={setTab} label="Sort requests" animated={animated} />
        </View>
        <View key={tab}>
          {shown.map((item, i) => (
            <Animated.View key={item.id} {...(still ? {} : { entering: rowEnter(i) })} style={[styles.row, i > 0 ? styles.rowRule : null]}>
              <VoteButton count={item.votes - (item.voted ? 1 : 0)} defaultVoted={item.voted ?? false} label={`Vote for ${item.title}`} animated={animated} onVotedChange={(voted) => onVote?.(item.id, voted)} />
              <View style={styles.text}>
                <Text style={styles.name}>{item.title}</Text>
                {board && item.description ? <Text style={styles.summary}>{item.description}</Text> : null}
                <View style={styles.meta}>
                  <Badge size="sm" tone={STATUS_TONE[item.status]} animated={animated}>{item.status}</Badge>
                  <View accessible accessibilityLabel={`${item.comments} comments`} style={styles.comments}>{renderIcon('message', 14)}<Text style={styles.summary}>{item.comments}</Text></View>
                  {board && item.author ? (
                    <View style={styles.author}>
                      <Avatar size="xs" {...(item.author.person ? { person: item.author.person } : { initials: item.author.name.slice(0, 1) })} renderIcon={renderIcon} animated={animated} />
                      <Text style={styles.authorText}>{item.author.name} · {item.author.ago}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            </Animated.View>
          ))}
        </View>
        <Text style={styles.footer}>{footer}</Text>
      </View>
    </Animated.View>
  )
}

const makeStyles = (c: Colors) => StyleSheet.create({
  ring: { width: '100%', maxWidth: 358, padding: space[1], borderRadius: radius.frame, backgroundColor: c.ink4 },
  voting: { overflow: 'hidden', borderRadius: radius.panel, borderWidth: 1, borderColor: c.ink8, backgroundColor: c.surface },
  header: { gap: space[3], paddingTop: space[4], paddingHorizontal: space[4], paddingBottom: space[3], borderBottomWidth: 1, borderBottomColor: c.ink8 },
  top: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space[3] },
  titles: { flex: 1, minWidth: 0 },
  title: { ...type(15, c.textPrimary, '500'), lineHeight: 20 },
  titleBoard: { ...type(22, c.textPrimary, '600'), lineHeight: 28 },
  description: type(12, c.textSecondary),
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[3], paddingVertical: space[3], paddingHorizontal: space[4] },
  rowRule: { borderTopWidth: 1, borderTopColor: c.ink8 },
  text: { flex: 1, minWidth: 0, gap: space[1] },
  name: type(14, c.textPrimary, '500'),
  summary: type(12, c.textSecondary),
  meta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space[2] },
  comments: { flexDirection: 'row', alignItems: 'center', gap: space[1] },
  author: { flexDirection: 'row', alignItems: 'center', gap: space[1.5] },
  authorText: type(12, c.textTertiary),
  footer: { ...type(12, c.textTertiary), paddingVertical: space[2.5], paddingHorizontal: space[4], borderTopWidth: 1, borderTopColor: c.ink8 },
})
