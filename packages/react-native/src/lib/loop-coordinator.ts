// One looping icon at a time, the same rule as @fetaui/react (ANIMATION.md §5.1). On a device every mounted loop
// counts as in view; the most recent one wins and the oldest pauses until it claims again.
type Listener = () => void

const active: string[] = []
const listeners = new Set<Listener>()
let limit = 1

const notify = (): void => { for (const fn of listeners) fn() }

export function claim(id: string, name = id): void {
  if (active.includes(id)) return
  active.push(id)
  const denied = active.length > limit ? active.shift() : undefined
  if (denied && typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`fetaUI: loop "${denied}" paused, "${name}" took over. Raise it with <FetaProvider maxLoops>.`)
  notify()
}

export function release(id: string): void {
  const at = active.indexOf(id)
  if (at < 0) return
  active.splice(at, 1)
  notify()
}

export const isActive = (id: string): boolean => active.includes(id)

export function subscribe(fn: Listener): () => void {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function setMaxLoops(n: number): void {
  limit = Math.max(1, n)
  while (active.length > limit) active.shift()
  notify()
}
