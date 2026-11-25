// Rückkehr von der Bezahlseite (/shop/bestellung). Die Adresse ist neutral: Der Zahlungsanbieter bekommt keinen Link,
// über den sich die Bestellung ansehen lässt. Welche es ist, weiß nur dieser Browser-Tab.
import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import ShopRahmen, { h1 } from './Rahmen'
import { bestellungHolen } from './daten'

export default function Rueckkehr() {
  const { T } = useApp()
  const [params] = useSearchParams()
  const abbruch = params.get('abbruch') === '1'
  const [zugang] = useState(bestellungHolen)
  if (zugang) return <Navigate to={`/shop/bestellung/${zugang}${abbruch ? '?abbruch=1' : ''}`} replace />
  // Anderer Tab oder Browser (z. B. nach der Banking-App): Tickets kommen trotzdem per E-Mail
  return (
    <ShopRahmen titel={T('shop_rk_titel')}>
      <h1 style={h1}>{T(abbruch ? 'shop_abgebrochen' : 'shop_rk_titel')}</h1>
      <p style={{ margin: '12px 0 0', fontSize: 18, lineHeight: 1.5 }}>{T(abbruch ? 'shop_rk_abbruch' : 'shop_rk_text')}</p>
    </ShopRahmen>
  )
}
