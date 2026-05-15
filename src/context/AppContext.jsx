import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { applyTheme, THEMES } from '../themes/themes'
import { t as translate } from '../i18n/translations'
import OneSignal from 'react-onesignal'

const AppContext = createContext(null)

const DEFAULT_THEME = 'klassik'
const DEFAULT_LANG  = 'de'

export function AppProvider({ children }) {
  const [toasts,     setToasts]     = useState([])
  const [confirmState, setConfirmState] = useState(null)
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

  const [session,      setSession]      = useState(undefined)
  const [profil,       setProfil]       = useState(null)
  const [schule,       setSchule]       = useState(null)
  const [schulenListe, setSchulenListe] = useState([])
  const [zeitzone,     setZeitzone]     = useState('Europe/Berlin')
  const [laden,        setLaden]        = useState(true)
  const [theme,        setThemeKey]     = useState(() => localStorage.getItem('staccato_theme') || DEFAULT_THEME)
  const [darkMode,     setDarkMode]     = useState(() => localStorage.getItem('staccato_dark') === 'true')
  const [lang,         setLangState]    = useState(() => localStorage.getItem('staccato_lang') || DEFAULT_LANG)
  const [großeSchrift, setGrosseSchrift] = useState(() => localStorage.getItem('staccato_grosse_schrift') === 'true')

  const loadedUidRef = useRef(null)
  const profilIdRef  = useRef(null)

  useEffect(() => {
    applyTheme(theme, darkMode)
    if (schule?.farbe) document.documentElement.style.setProperty('--primary', schule.farbe)
    localStorage.setItem('staccato_theme', theme)
    localStorage.setItem('staccato_dark', darkMode)
  }, [theme, darkMode, schule?.farbe])

  useEffect(() => {
    document.documentElement.style.zoom = großeSchrift ? '1.15' : ''
    localStorage.setItem('staccato_grosse_schrift', String(großeSchrift))
  }, [großeSchrift])

  useEffect(() => {
    if (schule?.name) document.title = `Staccato – ${schule.name}`
    else document.title = 'Staccato'
  }, [schule?.name])

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

        const activeSchuleId = data.letzte_schule_id ?? data.schule_id
        if (activeSchuleId) {
          const { data: schuleData } = await supabase
            .from('schulen')
            .select('id, zeitzone, logo_url, name, website, email, telefon, adresse, inventar_prefix, farbe, ist_demo, demo_expires_at, kuendigungsfrist')
            .eq('id', activeSchuleId)
            .single()
          if (schuleData?.zeitzone) setZeitzone(schuleData.zeitzone)
          setSchule(schuleData ?? null)
        }

        // Schulen-Liste für Multi-Tenant Switcher
        const { data: liste } = await supabase.rpc('meine_schulen')
        setSchulenListe(liste ?? [])
      }
    } catch (e) {
      console.warn('Profil nicht geladen:', e)
    } finally {
      setLaden(false)
    }
  }, [])

  useEffect(() => {
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
          OneSignal.login(session.user.id).catch(() => {})
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
        setSchulenListe([])
        setLaden(false)
        return
      }
      setSession(session)
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
    OneSignal.logout().catch(() => {})
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

  function toggleGrosseSchrift() {
    setGrosseSchrift(g => !g)
  }

  function setLang(l) {
    setLangState(l); saveToProfile({ sprache: l })
  }

  const schuleWechseln = useCallback(async (schule_id) => {
    const { error } = await supabase.rpc('schule_wechseln', { p_schule_id: schule_id })
    if (error) throw error
    await ladeProfil(session?.user?.id)
  }, [session, ladeProfil])

  const T = useCallback((key) => translate(lang, key), [lang])

  const rolle = profil?.rolle ?? null

  return (
    <AppContext.Provider value={{
      session, profil, rolle, laden,
      theme, darkMode, lang, zeitzone,
      großeSchrift, toggleGrosseSchrift,
      schule, setSchule,
      schulenListe,
      schuleWechseln,
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
