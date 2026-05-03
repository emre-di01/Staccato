import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { applyTheme, THEMES } from '../themes/themes'
import { t as translate } from '../i18n/translations'

const AppContext = createContext(null)

const DEFAULT_THEME = 'klassik'
const DEFAULT_LANG  = 'de'

function isLiveSession() {
  const p = window.location.pathname
  return p.includes('/unterrichtsmodus') || p.startsWith('/session/')
}

export function AppProvider({ children }) {
  const [session,    setSession]    = useState(undefined)
  const [profil,     setProfil]     = useState(null)
  const [schule,     setSchule]     = useState(null)
  const [zeitzone,   setZeitzone]   = useState('Europe/Berlin')
  const [laden,      setLaden]      = useState(true)
  const [theme,      setThemeKey]   = useState(() => localStorage.getItem('staccato_theme') || DEFAULT_THEME)
  const [darkMode,   setDarkMode]   = useState(() => localStorage.getItem('staccato_dark') === 'true')
  const [lang,       setLang]       = useState(() => localStorage.getItem('staccato_lang') || DEFAULT_LANG)

  useEffect(() => {
    applyTheme(theme, darkMode)
    localStorage.setItem('staccato_theme', theme)
    localStorage.setItem('staccato_dark', darkMode)
  }, [theme, darkMode])

  useEffect(() => {
    localStorage.setItem('staccato_lang', lang)
    document.documentElement.lang = lang
  }, [lang])

  const hiddenAt = useRef(0)

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
        if (data.schule_id) {
          const { data: schuleData } = await supabase.from('schulen').select('zeitzone, logo_url, name, website, email, telefon, adresse').eq('id', data.schule_id).single()
          if (schuleData?.zeitzone) setZeitzone(schuleData.zeitzone)
          setSchule(schuleData ?? null)
        }
      }
    } catch (e) {
      console.warn('Profil nicht geladen:', e)
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
    // getSession() handles token refresh and is the authoritative initialization source.
    // onAuthStateChange fires INITIAL_SESSION immediately (possibly with null while token
    // is being refreshed), so we skip it here to avoid a race that redirects to /login.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        ladeProfil(session.user.id)
      } else {
        setLaden(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'INITIAL_SESSION') return
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = '/passwort-zuruecksetzen'
        return
      }
      setSession(session)
      if (session?.user) {
        await ladeProfil(session.user.id)
      } else {
        setProfil(null)
        setLaden(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [ladeProfil])

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); return }
      const elapsed = hiddenAt.current > 0 ? Date.now() - hiddenAt.current : 0
      hiddenAt.current = 0
      if (elapsed < 5_000) return
      if (isLiveSession()) return
      window.location.reload()
    }

    function handleOnline() {
      if (isLiveSession()) return
      window.location.reload()
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
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
      theme, darkMode, lang, zeitzone,
      schule, setSchule,
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
