import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus, Mail, Download, Pencil, AtSign, KeyRound, Link2, FileText, ClipboardList, FolderOpen, Building2, Trash2, MessageCircle,
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Segment, Suchfeld, Chips, Gruppe, Trenner, Zeile, Knopf, Leer, Laden } from '../../ui'
import { useBreit, Avatar, ListeDetail, DetailTitel, DetailGruppe, Info } from './ListeDetail'
import AufnahmeantragModal from '../../components/AufnahmeantragModal'
import {
  NutzerAnlegenModal, EinladungModal, ZuordnungModal, PasswortModal, EmailModal, DokumenteModal, LoeschenModal,
  KursantragAuswahlModal, SchulenModal,
} from '../../pages/admin/Mitgliederverwaltung'
import { useNeuLaden } from '../daten'
import { kursZeit } from '../lehrer/kursZeit'
import MitgliedBlatt from './MitgliedBlatt'

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }

function useMitglieder() {
  const { schule } = useApp()
  return useQuery({
    queryKey: ['na-mitglieder', schule?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from('mitglieder_mit_email').select('*').order('voller_name')
      if (error) throw error
      return data ?? []
    },
  })
}

// Kurse, in denen das Mitglied lernt oder unterrichtet
function useMitgliedKurse(id) {
  return useQuery({
    queryKey: ['na-mitglied-kurse', id],
    enabled: !!id,
    queryFn: async () => {
      const [s, l] = await Promise.all([
        supabase.from('unterricht_schueler').select('unterricht(id, name, wochentag, uhrzeit_von, uhrzeit_bis)').eq('schueler_id', id).eq('status', 'aktiv'),
        supabase.from('unterricht_lehrer').select('rolle, unterricht(id, name, wochentag, uhrzeit_von, uhrzeit_bis)').eq('lehrer_id', id),
      ])
      return [
        ...(l.data ?? []).filter(x => x.unterricht).map(x => ({ ...x.unterricht, lehrt: true })),
        ...(s.data ?? []).filter(x => x.unterricht).map(x => x.unterricht),
      ]
    },
  })
}

// Detailansicht: rechts neben der Liste (breiter Bildschirm) oder im Blatt
function Detail({ m, onAktion }) {
  const { T, lang, rolle } = useApp()
  const navigate = useNavigate()
  const { data: kurse = [], isLoading } = useMitgliedKurse(m.id)
  const kannBearbeiten = m.rolle !== 'admin' || rolle === 'superadmin'
  const datum = d => new Date(d).toLocaleDateString(LOCALE[lang] ?? 'de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
  const sepaFehlt = m.zahlungsweise === 'sepa' && !m.iban
  const beitrag = [
    m.mitgliedsbeitrag != null ? `${Number(m.mitgliedsbeitrag).toLocaleString(LOCALE[lang] ?? 'de-DE', { style: 'currency', currency: 'EUR' })}` : null,
    m.zahlungsrhythmus ? T(`nm_zr_${m.zahlungsrhythmus}`) : null,
    m.zahlungsweise ? T(`nm_zw_${m.zahlungsweise}`) : null,
  ].filter(Boolean).join(' · ')
  const hatEltern = m.erziehungsberechtigter_name || m.erziehungsberechtigter_telefon || m.erziehungsberechtigter_email

  const aktion = (typ, icon, titel, farbe) => ({ typ, icon, titel, farbe })
  const aktionen = kannBearbeiten ? [
    aktion('email', AtSign, T('nm_email_aendern')),
    aktion('passwort', KeyRound, T('nm_passwort_setzen')),
    ...(m.rolle === 'lehrer' || m.rolle === 'schueler' ? [aktion('zuordnung', Link2, T('nm_kurszuordnungen'))] : []),
    aktion('antrag', FileText, T('nm_aufnahmeantrag')),
    ...(m.rolle === 'schueler' ? [aktion('kursantrag', ClipboardList, T('nm_kursanmeldung'))] : []),
    aktion('dokumente', FolderOpen, T('nm_dateien')),
    ...(rolle === 'superadmin' ? [aktion('schulen', Building2, T('nm_schulen_verwalten'))] : []),
  ] : []

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Avatar name={m.voller_name} bild={m.avatar_url} groesse={64} />
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>{m.voller_name}</h2>
          <div style={{ fontSize: 16, color: 'var(--text-2)' }}>
            {T(m.rolle)}
            {!m.aktiv && <span style={{ color: 'var(--danger)', fontWeight: 600 }}> · {T('inactive')}</span>}
            {m.erstellt_am && ` · ${T('nm_seit').replace('{d}', new Date(m.erstellt_am).toLocaleDateString(LOCALE[lang] ?? 'de-DE', { month: 'short', year: 'numeric' }))}`}
          </div>
        </div>
      </div>

      {kannBearbeiten ? (
        <div style={{ marginTop: 18, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Knopf icon={Pencil} onClick={() => onAktion('profil')} style={{ flex: '1 1 140px' }}>{T('edit')}</Knopf>
          <Knopf variante="sekundaer" icon={MessageCircle} onClick={() => navigate(`/admin/nachrichten?neu=direkt&an=${m.id}`)} style={{ flex: '1 1 140px' }}>{T('n_nachricht')}</Knopf>
        </div>
      ) : (
        <div style={{ marginTop: 16, fontSize: 16, color: 'var(--text-2)' }}>{T('nm_nur_superadmin')}</div>
      )}

      <DetailTitel>{T('nm_kontakt')}</DetailTitel>
      <DetailGruppe>
        <Info label={T('nm_email')}>{m.email}</Info>
        {m.telefon && <><Trenner /><Info label={T('profile_phone')}>{m.telefon}</Info></>}
        {m.adresse && <><Trenner /><Info label={T('profile_address')}>{m.adresse}</Info></>}
        {m.geburtsdatum && <><Trenner /><Info label={T('profile_birthday')}>{datum(m.geburtsdatum)}</Info></>}
      </DetailGruppe>

      {hatEltern && <>
        <DetailTitel>{T('nm_erziehungsberechtigte')}</DetailTitel>
        <DetailGruppe>
          <Info label={T('name')}>{m.erziehungsberechtigter_name}</Info>
          {m.erziehungsberechtigter_telefon && <><Trenner /><Info label={T('profile_phone')}>{m.erziehungsberechtigter_telefon}</Info></>}
          {m.erziehungsberechtigter_email && <><Trenner /><Info label={T('nm_email')}>{m.erziehungsberechtigter_email}</Info></>}
        </DetailGruppe>
      </>}

      {(m.rolle === 'schueler' || m.rolle === 'lehrer' || kurse.length > 0) && <>
        <DetailTitel>{T('courses')}</DetailTitel>
        {isLoading ? <div style={{ fontSize: 16, color: 'var(--text-2)' }}>…</div> : kurse.length === 0 ? (
          <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{T('nm_keine_kurse')}</div>
        ) : (
          <DetailGruppe>
            {kurse.map((k, i) => (
              <div key={k.id + (k.lehrt ? 'l' : 's')}>
                {i > 0 && <Trenner />}
                <Zeile titel={k.name} untertitel={[k.lehrt ? T('nm_unterrichtet') : null, kursZeit(k, lang)].filter(Boolean).join(' · ')} to={`/admin/kurse/${k.id}`} />
              </div>
            ))}
          </DetailGruppe>
        )}
      </>}

      {(beitrag || sepaFehlt) && <>
        <DetailTitel>{T('nm_beitrag')}</DetailTitel>
        <DetailGruppe>
          <Info label={T('nm_beitrag')}>{beitrag || '–'}</Info>
          {sepaFehlt && <><Trenner /><div style={{ padding: '12px 16px', fontSize: 16, fontWeight: 600, color: 'var(--danger)' }}>{T('nm_iban_fehlt')}</div></>}
        </DetailGruppe>
      </>}

      {m.notizen && <>
        <DetailTitel>{T('member_internal_notes')}</DetailTitel>
        <DetailGruppe><Info label={T('nm_nur_verwaltung')}>{m.notizen}</Info></DetailGruppe>
      </>}

      {aktionen.length > 0 && <>
        <DetailTitel>{T('nm_weiteres')}</DetailTitel>
        <DetailGruppe>
          {aktionen.map((a, i) => (
            <div key={a.typ}>{i > 0 && <Trenner />}<Zeile icon={a.icon} titel={a.titel} onClick={() => onAktion(a.typ)} /></div>
          ))}
        </DetailGruppe>
        <div style={{ marginTop: 20 }}>
          <Knopf voll variante="gefahr" icon={Trash2} onClick={() => onAktion('loeschen')}>{T('nm_loeschen')}</Knopf>
        </div>
      </>}
    </div>
  )
}

export default function AdminMitglieder() {
  const { T, rolle, schule, abo } = useApp()
  const navigate = useNavigate()
  const breit = useBreit()
  const neuLaden = useNeuLaden()
  const { data: mitglieder = [], isLoading } = useMitglieder()
  const [suche, setSuche] = useState('')
  const [filterRolle, setFilterRolle] = useState('alle')
  const [filterStatus, setFilterStatus] = useState('aktiv')
  const [gewaehltId, setGewaehltId] = useState(null)
  const [modal, setModal] = useState(null)
  const istDemo = schule?.ist_demo === true

  const zaehle = r => mitglieder.filter(m => m.rolle === r).length
  const stats = { lehrer: zaehle('lehrer'), schueler: zaehle('schueler') }
  const q = suche.trim().toLowerCase()
  const liste = mitglieder.filter(m =>
    (filterRolle === 'alle' || m.rolle === filterRolle) &&
    (filterStatus === 'alle' || (filterStatus === 'aktiv') === !!m.aktiv) &&
    (!q || [m.voller_name, m.email, m.telefon].some(v => v?.toLowerCase().includes(q))),
  )
  const gewaehlt = mitglieder.find(m => m.id === gewaehltId) ?? (breit ? liste[0] : null)
  const aktualisieren = () => neuLaden('na-mitglieder', 'na-mitglied-kurse', 'na-start')

  const rollenChips = [['alle', T('n_alle')], ['schueler', T('schueler')], ['lehrer', T('nm_lehrkraefte')], ['eltern', T('eltern')], ['vorstand', T('vorstand')], ['admin', T('admin')]]
    .filter(([r]) => r === 'alle' || zaehle(r) > 0)
    .map(([r, l]) => [r, r === 'alle' ? `${l} (${mitglieder.length})` : `${l} (${zaehle(r)})`])

  function csv() {
    const zeilen = [
      [T('name'), T('nm_email'), T('role'), T('profile_phone'), T('profile_birthday'), T('active')].join(';'),
      ...liste.map(m => [m.voller_name, m.email, T(m.rolle), m.telefon, m.geburtsdatum, m.aktiv ? 'ja' : 'nein']
        .map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';')),
    ]
    const url = URL.createObjectURL(new Blob(['﻿' + zeilen.join('\r\n')], { type: 'text/csv;charset=utf-8;' }))
    const a = document.createElement('a'); a.href = url; a.download = 'mitglieder.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const zu = () => setModal(null)
  const mm = modal?.m

  return (
    <Seite breit titel={T('members')} rechts={
      !istDemo && <Knopf klein variante="tint" icon={Plus} onClick={() => setModal({ typ: 'anlegen' })}>{T('nm_neu')}</Knopf>
    }>
      <Segment label={T('na_tab_mitglieder')} wert="mitglieder" onChange={v => v === 'interessenten' && navigate('/admin/interessenten')}
        optionen={[['mitglieder', T('members')], ['interessenten', T('prospects')]]} style={{ margin: '16px 20px 0', maxWidth: 420 }} />

      <ListeDetail breit={breit} detailLabel={gewaehlt?.voller_name} blattTitel={T('members')}
        onSchliessen={() => setGewaehltId(null)} blattVerstecken={!!modal}
        detail={gewaehlt && <Detail key={gewaehlt.id} m={gewaehlt} onAktion={typ => setModal({ typ, m: gewaehlt })} />}
        liste={<>
          <Suchfeld wert={suche} onChange={setSuche} label={T('nm_suchen')} placeholder={T('nm_suchen_platzhalter')} />
          <div style={{ marginTop: 12 }}><Chips label={T('role')} optionen={rollenChips} wert={filterRolle} onChange={setFilterRolle} /></div>
          <div style={{ marginTop: 8 }}><Chips label={T('status')} optionen={[['aktiv', T('active')], ['inaktiv', T('inactive')], ['alle', T('n_alle')]]} wert={filterStatus} onChange={setFilterStatus} /></div>

          <div style={{ marginTop: 16 }}>
            {isLoading ? <Laden hoehe={320} /> : liste.length === 0 ? <Leer text={T('member_none_found')} /> : (
              <Gruppe>
                {liste.map((m, i) => {
                  const aktiv = breit && gewaehlt?.id === m.id
                  return (
                    <div key={m.id} style={{ background: aktiv ? 'var(--n-tint)' : undefined }}>
                      {i > 0 && <Trenner />}
                      <Zeile bild={<Avatar name={m.voller_name} bild={m.avatar_url} />} titel={m.voller_name} chevron={!breit}
                        untertitel={[m.email, !m.aktiv ? T('inactive') : null].filter(Boolean).join(' · ')}
                        wert={T(m.rolle)} onClick={() => setGewaehltId(m.id)} />
                    </div>
                  )
                })}
              </Gruppe>
            )}
          </div>

          <div style={{ margin: '14px 20px 0', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ flex: 1, fontSize: 15, color: 'var(--text-2)' }}>{T('nm_x_von_y').replace('{x}', liste.length).replace('{y}', mitglieder.length)}</span>
            <Knopf klein variante="sekundaer" icon={Mail} onClick={() => setModal({ typ: 'einladung' })}>{T('invite_member')}</Knopf>
            <Knopf klein variante="sekundaer" icon={Download} onClick={csv}>CSV</Knopf>
          </div>
        </>} />

      {modal?.typ === 'anlegen' && <NutzerAnlegenModal onClose={zu} onErfolg={aktualisieren} T={T} abo={abo} stats={stats} />}
      {modal?.typ === 'einladung' && <EinladungModal onClose={zu} T={T} />}
      {modal?.typ === 'profil' && <MitgliedBlatt mitglied={mm} onClose={zu} onFertig={() => { zu(); aktualisieren() }} />}
      {modal?.typ === 'email' && <EmailModal mitglied={mm} onClose={zu} onErfolg={aktualisieren} />}
      {modal?.typ === 'passwort' && <PasswortModal mitglied={mm} onClose={zu} />}
      {modal?.typ === 'zuordnung' && <ZuordnungModal mitglied={mm} onClose={() => { zu(); aktualisieren() }} T={T} />}
      {modal?.typ === 'antrag' && <AufnahmeantragModal mitglied={mm} onClose={zu} />}
      {modal?.typ === 'kursantrag' && <KursantragAuswahlModal mitglied={mm} onClose={zu} />}
      {modal?.typ === 'dokumente' && <DokumenteModal mitglied={mm} onClose={zu} />}
      {modal?.typ === 'schulen' && rolle === 'superadmin' && <SchulenModal mitglied={mm} onClose={zu} />}
      {modal?.typ === 'loeschen' && <LoeschenModal mitglied={mm} onClose={zu} onErfolg={() => { setGewaehltId(null); aktualisieren() }} />}
    </Seite>
  )
}
