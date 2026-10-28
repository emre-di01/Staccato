import { useQuery } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Leer, Laden } from '../../ui'
import { tagLabel } from '../zeit'

const TYP_REIHENFOLGE = ['aufnahmeformular', 'vertrag', 'sepa', 'einverstaendnis', 'sonstiges']

// Dokumente, die die Schule für das Mitglied hinterlegt hat (Vertrag, SEPA …)
export default function NeuDokumente() {
  const { profil, T, toast, lang, zeitzone } = useApp()
  const { data: dateien = [], isLoading } = useQuery({
    queryKey: ['n-dokumente', profil?.id],
    enabled: !!profil?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('mitglied_dateien').select('id, name, typ, bucket_pfad, hochgeladen_am')
        .eq('profil_id', profil.id).order('hochgeladen_am', { ascending: false })
      if (error) throw error
      return data ?? []
    },
  })

  async function oeffnen(d) {
    // Fenster sofort öffnen, sonst blockiert iOS das Popup nach dem await
    const fenster = window.open('', '_blank')
    const { data, error } = await supabase.storage.from('mitglied-dateien').createSignedUrl(d.bucket_pfad, 3600)
    if (error || !data?.signedUrl) { fenster?.close(); toast(error?.message ?? T('n_fehler'), 'error'); return }
    if (fenster) fenster.location = data.signedUrl
    else window.location.href = data.signedUrl
  }

  const typen = TYP_REIHENFOLGE.filter(t => dateien.some(d => (TYP_REIHENFOLGE.includes(d.typ) ? d.typ : 'sonstiges') === t))

  return (
    <Seite titel={T('n_dokumente')} zurueck={{ to: '/schueler/ich', label: T('n_tab_ich') }}>
      <p style={{ margin: '8px 20px 0', fontSize: 16, color: 'var(--text-2)', lineHeight: 1.5 }}>{T('n_dokumente_erklaerung')}</p>
      {isLoading ? <div style={{ marginTop: 20 }}><Laden /></div>
        : dateien.length === 0 ? <div style={{ marginTop: 20 }}><Leer text={T('files_empty_desc')} /></div>
        : typen.map(typ => {
          const liste = dateien.filter(d => (TYP_REIHENFOLGE.includes(d.typ) ? d.typ : 'sonstiges') === typ)
          return (
            <Abschnitt key={typ} titel={T(`dok_type_${typ}`)} style={{ marginTop: 24 }}>
              <Gruppe>
                {liste.map((d, i) => (
                  <div key={d.id}>
                    {i > 0 && <Trenner />}
                    <Zeile icon={FileText} titel={d.name} untertitel={tagLabel(d.hochgeladen_am, zeitzone, lang, T)} onClick={() => oeffnen(d)} />
                  </div>
                ))}
              </Gruppe>
            </Abschnitt>
          )
        })}
    </Seite>
  )
}
