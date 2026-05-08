import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'

export const ONBOARDING_LS_KEY = 'staccato_onboarding_schueler'

const STEPS = [
  {
    icon: '👋',
    de: { title: 'Willkommen bei Staccato!', text: 'Schön, dass du dabei bist! Diese kurze Tour zeigt dir, was du hier machen kannst.' },
    en: { title: 'Welcome to Staccato!', text: "Great to have you here! This quick tour shows you what you can do." },
    tr: { title: "Staccato'ya Hoş Geldin!", text: 'Burada olman çok güzel! Bu kısa tur sana ne yapabileceğini gösterir.' },
  },
  {
    icon: '📅',
    de: { title: 'Dein Stundenplan', text: 'Sieh alle deine Unterrichtstermine auf einen Blick – als Wochenansicht oder Liste.' },
    en: { title: 'Your Schedule', text: 'View all your lessons at a glance — as a week grid or list.' },
    tr: { title: 'Ders Programın', text: 'Tüm ders saatlerini bir bakışta gör — haftalık görünüm veya liste.' },
  },
  {
    icon: '🎵',
    de: { title: 'Deine Kurse', text: 'Hier findest du deine Kurse mit Hausaufgaben, Notizen und deiner Anwesenheitsrate.' },
    en: { title: 'Your Courses', text: 'Find your courses with homework, notes and your attendance rate.' },
    tr: { title: 'Derslerim', text: 'Ödev, notlar ve devam oranınla derslerini burada bulabilirsin.' },
  },
  {
    icon: '🎼',
    de: { title: 'Repertoire', text: 'Entdecke Musikstücke mit Noten, Liedtexten, Akkorden und Hörbeispielen.' },
    en: { title: 'Repertoire', text: 'Explore pieces with sheet music, lyrics, chords and audio samples.' },
    tr: { title: 'Repertuvar', text: 'Nota, sözler, akorlar ve dinleme örnekleriyle eserleri keşfet.' },
  },
  {
    icon: '✉️',
    de: { title: 'Nachrichten', text: 'Bleib mit deiner Lehrkraft in Kontakt und erhalte wichtige Infos der Musikschule.' },
    en: { title: 'Messages', text: 'Stay in touch with your teacher and receive important updates from school.' },
    tr: { title: 'Mesajlar', text: 'Öğretmeninle iletişimde kal ve okuldan önemli haberleri al.' },
  },
  {
    icon: '✅',
    de: { title: 'Alles klar!', text: 'Du kannst diese Tour jederzeit über dein Profil erneut starten. Viel Spaß beim Musizieren!' },
    en: { title: 'All set!', text: 'You can restart this tour anytime from your profile. Enjoy making music!' },
    tr: { title: 'Hazırsın!', text: 'Bu turu profilinden istediğin zaman yeniden başlatabilirsin. Müziğin tadını çıkar!' },
  },
]

export default function OnboardingModal() {
  const { rolle, lang, T } = useApp()
  const [open, setOpen] = useState(false)
  const [schritt, setSchritt] = useState(0)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    if (rolle !== 'schueler') return
    if (!localStorage.getItem(ONBOARDING_LS_KEY)) setOpen(true)
  }, [rolle])

  function weiter() {
    if (schritt < STEPS.length - 1) {
      setSchritt(s => s + 1)
      setAnimKey(k => k + 1)
    } else {
      schliessen()
    }
  }

  function schliessen() {
    localStorage.setItem(ONBOARDING_LS_KEY, '1')
    setOpen(false)
  }

  if (!open) return null

  const step = STEPS[schritt]
  const content = step[lang] ?? step.de
  const istLetzter = schritt === STEPS.length - 1

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: '32px 28px',
        width: '100%', maxWidth: 400, boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        fontFamily: "'Outfit','DM Sans',sans-serif",
        animation: 'onbSlide .25s ease',
        textAlign: 'center',
      }}>
        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 28 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              height: 6, borderRadius: 3,
              width: i === schritt ? 20 : 6,
              background: i <= schritt ? 'var(--primary)' : 'var(--border)',
              transition: 'width .25s ease, background .25s ease',
            }} />
          ))}
        </div>

        {/* Icon */}
        <div key={`icon-${animKey}`} style={{ fontSize: 52, marginBottom: 16, lineHeight: 1, animation: 'onbIcon .3s ease' }}>
          {step.icon}
        </div>

        {/* Title + text */}
        <div key={`content-${animKey}`} style={{ animation: 'onbFade .25s ease' }}>
          <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>
            {content.title}
          </h2>
          <p style={{ margin: '0 0 28px', fontSize: 15, color: 'var(--text-2)', lineHeight: 1.6 }}>
            {content.text}
          </p>
        </div>

        <button onClick={weiter} style={{
          width: '100%', padding: '13px',
          borderRadius: 'var(--radius)', border: 'none',
          background: 'var(--primary)', color: 'var(--primary-fg)',
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', marginBottom: 10,
        }}>
          {istLetzter ? T('onb_finish') : T('onb_next')}
        </button>

        {!istLetzter && (
          <button onClick={schliessen} style={{
            background: 'none', border: 'none',
            color: 'var(--text-3)', fontSize: 13,
            cursor: 'pointer', fontFamily: 'inherit', padding: 6,
          }}>
            {T('onb_skip')}
          </button>
        )}
      </div>

      <style>{`
        @keyframes onbSlide {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes onbIcon {
          from { transform: scale(0.7); opacity: 0; }
          to   { transform: scale(1); opacity: 1; }
        }
        @keyframes onbFade {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
