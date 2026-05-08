import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { applyTheme, THEMES } from '../themes/themes'
import { t as translate } from '../i18n/translations'

const AppContext = createContext(null)

const DEFAULT_THEME = 'klassik'
const DEFAULT_LANG  = 'de'

export function AppProvider({ children }) {
  const [toasts,     setToasts]     = useState([])
  const [confirmState, setConfirmState] = useState(null) // { message, sub, confirmLabel, cancelLabel, dangerous, resolve }
  const toastIdRef = useRef(0)

  const toast = useCallback((message, type = 'info', duration) => {
    const id = ++toastIdRef.current
    setToasts(t => [...t, { id, message, type, duration }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  const confirm = useCallback((message, options = {}) => {
    return new Promise(resolve => {
      setConfirmState({ message, resolve, ...options })
    })
  }, [])

  function resolveConfirm(result) {
    confirmState?.resolve(result)
    setConfirmState(null)
  }

  const [session,    setSession]    = useState(undefined)
  const [profil,     setProfil]     = useState(null)
  const [schule,     setSchule]     = useState(null)
  const [zeitzone,   setZeitzone]   = useState('Europe/Berlin')
  const [laden,      setLaden]      = useState(true)
  const [theme,      setThemeKey]   = useState(() => localStorage.getItem('staccato_theme') || DEFAULT_THEME)
  const [darkMode,   setDarkMode]   = useState(() => localStorage.getItem('staccato_dark') === 'true')
  const [lang,       setLangState]  = useState(() => localStorage.getItem('staccato_lang') || DEFAULT_LANG)

  // Tracks which user ID has its profile loaded.
  // Prevents calling ladeProfil() when SIGNED_IN fires from inside the processLock
  // (e.g. on tab focus via _recoverAndRefresh), which would deadlock: the lock is
  // already held, and getSession() inside supabase.from() also tries to acquire it.
  const loadedUidRef = useRef(null)
  const profilIdRef  = useRef(null)

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
        loadedUidRef.current = userId
        profilIdRef.current  = userId
        setProfil(data)
        if (data.sprache)   setLangState(data.sprache)
        if (data.thema)     setThemeKey(data.thema)
        if (data.dark_mode != null) setDarkMode(data.dark_mode)
        if (data.schule_id) {
          const { data: schuleData } = await supabase.from('schulen').select('zeitzone, logo_url, name, website, email, telefon, adresse, inventar_prefix').eq('id', data.schule_id).single()
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
      if (event === 'TOKEN_REFRESHED') {
        setSession(session)
        return
      }
      if (!session) {
        loadedUidRef.current = null
        setSession(null)
        setProfil(null)
        setSchule(null)
        setLaden(false)
        return
      }
      setSession(session)
      // Only fetch profile when not yet loaded for this user. SIGNED_IN can fire
      // from inside the processLock (tab focus → _recoverAndRefresh). Calling
      // supabase.from() there would re-acquire the lock → deadlock → all queries hang.
      if (loadedUidRef.current !== session.user.id) {
        setLaden(true)
        await ladeProfil(session.user.id)
      }
    })

    return () => {
      clearTimeout(fallback)
      subscription.unsubscribe()
    }
  }, [ladeProfil])

  async function abmelden() {
    await supabase.auth.signOut()
  }

  function saveToProfile(patch) {
    if (profilIdRef.current) {
      supabase.from('profiles').update(patch).eq('id', profilIdRef.current)
        .then(({ error }) => { if (error) console.warn('Profil speichern fehlgeschlagen:', error) })
    }
  }

  function changeTheme(key) {
    if (THEMES[key]) { setThemeKey(key); saveToProfile({ thema: key }) }
  }

  function toggleDark() {
    setDarkMode(d => { const next = !d; saveToProfile({ dark_mode: next }); return next })
  }

  function setLang(l) {
    setLangState(l); saveToProfile({ sprache: l })
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
      toast, toasts, removeToast,
      confirm, confirmState, resolveConfirm,
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
