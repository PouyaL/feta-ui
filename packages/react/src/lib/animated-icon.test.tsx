import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { AnimatedIcon } from './animated-icon'

const render = (extra: Partial<Parameters<typeof AnimatedIcon>[0]> = {}): string =>
  renderToStaticMarkup(<AnimatedIcon icon="bell" iconStyle="rounded" body='<path d="M1 1"/>' dir={1} {...extra} />)

describe('AnimatedIcon', () => {
  it('is hidden from assistive tech by default', () => {
    expect(render()).toContain('aria-hidden="true"')
    expect(render()).not.toContain('role=')
  })

  it('becomes an image when labelled', () => {
    const html = render({ 'aria-label': 'Alerts' })
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-label="Alerts"')
    expect(html).not.toContain('aria-hidden')
  })

  it('applies size and color, defaulting to 24 and currentColor from the parent', () => {
    expect(render()).toContain('width="24"')
    expect(render({ size: 48, color: 'red' })).toContain('width="48"')
    expect(render({ color: 'red' })).toContain('color:red')
  })

  it('sends color to the glow on Neon', () => {
    expect(render({ iconStyle: 'neon', color: 'red' })).toContain('--feta-neon-glow:red')
  })

  it('gives each copy its own ids', () => {
    const html = render({ body: '<linearGradient id="feta-a"/><path stroke="url(#feta-a)"/><use href="#feta-a"/>' })
    const id = html.match(/id="(feta-[^"]+)"/)?.[1]
    expect(id).toMatch(/^feta-.+-a$/)
    expect(html).toContain(`url(#${id})`)
    expect(html).toContain(`href="#${id}"`)
  })
})
