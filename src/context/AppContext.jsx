import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { applyTheme, THEMES } from '../themes/themes'
import { t as translate } from '../i18n/translations'
import OneSignal from 'react-onesignal'
import { NEU_ROLLEN } from '../neu/neuRollen'

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
  const [darkMode,     setDarkMode]     = useState(() => {
    const saved = localStorage.getItem('staccato_dark')
    if (saved !== null) return saved === 'true'
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
  })
  const [lang,         setLangState]    = useState(() => localStorage.getItem('staccato_lang') || DEFAULT_LANG)
  // Schriftstufe 0 = normal, 1 = groß, 2 = sehr groß (Zoom); „großeSchrift“ bleibt für alte Stellen erhalten
  const [schriftStufe, setSchriftStufeState] = useState(() => {
    const s = parseInt(localStorage.getItem('staccato_schriftstufe') ?? '', 10)
    if (s >= 0 && s <= 2) return s
    return localStorage.getItem('staccato_grosse_schrift') === 'true' ? 1 : 0
  })
  const großeSchrift = schriftStufe > 0
  // Farbmodus hell | dunkel | auto (auto folgt dem Gerät)
  const [farbmodus, setFarbmodusState] = useState(() => {
    const m = localStorage.getItem('staccato_farbmodus')
    if (m === 'hell' || m === 'dunkel' || m === 'auto') return m
    const d = localStorage.getItem('staccato_dark')
    return d === null ? 'auto' : d === 'true' ? 'dunkel' : 'hell'
  })
  const farbmodusRef = useRef(farbmodus)
  // Klassisches Design (Opt-in, im Profil gespeichert; localStorage nur für den ersten Paint).
  // Standard ist die neue Oberfläche – für die Rollen in NEU_ROLLEN.
  const [altesDesign, setAltesDesignState] = useState(() => localStorage.getItem('staccato_altes_design') === 'true')

  const loadedUidRef = useRef(null)
  const profilIdRef  = useRef(null)

  // Vor dem Laden des Profils ist die Rolle unbekannt → letzter bekannter Stand
  const rolleGeladen = profil?.rolle ?? null
  const neuesDesignAktiv = rolleGeladen
    ? !altesDesign && NEU_ROLLEN.includes(rolleGeladen)
    : localStorage.getItem('staccato_neues_design_aktiv') === 'true'

  useEffect(() => {
    if (neuesDesignAktiv) {
      // Neues Design: ein Farbschema für alle Schulen, keine Schulfarbe
      applyTheme('neu2026', darkMode)
    } else {
      applyTheme(theme, darkMode)
      if (schule?.farbe) document.documentElement.style.setProperty('--primary', schule.farbe)
    }
    localStorage.setItem('staccato_theme', theme)
    localStorage.setItem('staccato_dark', darkMode)
    localStorage.setItem('staccato_altes_design', String(altesDesign))
    if (rolleGeladen) localStorage.setItem('staccato_neues_design_aktiv', String(neuesDesignAktiv))
  }, [theme, darkMode, schule?.farbe, altesDesign, neuesDesignAktiv, rolleGeladen])

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const handler = e => {
      if (farbmodusRef.current === 'auto') setDarkMode(e.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  useEffect(() => {
    document.documentElement.style.zoom = ['', '1.15', '1.3'][schriftStufe] ?? ''
    localStorage.setItem('staccato_schriftstufe', String(schriftStufe))
    localStorage.setItem('staccato_grosse_schrift', String(schriftStufe > 0))
  }, [schriftStufe])

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
        if (data.dark_mode != null && farbmodusRef.current !== 'auto') setDarkMode(data.dark_mode)
        if (data.altes_design != null) setAltesDesignState(data.altes_design)

        const activeSchuleId = data.letzte_schule_id ?? data.schule_id
        if (activeSchuleId) {
          // Vollständige Abfrage inkl. neuer Spalten (nach Migration 20260517000001)
          let { data: schuleData, error: schuleErr } = await supabase
            .from('schulen')
            .select('id, zeitzone, logo_url, logo_url_dark, name, website, email, telefon, adresse, inventar_prefix, farbe, ist_demo, demo_expires_at, kuendigungsfrist, plan, max_lehrer, max_schueler, max_storage_mb, hat_vorstand, hat_inventar, abo_status, abo_bis, verein_verifiziert, steuernummer, ustid, steuer_hinweis, rechnungen_prefix, rechtsform, vereinsreg_nr, vereinsreg_gericht, ist_gemeinnuetzig, finanzamt, freistellungsbescheid_datum')
            .eq('id', activeSchuleId)
            .single()

          // Fallback: Migration noch nicht eingespielt → ohne neue Spalten
          if (schuleErr) {
            const { data: fallback } = await supabase
              .from('schulen')
              .select('id, zeitzone, logo_url, logo_url_dark, name, website, email, telefon, adresse, inventar_prefix, farbe, ist_demo, demo_expires_at, kuendigungsfrist, plan, max_lehrer, max_schueler, max_storage_mb, hat_vorstand, hat_inventar, abo_status, abo_bis, verein_verifiziert, steuernummer, ustid, steuer_hinweis, rechnungen_prefix')
              .eq('id', activeSchuleId)
              .single()
            schuleData = fallback
          }

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
    setDarkMode(d => {
      const next = !d
      saveToProfile({ dark_mode: next })
      farbmodusRef.current = next ? 'dunkel' : 'hell'
      setFarbmodusState(farbmodusRef.current)
      localStorage.setItem('staccato_farbmodus', farbmodusRef.current)
      return next
    })
  }

  function setFarbmodus(m) {
    farbmodusRef.current = m
    setFarbmodusState(m)
    localStorage.setItem('staccato_farbmodus', m)
    if (m === 'auto') {
      setDarkMode(window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false)
    } else {
      setDarkMode(m === 'dunkel')
      saveToProfile({ dark_mode: m === 'dunkel' })
    }
  }

  function toggleGrosseSchrift() {
    setSchriftStufeState(s => (s > 0 ? 0 : 1))
  }

  function setSchriftStufe(stufe) {
    setSchriftStufeState(Math.max(0, Math.min(2, stufe)))
  }

  function setNeuesDesign(an) {
    setAltesDesignState(!an)
    saveToProfile({ altes_design: !an })
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

  const abo = schule ? {
    plan:             schule.plan        ?? 'pro',
    status:           schule.abo_status  ?? 'aktiv',
    bis:              schule.abo_bis     ?? null,
    aktiv:            (schule.abo_status ?? 'aktiv') !== 'gesperrt',
    hatVorstand:      schule.hat_vorstand ?? true,
    hatInventar:      schule.hat_inventar ?? true,
    maxLehrer:        schule.max_lehrer   ?? null,
    maxSchueler:      schule.max_schueler ?? null,
    maxStorageMb:     schule.max_storage_mb ?? null,
    vereinVerifiziert: schule.verein_verifiziert ?? false,
  } : null

  return (
    <AppContext.Provider value={{
      session, profil, rolle, laden,
      theme, darkMode, lang, zeitzone,
      großeSchrift, toggleGrosseSchrift, schriftStufe, setSchriftStufe,
      farbmodus, setFarbmodus,
      neuesDesign: !altesDesign, setNeuesDesign,
      schule, setSchule, abo,
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
