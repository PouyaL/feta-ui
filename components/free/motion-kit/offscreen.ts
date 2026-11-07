let offscreen: IntersectionObserver | undefined

/**
 * Pass as a `ref`. One observer serves every loop on the page: it sets `data-offscreen` on the closest
 * `data-loop` element, and CSS pauses what is inside.
 */
export function watchOffscreen(node: HTMLElement): () => void {
  offscreen ??= new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.closest('[data-loop]')?.toggleAttribute('data-offscreen', !entry.isIntersecting)
  })
  const observer = offscreen
  observer.observe(node)
  return () => {
    observer.unobserve(node)
    node.closest('[data-loop]')?.removeAttribute('data-offscreen')
  }
}
