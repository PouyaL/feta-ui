// One looping icon in view at a time, enforced in code (ANIMATION.md §5.1). The module level
// singleton is why Pro imports this runtime instead of keeping its own copy.
type Listener = () => void

const active: string[] = []
const listeners = new Set<Listener>()
let limit = 1

const notify = (): void => { for (const fn of listeners) fn() }

/** The most recently visible loop wins; the oldest owner pauses until it claims again. */
export function claim(id: string, name = id): boolean {
  if (active.includes(id)) return true
  active.push(id)
  const denied = active.length > limit ? active.shift() : undefined
  if (denied && process.env.NODE_ENV !== 'production') console.warn(`fetaUI: loop "${denied}" paused, "${name}" took over. Raise it with <FetaProvider maxLoops>.`)
  notify()
  return true
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
