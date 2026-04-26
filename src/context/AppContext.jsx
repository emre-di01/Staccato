import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { applyTheme, THEMES } from '../themes/themes'
import { t as translate } from '../i18n/translations'

const AppContext = createContext(null)

const DEFAULT_THEME = 'klassik'
const DEFAULT_LANG  = 'de'

export function AppProvider({ children }) {
  const [session,  setSession]  = useState(undefined)
  const [profil,   setProfil]   = useState(null)
  const [laden,    setLaden]    = useState(true)
  const [theme,    setThemeKey] = useState(() => localStorage.getItem('staccato_theme') || DEFAULT_THEME)
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('staccato_dark') === 'true')
  const [lang,     setLang]     = useState(() => localStorage.getItem('staccato_lang') || DEFAULT_LANG)

  useEffect(() => {
    applyTheme(theme, darkMode)
    localStorage.setItem('staccato_theme', theme)
    localStorage.setItem('staccato_dark', darkMode)
  }, [theme, darkMode])

  useEffect(() => {
    localStorage.setItem('staccato_lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  const ladeProfil = useCallback(async (userId) => {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (data) {
        setProfil(data)
        if (data.sprache) setLang(data.sprache)
      }
    } catch (e) {
      console.warn('Profil nicht geladen:', e)
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        ladeProfil(session.user.id)
      } else {
        setLaden(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = '/passwort-zuruecksetzen'
        return
      }
      setSession(session)
      if (session) {
        await ladeProfil(session.user.id)
      } else {
        setProfil(null)
        setLaden(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [ladeProfil])

  async function abmelden() {
    await supabase.auth.signOut()
  }

  function changeTheme(key) {
    if (THEMES[key]) setThemeKey(key)
  }

  function toggleDark() {
    setDarkMode(d => !d)
  }

  const T = useCallback((key) => translate(lang, key), [lang])

  const rolle = profil?.rolle ?? null

  return (
    <AppContext.Provider value={{
      session, profil, rolle, laden,
      theme, darkMode, lang,
      changeTheme, toggleDark, setLang,
      abmelden, T, ladeProfil,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp muss innerhalb von <AppProvider> verwendet werden')
  return ctx
}
