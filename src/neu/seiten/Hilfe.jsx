import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, Mail, Phone } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile } from '../../ui'

// Fragen und Antworten zur neuen Oberfläche. Wie in der alten FAQ steht der Inhalt
// hier statt in translations.js, weil es längere Texte sind.
const FRAGEN = {
  de: [
    { titel: 'Termine', items: [
      { f: 'Wie sage ich eine Stunde ab?', a: 'Tippe auf „Start“ bei deinem nächsten Termin auf „Ich kann nicht“. Bei späteren Stunden findest du den Knopf unter „Termine“. Deine Lehrkraft sieht die Absage sofort. Hast du dich vertan, tippe auf „Rückgängig“ bzw. „Doch dabei“.', zu: ['/schueler/stundenplan', 'Zu den Terminen'] },
      { f: 'Wie sage ich bei einer Veranstaltung zu?', a: 'Unter „Termine“ steht bei Konzerten und anderen Veranstaltungen „Ich bin dabei“ und „Ich kann nicht“. Deine Antwort kannst du später noch ändern.', zu: ['/schueler/stundenplan', 'Zu den Terminen'] },
      { f: 'Kann ich meine Termine in meinen Kalender übernehmen?', a: 'Ja. Unter „Ich“ → „Weitere Einstellungen“ → „Kalender“ kopierst du einen Link. Diesen fügst du in deiner Kalender-App (z. B. Google oder Apple) als Abonnement ein. Neue Termine erscheinen dann automatisch.', zu: ['/einstellungen', 'Zu den Einstellungen'] },
    ]},
    { titel: 'Lieder', items: [
      { f: 'Wo finde ich Liedtext, Akkorde und Noten?', a: 'Tippe unten auf „Lieder“ und dann auf ein Lied. Oben wechselst du zwischen „Text“, „Akkorde“ und „Dateien“. Unter „Dateien“ liegen Noten, Aufnahmen und Videos.', zu: ['/schueler/repertoire', 'Zu den Liedern'] },
      { f: 'Wie mache ich die Schrift im Liedtext größer?', a: 'Tippe im Lied oben rechts auf „Aa“. Es gibt drei Größen. Die Wahl bleibt für alle Lieder gespeichert.' },
      { f: 'Wie schlage ich ein neues Lied vor?', a: 'Unter „Lieder“ oben rechts auf „Vorschlagen“ tippen, Kurs wählen und Titel eintragen. Deine Lehrkraft entscheidet, ob das Lied aufgenommen wird. Die Antwort siehst du auf „Start“ und unter „Lieder“ → „Meine Vorschläge“.', zu: ['/schueler/repertoire', 'Zu den Liedern'] },
      { f: 'Im Liedtext ist ein Fehler. Was tun?', a: 'Öffne das Lied und tippe unten auf „Textänderung vorschlagen“. Ändere den Text und sende ihn ab. Deine Lehrkraft sieht genau, was du geändert hast.' },
    ]},
    { titel: 'Dateien und Nachrichten', items: [
      { f: 'Wo lege ich eigene Aufnahmen oder Noten ab?', a: 'Unter „Ich“ → „Meine Dateien“ oder direkt im Lied unter „Dateien“. Du bestimmst bei jeder Datei, wer sie sehen darf: nur du, du und die Lehrkräfte, oder alle aus der Schule.', zu: ['/meine-dateien', 'Zu meinen Dateien'] },
      { f: 'Wo finde ich meinen Vertrag oder das SEPA-Mandat?', a: 'Unter „Ich“ → „Dokumente“. Dort liegen alle Unterlagen, die die Schule für dich hinterlegt hat.', zu: ['/schueler/dateien', 'Zu den Dokumenten'] },
      { f: 'Wo sehe ich Nachrichten?', a: 'Auf „Start“ oben rechts über das Sprechblasen-Symbol oder unter „Ich“ → „Nachrichten“. Ein Punkt zeigt neue Nachrichten an.', zu: ['/schueler/nachrichten', 'Zu den Nachrichten'] },
    ]},
    { titel: 'Darstellung und Konto', items: [
      { f: 'Die Schrift ist mir zu klein.', a: 'Unter „Ich“ → „Darstellung“ kannst du mit „A+“ die Schrift in der ganzen App vergrößern.', zu: ['/schueler/ich', 'Zu „Ich“'] },
      { f: 'Wie stelle ich hell oder dunkel ein?', a: 'Unter „Ich“ → „Darstellung“. „Automatisch“ richtet sich nach der Einstellung deines Handys.', zu: ['/schueler/ich', 'Zu „Ich“'] },
      { f: 'Wie komme ich zur alten Ansicht zurück?', a: 'Unter „Ich“ den Schalter „Neues Design“ ausschalten. Du kannst jederzeit wieder wechseln.' },
      { f: 'Wie ändere ich mein Passwort?', a: 'Unter „Ich“ auf „Bearbeiten“ tippen und dann „Passwort ändern“ wählen.', zu: ['/schueler/profil', 'Zum Profil'] },
    ]},
  ],
  en: [
    { titel: 'Schedule', items: [
      { f: 'How do I cancel a lesson?', a: 'On “Home”, tap “I can’t make it” on your next session. For later lessons you’ll find the button under “Schedule”. Your teacher sees it right away. Made a mistake? Tap “Undo” or “I can come after all”.', zu: ['/schueler/stundenplan', 'Go to schedule'] },
      { f: 'How do I reply to an event invitation?', a: 'Under “Schedule”, concerts and other events show “I’ll be there” and “I can’t make it”. You can change your answer later.', zu: ['/schueler/stundenplan', 'Go to schedule'] },
      { f: 'Can I add my dates to my calendar?', a: 'Yes. Under “Me” → “More settings” → “Calendar” you copy a link. Add it as a subscription in your calendar app (e.g. Google or Apple). New dates then appear automatically.', zu: ['/einstellungen', 'Go to settings'] },
    ]},
    { titel: 'Songs', items: [
      { f: 'Where are lyrics, chords and sheet music?', a: 'Tap “Songs” at the bottom, then a song. At the top you switch between “Lyrics”, “Chords” and “Files”. Sheet music, recordings and videos are under “Files”.', zu: ['/schueler/repertoire', 'Go to songs'] },
      { f: 'How do I make the lyrics bigger?', a: 'In a song, tap “Aa” at the top right. There are three sizes. Your choice is kept for all songs.' },
      { f: 'How do I suggest a new song?', a: 'Under “Songs”, tap “Suggest” at the top right, choose a course and enter the title. Your teacher decides whether it is added. You’ll see the answer on “Home” and under “Songs” → “My suggestions”.', zu: ['/schueler/repertoire', 'Go to songs'] },
      { f: 'There’s a mistake in the lyrics. What can I do?', a: 'Open the song and tap “Suggest a text change” at the bottom. Edit the text and send it. Your teacher sees exactly what you changed.' },
    ]},
    { titel: 'Files and messages', items: [
      { f: 'Where can I store my own recordings or sheet music?', a: 'Under “Me” → “My files”, or in a song under “Files”. For each file you decide who may see it: only you, you and the teachers, or everyone at the school.', zu: ['/meine-dateien', 'Go to my files'] },
      { f: 'Where is my contract or SEPA mandate?', a: 'Under “Me” → “Documents”. All documents the school has stored for you are there.', zu: ['/schueler/dateien', 'Go to documents'] },
      { f: 'Where do I see messages?', a: 'On “Home” via the speech bubble at the top right, or under “Me” → “Messages”. A dot marks new messages.', zu: ['/schueler/nachrichten', 'Go to messages'] },
    ]},
    { titel: 'Display and account', items: [
      { f: 'The text is too small for me.', a: 'Under “Me” → “Display”, use “A+” to enlarge the text throughout the app.', zu: ['/schueler/ich', 'Go to “Me”'] },
      { f: 'How do I switch between light and dark?', a: 'Under “Me” → “Display”. “Automatic” follows your phone’s setting.', zu: ['/schueler/ich', 'Go to “Me”'] },
      { f: 'How do I go back to the old view?', a: 'Under “Me”, turn off the “New design” switch. You can switch again at any time.' },
      { f: 'How do I change my password?', a: 'Under “Me”, tap “Edit”, then choose “Change password”.', zu: ['/schueler/profil', 'Go to profile'] },
    ]},
  ],
  tr: [
    { titel: 'Takvim', items: [
      { f: 'Bir dersi nasıl iptal ederim?', a: '“Ana sayfa”da bir sonraki dersinizde “Katılamıyorum”a dokunun. Sonraki dersler için düğmeyi “Takvim” altında bulursunuz. Öğretmeniniz bunu hemen görür. Yanlışlıkla mı bastınız? “Geri al” veya “Yine de katılıyorum”a dokunun.', zu: ['/schueler/stundenplan', 'Takvime git'] },
      { f: 'Bir etkinlik davetine nasıl yanıt veririm?', a: '“Takvim” altında konserlerde ve diğer etkinliklerde “Katılıyorum” ve “Katılamıyorum” düğmeleri vardır. Yanıtınızı daha sonra değiştirebilirsiniz.', zu: ['/schueler/stundenplan', 'Takvime git'] },
      { f: 'Derslerimi kendi takvimime ekleyebilir miyim?', a: 'Evet. “Ben” → “Diğer ayarlar” → “Takvim” altında bir bağlantı kopyalarsınız. Bunu takvim uygulamanıza (ör. Google veya Apple) abonelik olarak ekleyin. Yeni dersler otomatik olarak görünür.', zu: ['/einstellungen', 'Ayarlara git'] },
    ]},
    { titel: 'Şarkılar', items: [
      { f: 'Şarkı sözleri, akorlar ve notalar nerede?', a: 'Alttaki “Şarkılar”a, ardından bir şarkıya dokunun. Üstte “Söz”, “Akorlar” ve “Dosyalar” arasında geçiş yaparsınız. Notalar, kayıtlar ve videolar “Dosyalar” altındadır.', zu: ['/schueler/repertoire', 'Şarkılara git'] },
      { f: 'Şarkı sözlerini nasıl büyütürüm?', a: 'Şarkıda sağ üstteki “Aa”ya dokunun. Üç boyut vardır. Seçiminiz tüm şarkılar için saklanır.' },
      { f: 'Yeni bir şarkıyı nasıl öneririm?', a: '“Şarkılar”da sağ üstteki “Öner”e dokunun, bir ders seçin ve başlığı girin. Şarkının eklenip eklenmeyeceğine öğretmeniniz karar verir. Yanıtı “Ana sayfa”da ve “Şarkılar” → “Önerilerim” altında görürsünüz.', zu: ['/schueler/repertoire', 'Şarkılara git'] },
      { f: 'Şarkı sözlerinde bir hata var. Ne yapmalıyım?', a: 'Şarkıyı açın ve alttaki “Metin değişikliği öner”e dokunun. Metni düzenleyip gönderin. Öğretmeniniz neyi değiştirdiğinizi tam olarak görür.' },
    ]},
    { titel: 'Dosyalar ve mesajlar', items: [
      { f: 'Kendi kayıtlarımı veya notalarımı nereye koyarım?', a: '“Ben” → “Dosyalarım” altına veya doğrudan şarkıda “Dosyalar” altına. Her dosya için kimin görebileceğini siz belirlersiniz: yalnızca siz, siz ve öğretmenler ya da okuldaki herkes.', zu: ['/meine-dateien', 'Dosyalarıma git'] },
      { f: 'Sözleşmem veya SEPA talimatım nerede?', a: '“Ben” → “Belgeler” altında. Okulun sizin için yüklediği tüm belgeler oradadır.', zu: ['/schueler/dateien', 'Belgelere git'] },
      { f: 'Mesajları nerede görürüm?', a: '“Ana sayfa”da sağ üstteki konuşma balonundan veya “Ben” → “Mesajlar” altında. Yeni mesajlar bir noktayla işaretlenir.', zu: ['/schueler/nachrichten', 'Mesajlara git'] },
    ]},
    { titel: 'Görünüm ve hesap', items: [
      { f: 'Yazılar bana çok küçük geliyor.', a: '“Ben” → “Görünüm” altında “A+” ile uygulamadaki tüm yazıları büyütebilirsiniz.', zu: ['/schueler/ich', '“Ben”e git'] },
      { f: 'Açık veya koyu görünümü nasıl ayarlarım?', a: '“Ben” → “Görünüm” altında. “Otomatik” telefonunuzun ayarını izler.', zu: ['/schueler/ich', '“Ben”e git'] },
      { f: 'Eski görünüme nasıl dönerim?', a: '“Ben” altında “Yeni tasarım” anahtarını kapatın. İstediğiniz zaman tekrar geçebilirsiniz.' },
      { f: 'Şifremi nasıl değiştiririm?', a: '“Ben” altında “Düzenle”ye dokunun, ardından “Şifre değiştir”i seçin.', zu: ['/schueler/profil', 'Profile git'] },
    ]},
  ],
}

export default function NeuHilfe() {
  const { T, lang, schule } = useApp()
  const gruppen = FRAGEN[lang] ?? FRAGEN.de
  const [offen, setOffen] = useState(null)

  return (
    <Seite titel={T('n_hilfe')} zurueck={{ to: '/schueler/ich', label: T('n_tab_ich') }}>
      {gruppen.map((g, gi) => (
        <Abschnitt key={g.titel} titel={g.titel} style={{ marginTop: gi === 0 ? 24 : 32 }}>
          <Gruppe>
            {g.items.map((it, i) => {
              const id = `${gi}-${i}`
              const auf = offen === id
              return (
                <div key={id}>
                  {i > 0 && <Trenner />}
                  <button onClick={() => setOffen(auf ? null : id)} aria-expanded={auf} aria-controls={`hilfe-${id}`}
                    style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, padding: '14px 16px', border: 'none', background: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 17, fontWeight: 600, textAlign: 'left', cursor: 'pointer' }}>
                    <span style={{ flex: 1 }}>{it.f}</span>
                    <ChevronDown aria-hidden="true" size={22} color="var(--n-chev)" style={{ flexShrink: 0, transform: auf ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                  </button>
                  {auf && (
                    <div id={`hilfe-${id}`} style={{ padding: '0 16px 16px', fontSize: 17, lineHeight: 1.6, color: 'var(--text-2)' }}>
                      {it.a}
                      {it.zu && (
                        <div style={{ marginTop: 10 }}>
                          <Link to={it.zu[0]} style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, fontSize: 17, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }}>{it.zu[1]} ›</Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </Gruppe>
        </Abschnitt>
      ))}

      {(schule?.email || schule?.telefon) && (
        <Abschnitt titel={T('n_frage_an_schule')}>
          <Gruppe>
            {schule.telefon && <Zeile icon={Phone} titel={schule.telefon} untertitel={T('n_anrufen')} href={`tel:${schule.telefon.replace(/[^\d+]/g, '')}`} />}
            {schule.telefon && schule.email && <Trenner />}
            {schule.email && <Zeile icon={Mail} titel={schule.email} untertitel={T('n_email_schreiben')} href={`mailto:${schule.email}`} />}
          </Gruppe>
        </Abschnitt>
      )}
    </Seite>
  )
}
