// Ticketshop-Einrichtung der Schule (Admins)
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

// Erst sichtbar, wenn die Edge Functions der Umgebung laufen (dev: VITE_TICKETSHOP=1 in .env.dev)
export const SHOP_SICHTBAR = import.meta.env.VITE_TICKETSHOP === '1'

// { shop: Zeile aus ticket_shops | null, konto: { verbunden, livemode, letzte4 } }
export function useTicketShop() {
  const { schule } = useApp()
  return useQuery({
    queryKey: ['na-ticketshop', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => {
      const [s, k] = await Promise.all([
        supabase.from('ticket_shops').select('*').eq('schule_id', schule.id).maybeSingle(),
        supabase.rpc('zahlungskonto_status', { p_schule_id: schule.id }),
      ])
      if (s.error || k.error) throw s.error ?? k.error
      return { shop: s.data, konto: k.data }
    },
  })
}

// wie der CHECK in ticket_shops
export const SLUG = /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/

const ERSATZ = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', ı: 'i', ş: 's', ğ: 'g', ç: 'c' }
// Vorschlag für die Adresse aus dem Schulnamen
export const slugAus = name => String(name ?? '').replace(/İ/g, 'i').toLowerCase().replace(/[äöüßışğç]/g, z => ERSATZ[z])
  .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').slice(0, 40).replace(/^-+|-+$/g, '')

export const shopLink = (slug, eventId) => slug ? `${window.location.origin}/shop/${slug}${eventId ? `?event=${eventId}` : ''}` : ''
