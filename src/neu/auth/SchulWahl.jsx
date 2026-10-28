import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { startseiteNach } from '../../components/ProtectedRoute'
import { Gruppe, Trenner, Zeile, Knopf } from '../../ui'
import AuthRahmen from './Rahmen'

// Schulwahl nach der Anmeldung, wenn jemand Mitglied in mehreren Schulen ist
export default function NeuSchulWahl() {
  const { schulenListe, schuleWechseln, schule, rolle, T } = useApp()
  const navigate = useNavigate()
  const [wechselt, setWechselt] = useState(null)

  async function waehlen(schuleId) {
    if (wechselt) return
    setWechselt(schuleId)
    try {
      await schuleWechseln(schuleId)
      sessionStorage.setItem('staccato_schule_session', '1')
      navigate('/', { replace: true })
    } catch (e) {
      console.error(e)
    } finally {
      setWechselt(null)
    }
  }

  return (
    <AuthRahmen titel={T('choose_school')} unter={T('choose_school_sub')} fuss={false}>
      <Gruppe style={{ margin: 0 }}>
        {schulenListe.map((s, i) => {
          const aktiv = schule?.id === s.schule_id
          return (
            <div key={s.schule_id} style={{ opacity: wechselt && wechselt !== s.schule_id ? 0.5 : 1 }}>
              {i > 0 && <Trenner />}
              <Zeile
                onClick={() => waehlen(s.schule_id)}
                bild={<SchulBild schule={s} />}
                titel={s.name}
                untertitel={T(s.rolle)}
                wert={wechselt === s.schule_id ? T('loading') : aktiv ? <Check aria-label={T('nau_aktuelle_schule')} size={22} color="var(--primary)" /> : null}
              />
            </div>
          )
        })}
      </Gruppe>

      {schule && (
        <Knopf variante="sekundaer" voll style={{ marginTop: 24, whiteSpace: 'normal', height: 'auto', minHeight: 52, padding: '12px 20px' }}
          onClick={() => { sessionStorage.setItem('staccato_schule_session', '1'); navigate(startseiteNach(rolle), { replace: true }) }}>
          {T('nau_weiter_mit').replace('{schule}', schule.name)}
        </Knopf>
      )}
    </AuthRahmen>
  )
}

function SchulBild({ schule }) {
  if (schule.logo_url) {
    return <img src={schule.logo_url} alt="" style={{ width: 44, height: 44, borderRadius: 12, objectFit: 'cover', flexShrink: 0, background: 'var(--bg)' }} />
  }
  return (
    <span aria-hidden="true" style={{ width: 44, height: 44, borderRadius: 12, flexShrink: 0, background: 'var(--n-tint)', color: 'var(--n-tint-fg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800 }}>
      {schule.name.charAt(0).toUpperCase()}
    </span>
  )
}
