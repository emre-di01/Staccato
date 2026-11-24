import RechtsRahmen, { sek, h2, p, ul, link } from '../neu/seiten/RechtsRahmen'
import { useApp } from '../context/AppContext'

const MAIL = 'staccato@401dev.de'
const betreff = text => `mailto:${MAIL}?subject=${encodeURIComponent(text)}`

// Öffentliche Seite für Google Play: Konto löschen, auch ohne installierte App
export default function KontoLoeschen() {
  const { T } = useApp()
  const liste = praefix => [1, 2, 3, 4].map(n => `${praefix}${n}`).map(k => [k, T(k)]).filter(([k, text]) => text !== k)
  return (
    <RechtsRahmen titel={T('kl_titel')} unter={T('kl_unter')}>
      <section style={sek}>
        <h2 style={h2}>{T('kl_selbst')}</h2>
        <ol style={ul}>{liste('kl_schritt')
          .map(([k, text]) => <li key={k} style={{ marginBottom: 6 }}>{text}</li>)}</ol>
        <p style={{ ...p, marginTop: 10 }}>{T('kl_web')} <a href="/login" style={link}>app.staccato-music.de</a></p>
      </section>

      <section style={sek}>
        <h2 style={h2}>{T('kl_mail')}</h2>
        <p style={p}>{T('kl_mail_text')} <a href={betreff(T('kl_mail_betreff'))} style={link}>{MAIL}</a></p>
      </section>

      <section style={sek}>
        <h2 style={h2}>{T('kl_weg')}</h2>
        <ul style={ul}>{liste('kl_weg')
          .map(([k, text]) => <li key={k} style={{ marginBottom: 6 }}>{text}</li>)}</ul>
        <p style={{ ...p, marginTop: 10 }}>{T('kl_dateien')}</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>{T('kl_bleibt')}</h2>
        <ul style={ul}>{liste('kl_bleibt')
          .map(([k, text]) => <li key={k} style={{ marginBottom: 6 }}>{text}</li>)}</ul>
      </section>

      <section style={sek}>
        <h2 style={h2}>{T('kl_nur_daten')}</h2>
        <p style={p}>{T('kl_nur_daten_text')} <a href={betreff(T('kl_nur_daten_betreff'))} style={link}>{MAIL}</a></p>
      </section>
    </RechtsRahmen>
  )
}
