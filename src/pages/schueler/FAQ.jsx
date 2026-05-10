import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'

// aktion: { label, pfad } für Navigation oder { label, event } für Modal-Events
const FAQ_INHALT = {
  de: [
    {
      kategorie: '🏠 Erste Schritte',
      items: [
        {
          frage: 'Was sehe ich auf dem Dashboard?',
          antwort: 'Das Dashboard zeigt dir auf einen Blick deine nächste Stunde, wie viele Kurse du hast und deine Anwesenheitsrate. Klicke auf eine Karte, um direkt zur entsprechenden Seite zu springen.',
          aktion: { label: 'Zum Dashboard', pfad: '/schueler' },
        },
        {
          frage: 'Wie sehe ich meinen Stundenplan?',
          antwort: 'Klicke auf „Stundenplan" in der Navigation. Du siehst alle deine Stunden der aktuellen Woche. Mit den Pfeilen ‹ und › kannst du zwischen den Wochen wechseln. Tippe auf eine Stunde für Details.',
          aktion: { label: 'Zum Stundenplan', pfad: '/schueler/stundenplan' },
        },
        {
          frage: 'Wo finde ich meine Hausaufgaben?',
          antwort: 'Öffne deinen Kurs über „Meine Kurse" und wechsle zum Tab „Stunden". Dein Lehrer kann nach jeder Stunde Notizen und Hausaufgaben hinterlegen – du siehst sie direkt beim jeweiligen Termin.',
          aktion: { label: 'Zu Meine Kurse', pfad: '/schueler/kurse' },
        },
      ],
    },
    {
      kategorie: '📅 Kurse & Anwesenheit',
      items: [
        {
          frage: 'Wie entschuldige ich eine verpasste Stunde?',
          antwort: 'Öffne den Kurs → Tab „Stunden". Bei zukünftigen Terminen siehst du den Button „Entschuldigen". Dein Lehrer sieht deine Abmeldung sofort. Du kannst sie bis kurz vor der Stunde auch wieder rückgängig machen.',
          aktion: { label: 'Zu Meine Kurse', pfad: '/schueler/kurse' },
        },
        {
          frage: 'Was bedeuten die Symbole in der Anwesenheit?',
          antwort: '✅ Anwesend · ⏰ Zu spät · 🟡 Entschuldigt · ❌ Abwesend\n\nDie Anwesenheitsrate wird nach mindestens 3 Stunden berechnet und auf dem Dashboard als Prozentzahl angezeigt.',
        },
        {
          frage: 'Warum sehe ich eine Stunde als „Abgesagt"?',
          antwort: 'Dein Lehrer hat die Stunde abgesagt. Abgesagte Stunden werden grau und durchgestrichen dargestellt. Du wirst in solchen Fällen in der Regel per Nachricht informiert.',
          aktion: { label: 'Zum Stundenplan', pfad: '/schueler/stundenplan' },
        },
      ],
    },
    {
      kategorie: '🎼 Repertoire & Materialien',
      items: [
        {
          frage: 'Was ist das Repertoire?',
          antwort: 'Das Repertoire zeigt alle Stücke, die du gerade in deinen Kursen übst. Tippe auf ein Stück, um Liedtext, Noten, Akkorde, Audio-Aufnahmen oder YouTube-Videos zu öffnen.',
          aktion: { label: 'Zum Repertoire', pfad: '/schueler/repertoire' },
        },
        {
          frage: 'Wo finde ich meine Noten und Dateien?',
          antwort: 'Im Kursdetail unter dem Tab „Dateien" findest du Dateien, die dein Lehrer speziell für dich hochgeladen hat (z. B. deine Stimmnoten). Im Repertoire-Tab des Kurses siehst du alle Stücke mit ihren Materialien.',
          aktion: { label: 'Zu Meine Kurse', pfad: '/schueler/kurse' },
        },
        {
          frage: 'Wie nutze ich den Liedtext?',
          antwort: 'Im Repertoire auf ein Stück tippen → Tab „Text". Der Text ist formatiert dargestellt. Mit dem „MD | Plain"-Schalter kannst du zwischen schöner Darstellung und reinem Text wechseln.',
          aktion: { label: 'Zum Repertoire', pfad: '/schueler/repertoire' },
        },
      ],
    },
    {
      kategorie: '💬 Nachrichten',
      items: [
        {
          frage: 'Wie funktionieren Nachrichten?',
          antwort: 'Dein Lehrer und die Musikschule können dir direkte Nachrichten oder Kursnachrichten schicken. Du siehst alle eingegangenen Nachrichten im Posteingang. Ungelesene werden farbig hervorgehoben.',
          aktion: { label: 'Zu Nachrichten', pfad: '/schueler/nachrichten' },
        },
        {
          frage: 'Kann ich selbst Nachrichten schreiben?',
          antwort: 'Derzeit können Schüler keine Nachrichten senden. Wenn du etwas mitteilen möchtest, wende dich direkt an deinen Lehrer oder die Musikschule.',
        },
      ],
    },
    {
      kategorie: '📡 Live-Session',
      items: [
        {
          frage: 'Was ist eine Live-Session?',
          antwort: 'Dein Lehrer kann eine Live-Session starten und dir einen 6-stelligen Code oder QR-Code schicken. Gib den Code unter „Session beitreten" ein – dann siehst du live, was dein Lehrer gerade zeigt: Noten, Liedtext, Akkorde oder Videos. Du kannst außerdem mit Emojis reagieren.',
          aktion: { label: 'Session beitreten', event: 'staccato:open-join-session' },
        },
      ],
    },
    {
      kategorie: '⚙️ App & Profil',
      items: [
        {
          frage: 'Wie ändere ich meine Sprache?',
          antwort: 'Klicke auf das ⚙️-Symbol in der Seitenleiste. Dort kannst du zwischen Deutsch, Englisch und Türkisch wechseln. Die Sprache wird sofort angewendet.',
          aktion: { label: 'Einstellungen öffnen', pfad: '/einstellungen' },
        },
        {
          frage: 'Wie ändere ich mein Passwort oder meine Daten?',
          antwort: 'Klicke in der Navigation auf „Profil". Dort kannst du deinen Namen, Telefonnummer, Adresse und dein Passwort aktualisieren. Vergiss nicht zu speichern!',
          aktion: { label: 'Zum Profil', pfad: '/profil' },
        },
        {
          frage: 'Wie starte ich die App-Tour neu?',
          antwort: 'Im Profil gibt es den Abschnitt „Tour neu starten". Klicke den Button und du wirst beim nächsten Öffnen der App durch alle wichtigen Funktionen geführt.',
          aktion: { label: 'Zum Profil', pfad: '/profil' },
        },
        {
          frage: 'Funktioniert die App auch ohne Internet?',
          antwort: 'Die App ist als Progressive Web App (PWA) installierbar. Einmal geladene Seiten können auch offline angezeigt werden. Neue Daten (Stunden, Nachrichten) benötigen jedoch eine Internetverbindung.',
        },
      ],
    },
  ],

  en: [
    {
      kategorie: '🏠 Getting Started',
      items: [
        {
          frage: 'What do I see on the Dashboard?',
          antwort: 'The Dashboard shows you at a glance your next lesson, how many courses you have, and your attendance rate. Tap a card to jump directly to the relevant page.',
          aktion: { label: 'Go to Dashboard', pfad: '/schueler' },
        },
        {
          frage: 'How do I see my schedule?',
          antwort: 'Tap "Schedule" in the navigation. You see all your lessons for the current week. Use the ‹ and › arrows to navigate between weeks. Tap a lesson for details.',
          aktion: { label: 'Go to Schedule', pfad: '/schueler/stundenplan' },
        },
        {
          frage: 'Where do I find my homework?',
          antwort: 'Open your course via "My Courses" and switch to the "Schedule" tab. Your teacher can add notes and homework after each lesson – you see them directly on the respective date.',
          aktion: { label: 'Go to My Courses', pfad: '/schueler/kurse' },
        },
      ],
    },
    {
      kategorie: '📅 Courses & Attendance',
      items: [
        {
          frage: 'How do I excuse a missed lesson?',
          antwort: 'Open the course → tab "Schedule". For upcoming lessons you\'ll see an "Excuse" button. Your teacher sees your notice immediately. You can also undo it until shortly before the lesson.',
          aktion: { label: 'Go to My Courses', pfad: '/schueler/kurse' },
        },
        {
          frage: 'What do the attendance symbols mean?',
          antwort: '✅ Present · ⏰ Late · 🟡 Excused · ❌ Absent\n\nYour attendance rate is calculated after at least 3 lessons and shown as a percentage on the Dashboard.',
        },
        {
          frage: 'Why does a lesson show as "Cancelled"?',
          antwort: 'Your teacher cancelled the lesson. Cancelled lessons are shown greyed out. You will usually be informed via a message in such cases.',
          aktion: { label: 'Go to Schedule', pfad: '/schueler/stundenplan' },
        },
      ],
    },
    {
      kategorie: '🎼 Repertoire & Materials',
      items: [
        {
          frage: 'What is the Repertoire?',
          antwort: 'The Repertoire shows all pieces you are currently practising in your courses. Tap a piece to open lyrics, sheet music, chords, audio recordings or YouTube videos.',
          aktion: { label: 'Go to Repertoire', pfad: '/schueler/repertoire' },
        },
        {
          frage: 'Where do I find my sheet music and files?',
          antwort: 'In the course detail under the "Files" tab you find files your teacher has uploaded specifically for you (e.g. your vocal part). The Repertoire tab of the course shows all pieces with their materials.',
          aktion: { label: 'Go to My Courses', pfad: '/schueler/kurse' },
        },
        {
          frage: 'How do I use the lyrics view?',
          antwort: 'Tap a piece in the Repertoire → tab "Text". The lyrics are displayed formatted. Use the "MD | Plain" toggle to switch between rich formatting and plain text.',
          aktion: { label: 'Go to Repertoire', pfad: '/schueler/repertoire' },
        },
      ],
    },
    {
      kategorie: '💬 Messages',
      items: [
        {
          frage: 'How do messages work?',
          antwort: 'Your teacher and the music school can send you direct messages or course messages. All received messages appear in your inbox. Unread ones are highlighted.',
          aktion: { label: 'Go to Messages', pfad: '/schueler/nachrichten' },
        },
        {
          frage: 'Can I send messages myself?',
          antwort: 'Currently students cannot send messages. If you want to get in touch, contact your teacher or the music school directly.',
        },
      ],
    },
    {
      kategorie: '📡 Live Session',
      items: [
        {
          frage: 'What is a live session?',
          antwort: 'Your teacher can start a live session and share a 6-character code or QR code with you. Enter the code under "Join session" – you then see live what your teacher is showing: sheet music, lyrics, chords or videos. You can also react with emojis.',
          aktion: { label: 'Join session', event: 'staccato:open-join-session' },
        },
      ],
    },
    {
      kategorie: '⚙️ App & Profile',
      items: [
        {
          frage: 'How do I change my language?',
          antwort: 'Click the ⚙️ icon in the sidebar. There you can switch between German, English and Turkish. The language is applied immediately.',
          aktion: { label: 'Open Settings', pfad: '/einstellungen' },
        },
        {
          frage: 'How do I change my password or details?',
          antwort: 'Click "Profile" in the navigation. There you can update your name, phone number, address and password. Don\'t forget to save!',
          aktion: { label: 'Go to Profile', pfad: '/profil' },
        },
        {
          frage: 'How do I restart the app tour?',
          antwort: 'In your Profile there is a "Restart tour" section. Click the button and the next time you open the app you will be guided through all the key features again.',
          aktion: { label: 'Go to Profile', pfad: '/profil' },
        },
        {
          frage: 'Does the app work without internet?',
          antwort: 'The app can be installed as a Progressive Web App (PWA). Pages that have been loaded once can also be viewed offline. New data (lessons, messages) does however require an internet connection.',
        },
      ],
    },
  ],

  tr: [
    {
      kategorie: '🏠 Başlarken',
      items: [
        {
          frage: 'Kontrol Paneli\'nde ne görürüm?',
          antwort: 'Kontrol Paneli, bir bakışta bir sonraki dersinizi, kaç kursa kayıtlı olduğunuzu ve devam oranınızı gösterir. İlgili sayfaya gitmek için bir karta dokunun.',
          aktion: { label: 'Panele Git', pfad: '/schueler' },
        },
        {
          frage: 'Ders programımı nasıl görebilirim?',
          antwort: 'Navigasyonda "Ders Programı"na dokunun. Mevcut haftanın tüm derslerini görürsünüz. Haftalar arasında geçiş yapmak için ‹ ve › oklarını kullanın. Ayrıntılar için bir derse dokunun.',
          aktion: { label: 'Ders Programına Git', pfad: '/schueler/stundenplan' },
        },
        {
          frage: 'Ödevlerimi nerede bulabilirim?',
          antwort: '"Kurslarım" üzerinden kursunuzu açın ve "Dersler" sekmesine geçin. Öğretmeniniz her dersten sonra not ve ödev ekleyebilir – bunları ilgili tarihte doğrudan görürsünüz.',
          aktion: { label: 'Kurslarıma Git', pfad: '/schueler/kurse' },
        },
      ],
    },
    {
      kategorie: '📅 Kurslar ve Devam',
      items: [
        {
          frage: 'Kaçırdığım bir dersi nasıl mazeret bildiririm?',
          antwort: 'Kursu açın → "Dersler" sekmesi. Yaklaşan dersler için "Mazeret Bildir" düğmesini göreceksiniz. Öğretmeniniz bildiriminizi hemen görür. Dersten kısa süre öncesine kadar geri alabilirsiniz.',
          aktion: { label: 'Kurslarıma Git', pfad: '/schueler/kurse' },
        },
        {
          frage: 'Devam sembolleri ne anlama geliyor?',
          antwort: '✅ Mevcut · ⏰ Geç · 🟡 Mazeretli · ❌ Devamsız\n\nDevam oranınız en az 3 dersten sonra hesaplanır ve Kontrol Paneli\'nde yüzde olarak gösterilir.',
        },
        {
          frage: 'Bir ders neden "İptal Edildi" olarak görünüyor?',
          antwort: 'Öğretmeniniz dersi iptal etti. İptal edilen dersler gri renkte gösterilir. Bu durumlarda genellikle bir mesajla bilgilendirilirsiniz.',
          aktion: { label: 'Ders Programına Git', pfad: '/schueler/stundenplan' },
        },
      ],
    },
    {
      kategorie: '🎼 Repertuar ve Materyaller',
      items: [
        {
          frage: 'Repertuar nedir?',
          antwort: 'Repertuar, kurslarınızda şu anda çalıştığınız tüm parçaları gösterir. Sözleri, notaları, akorları, ses kayıtlarını veya YouTube videolarını açmak için bir parçaya dokunun.',
          aktion: { label: 'Repertuara Git', pfad: '/schueler/repertoire' },
        },
        {
          frage: 'Notalarımı ve dosyalarımı nerede bulabilirim?',
          antwort: 'Kurs ayrıntısında "Dosyalar" sekmesi altında öğretmeninizin özellikle sizin için yüklediği dosyaları bulursunuz (örn. ses partınız). Kursun Repertuar sekmesi tüm parçaları materyalleriyle birlikte gösterir.',
          aktion: { label: 'Kurslarıma Git', pfad: '/schueler/kurse' },
        },
        {
          frage: 'Güfte görünümünü nasıl kullanırım?',
          antwort: 'Repertuardaki bir parçaya dokunun → "Metin" sekmesi. Güfteler biçimlendirilmiş olarak gösterilir. Zengin biçimlendirme ile düz metin arasında geçiş yapmak için "MD | Düz" geçiş düğmesini kullanın.',
          aktion: { label: 'Repertuara Git', pfad: '/schueler/repertoire' },
        },
      ],
    },
    {
      kategorie: '💬 Mesajlar',
      items: [
        {
          frage: 'Mesajlar nasıl çalışır?',
          antwort: 'Öğretmeniniz ve müzik okulu size doğrudan mesaj veya kurs mesajı gönderebilir. Gelen tüm mesajlar gelen kutunuzda görünür. Okunmamış olanlar vurgulanır.',
          aktion: { label: 'Mesajlara Git', pfad: '/schueler/nachrichten' },
        },
        {
          frage: 'Kendim mesaj gönderebilir miyim?',
          antwort: 'Şu anda öğrenciler mesaj gönderememektedir. İletişim kurmak istiyorsanız öğretmeninize veya müzik okuluna doğrudan başvurun.',
        },
      ],
    },
    {
      kategorie: '📡 Canlı Oturum',
      items: [
        {
          frage: 'Canlı oturum nedir?',
          antwort: 'Öğretmeniniz bir canlı oturum başlatabilir ve size 6 haneli bir kod veya QR kodu paylaşabilir. Kodu "Oturuma katıl" bölümüne girin – ardından öğretmeninizin canlı olarak gösterdiklerini görürsünüz: notalar, güfteler, akorlar veya videolar. Ayrıca emoji ile tepki verebilirsiniz.',
          aktion: { label: 'Oturuma Katıl', event: 'staccato:open-join-session' },
        },
      ],
    },
    {
      kategorie: '⚙️ Uygulama ve Profil',
      items: [
        {
          frage: 'Dilimi nasıl değiştirebilirim?',
          antwort: 'Kenar çubuğundaki ⚙️ simgesine tıklayın. Orada Almanca, İngilizce ve Türkçe arasında geçiş yapabilirsiniz. Dil hemen uygulanır.',
          aktion: { label: 'Ayarları Aç', pfad: '/einstellungen' },
        },
        {
          frage: 'Şifremi veya bilgilerimi nasıl değiştirebilirim?',
          antwort: 'Navigasyonda "Profil"e tıklayın. Orada adınızı, telefon numaranızı, adresinizi ve şifrenizi güncelleyebilirsiniz. Kaydetmeyi unutmayın!',
          aktion: { label: 'Profile Git', pfad: '/profil' },
        },
        {
          frage: 'Uygulama turunu nasıl yeniden başlatabilirim?',
          antwort: 'Profilinizde "Turu yeniden başlat" bölümü bulunur. Düğmeye tıkladığınızda uygulamayı bir sonraki açışınızda tüm temel özellikler yeniden gösterilir.',
          aktion: { label: 'Profile Git', pfad: '/profil' },
        },
        {
          frage: 'Uygulama internet olmadan çalışır mı?',
          antwort: 'Uygulama, Progressive Web App (PWA) olarak kurulabilir. Bir kez yüklenen sayfalar çevrimdışı da görüntülenebilir. Ancak yeni veriler (dersler, mesajlar) internet bağlantısı gerektirir.',
        },
      ],
    },
  ],
}

function FaqItem({ frage, antwort, aktion }) {
  const [offen, setOffen] = useState(false)
  const navigate = useNavigate()

  function handleAktion(e) {
    e.stopPropagation()
    if (aktion.pfad) navigate(aktion.pfad)
    else if (aktion.event) window.dispatchEvent(new Event(aktion.event))
  }

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={() => setOffen(v => !v)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          padding: '16px 20px', cursor: 'pointer', fontFamily: 'inherit',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', lineHeight: 1.4 }}>{frage}</span>
        <span style={{
          fontSize: 18, color: 'var(--text-3)', flexShrink: 0,
          transform: offen ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s ease',
        }}>⌄</span>
      </button>
      {offen && (
        <div style={{ padding: '0 20px 18px', fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, whiteSpace: 'pre-line' }}>
          {antwort}
          {aktion && (
            <div style={{ marginTop: 14 }}>
              <button
                onClick={handleAktion}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: 'var(--primary)', color: '#fff', border: 'none',
                  borderRadius: 'var(--radius)', padding: '8px 16px',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                {aktion.label} →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function FAQ() {
  const { lang, T } = useApp()
  const inhalt = FAQ_INHALT[lang] ?? FAQ_INHALT.de

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
          ❓ {T('faq_title')}
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--text-3)' }}>{T('faq_subtitle')}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {inhalt.map((gruppe, gi) => (
          <div key={gi} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-2)' }}>
              <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text)' }}>{gruppe.kategorie}</div>
            </div>
            {gruppe.items.map((item, ii) => (
              <FaqItem key={ii} frage={item.frage} antwort={item.antwort} aktion={item.aktion} />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
