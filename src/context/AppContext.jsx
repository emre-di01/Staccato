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

  const [refreshKey, setRefreshKey] = useState(0)
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
    // Use onAuthStateChange as the single source of truth for session initialization.
    // Calling getSession() concurrently with onAuthStateChange causes Web Lock conflicts
    // ("lock was released because another request stole it"), which deletes the session
    // from localStorage and logs the user out. INITIAL_SESSION fires after any pending
    // token refresh is complete, so it is safe to use as the initial session source.
    let initialized = false
    const fallback = setTimeout(() => {
      if (!initialized) { setSession(null); setLaden(false) }
    }, 10_000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = '/passwort-zuruecksetzen'
        return
      }
      if (event === 'INITIAL_SESSION') {
        initialized = true
        clearTimeout(fallback)
        setSession(session)
        if (session?.user) {
          await ladeProfil(session.user.id)
        } else {
          setLaden(false)
        }
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

    return () => {
      clearTimeout(fallback)
      subscription.unsubscribe()
    }
  }, [ladeProfil])

  useEffect(() => {
    function handleVisibility() {
      if (document.visibilityState === 'hidden') { hiddenAt.current = Date.now(); return }
      const elapsed = hiddenAt.current > 0 ? Date.now() - hiddenAt.current : 0
      hiddenAt.current = 0
      if (elapsed < 3 * 60 * 1000) return  // ignore if away less than 3 minutes
      if (isLiveSession()) return
      setRefreshKey(k => k + 1)  // remount current page to re-fetch data, no full reload
    }

    async function handleOnline() {
      if (isLiveSession()) return
      const { data: { session: current } } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }))
      if (!current) { window.location.reload(); return }
      setRefreshKey(k => k + 1)
    }

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('online', handleOnline)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('online', handleOnline)
    }
  }, [])

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
      refreshKey,
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
