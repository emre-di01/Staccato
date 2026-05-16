import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { file_base64, media_type, schule_id } = await req.json()

    if (!file_base64 || !media_type) {
      return new Response(JSON.stringify({ error: 'file_base64 und media_type erforderlich' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    // API-Key der Schule aus der DB lesen (Service Role, damit RLS umgangen wird)
    let anthropicKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
    if (schule_id) {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      const { data } = await supabase
        .from('schulen')
        .select('anthropic_api_key')
        .eq('id', schule_id)
        .single()
      if (data?.anthropic_api_key) anthropicKey = data.anthropic_api_key
    }

    if (!anthropicKey) {
      return new Response(JSON.stringify({ error: 'Kein Anthropic API Key konfiguriert. Bitte in den Schuleinstellungen hinterlegen.' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const anthropic = new Anthropic({ apiKey: anthropicKey })

    // Claude unterstützt PDFs als document-type, Bilder als image-type
    const contentBlock = media_type === 'application/pdf'
      ? {
          type: 'document' as const,
          source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: file_base64 },
        }
      : {
          type: 'image' as const,
          source: { type: 'base64' as const, media_type: media_type as 'image/jpeg' | 'image/png' | 'image/webp', data: file_base64 },
        }

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      messages: [{
        role: 'user',
        content: [
          contentBlock,
          {
            type: 'text',
            text: `Analysiere diese Rechnung und antworte NUR mit einem JSON-Objekt – kein Markdown, keine Erklärung, nur reines JSON.

Gesuchte Felder:
- empfaenger: Name/Firma des Rechnungsausstellers (wer hat die Rechnung gestellt?)
- lieferanten_rechnung_nr: Rechnungsnummer des Ausstellers
- rechnungsdatum: Ausstellungsdatum im Format YYYY-MM-DD
- faellig_am: Zahlungsziel/Fälligkeitsdatum im Format YYYY-MM-DD (falls angegeben)
- betrag: Gesamtbetrag als Zahl (inkl. MwSt, ohne Währungszeichen)
- beschreibung: Kurze Beschreibung der Leistung (max. 80 Zeichen)
- ustid: USt-IdNr. des Ausstellers (falls angegeben)

Nicht gefundene Felder: null. Beispiel-Antwort:
{"empfaenger":"Müller GmbH","lieferanten_rechnung_nr":"RE-2024-0042","rechnungsdatum":"2024-03-15","faellig_am":"2024-04-14","betrag":595.00,"beschreibung":"Miete März 2024","ustid":"DE123456789"}`,
          },
        ],
      }],
    })

    const raw = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'

    // JSON aus der Antwort parsen (Claude hält sich meistens daran, aber sicher ist sicher)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    const data = jsonMatch ? JSON.parse(jsonMatch[0]) : {}

    return new Response(JSON.stringify(data), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('invoice-extract error:', e)
    return new Response(JSON.stringify({ error: e.message ?? 'Unbekannter Fehler' }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
