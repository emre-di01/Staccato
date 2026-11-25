// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { t } from '../../i18n/translations'
globalThis.IS_REACT_ACT_ENVIRONMENT = true
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ T: k => t('de', k) }) }))
const { default: ExternesMedium } = await import('../ExternesMedium')
let root
const zeige = async el => { root ??= createRoot(document.body.appendChild(document.createElement('div'))); await act(async () => root.render(el)) }
afterEach(() => { act(() => root.unmount()); root = null; document.body.innerHTML = '' })

it('lädt erst nach einem Klick, ohne Cookies-Variante, und fragt beim nächsten Video neu', async () => {
  await zeige(<ExternesMedium id="abc" titel="Lied" />)
  expect(document.querySelector('iframe')).toBeNull()
  expect(document.body.textContent).toContain('an YouTube übertragen')
  await act(async () => document.querySelector('button').click())
  expect(document.querySelector('iframe').src).toBe('https://www.youtube-nocookie.com/embed/abc?autoplay=1')
  await zeige(<ExternesMedium id="def" titel="Lied 2" />)
  expect(document.querySelector('iframe')).toBeNull()
})
it('ohne Kennung nichts', async () => { await zeige(<ExternesMedium id={null} />); expect(document.body.textContent).toBe('') })
