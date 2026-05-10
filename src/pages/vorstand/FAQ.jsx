import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'

const FAQ_INHALT = {
  de: [
    {
      kategorie: '📊 Dashboard & Übersicht',
      items: [
        {
          frage: 'Was zeigt das Vorstand-Dashboard?',
          antwort: 'Das Dashboard zeigt dir auf einen Blick: offene Aufgaben, Anzahl der Ziele, Protokolle und den nächsten Sitzungstermin. Darunter siehst du die Schüler-Kacheln mit ihren aktuellen Kursen und Stunden. Klicke auf eine KPI-Karte, um direkt zur zugehörigen Seite zu springen.',
          aktion: { label: 'Zum Dashboard', pfad: '/vorstand' },
        },
        {
          frage: 'Was sind die KPI-Karten?',
          antwort: '✅ Offene Aufgaben — Tasks die noch erledigt werden müssen\n🎯 Ziele — Anzahl der aktiven Jahresziele\n📝 Protokolle — Anzahl der gespeicherten Sitzungsprotokolle\n\nKlicke auf eine Karte, um die Details zu öffnen.',
          aktion: { label: 'Zum Dashboard', pfad: '/vorstand' },
        },
      ],
    },
    {
      kategorie: '🎯 Ziele & Aufgaben',
      items: [
        {
          frage: 'Wie lege ich ein neues Ziel an?',
          antwort: 'Gehe zu „Ziele" und klicke auf „+ Ziel hinzufügen". Du kannst Titel, Beschreibung, Zeitraum (jährlich oder quartalsweise) und Status festlegen. Aufgaben kannst du direkt unterhalb des Ziels hinzufügen.',
          aktion: { label: 'Zu Ziele', pfad: '/vorstand/ziele' },
        },
        {
          frage: 'Was sind Aufgaben und wie funktioniert der Status?',
          antwort: 'Jedes Ziel kann mehrere Aufgaben haben. Der Status durchläuft drei Stufen:\n\n🔵 Offen → 🟡 In Bearbeitung → ✅ Erledigt\n\nKlicke auf den Status-Badge einer Aufgabe, um ihn weiterzuschalten. Die verantwortliche Person kannst du aus allen Vorstand-Mitgliedern wählen.',
          aktion: { label: 'Zu Ziele', pfad: '/vorstand/ziele' },
        },
        {
          frage: 'Kann ich Ziele ausblenden oder archivieren?',
          antwort: 'Ziele können zugeklappt werden (Klick auf den Ziel-Header). Erledigte Ziele bleiben in der Liste sichtbar, damit du den Überblick über den Fortschritt behältst.',
          aktion: { label: 'Zu Ziele', pfad: '/vorstand/ziele' },
        },
      ],
    },
    {
      kategorie: '📝 Protokolle',
      items: [
        {
          frage: 'Wie erstelle ich ein Sitzungsprotokoll?',
          antwort: 'Gehe zu „Protokolle" und klicke auf „+ Protokoll". Fülle Datum, Teilnehmer (aus allen Vorstandsmitgliedern wählbar), Inhalt und Beschlüsse aus. Optional kannst du das Protokoll mit einem Veranstaltungstermin verknüpfen.',
          aktion: { label: 'Zu Protokolle', pfad: '/vorstand/protokolle' },
        },
        {
          frage: 'Kann ich Dateien an ein Protokoll anhängen?',
          antwort: 'Ja. Im Protokoll-Detail kannst du beliebig viele Dateien hochladen (z. B. Tagesordnung, Anlagen). Die Dateien werden sicher gespeichert und sind nur für Vorstandsmitglieder sichtbar.',
          aktion: { label: 'Zu Protokolle', pfad: '/vorstand/protokolle' },
        },
        {
          frage: 'Wie verknüpfe ich ein Protokoll mit einer Vorstandssitzung?',
          antwort: 'Beim Erstellen oder Bearbeiten eines Protokolls gibt es ein Dropdown „Verknüpfte Veranstaltung". Dort erscheinen alle Events vom Typ „Vorstandssitzung" deiner Musikschule.',
          aktion: { label: 'Zu Protokolle', pfad: '/vorstand/protokolle' },
        },
      ],
    },
    {
      kategorie: '📦 Inventar',
      items: [
        {
          frage: 'Wie füge ich einen neuen Inventargegenstand hinzu?',
          antwort: 'Gehe zu „Inventar" und klicke auf „+ Hinzufügen". Wähle Kategorie, Namen, Zustand (Neu / Gut / Gebraucht / Defekt) und optional Anschaffungswert und Datum. Die Inventarnummer wird automatisch vergeben.',
          aktion: { label: 'Zum Inventar', pfad: '/vorstand/inventar' },
        },
        {
          frage: 'Was bedeuten die Zustands-Symbole?',
          antwort: '🟢 Neu — gerade angeschafft\n🔵 Gut — in einwandfreiem Zustand\n🟡 Gebraucht — sichtbare Abnutzung\n🔴 Defekt — außer Betrieb\n\nDer Gesamtwert des Inventars wird auf dem Dashboard angezeigt.',
          aktion: { label: 'Zum Inventar', pfad: '/vorstand/inventar' },
        },
      ],
    },
    {
      kategorie: '📅 Schüler-Bereich',
      items: [
        {
          frage: 'Warum sehe ich Kurse und einen Stundenplan?',
          antwort: 'Als Vorstandsmitglied hast du auch Zugang zum Schüler-Bereich der App. Du siehst deinen persönlichen Stundenplan, deine eigenen Kurse und das Repertoire — genauso wie ein normaler Schüler.',
          aktion: { label: 'Zum Stundenplan', pfad: '/vorstand/stundenplan' },
        },
        {
          frage: 'Wie sehe ich meine Events und Veranstaltungen?',
          antwort: 'Unter „Events" siehst du alle Veranstaltungen der Musikschule — Konzerte, Prüfungen, Vorstandssitzungen und mehr. Du kannst deine Zusage (Ja / Nein / Offen) direkt verwalten.',
          aktion: { label: 'Zu Events', pfad: '/vorstand/events' },
        },
      ],
    },
    {
      kategorie: '📡 Live-Session',
      items: [
        {
          frage: 'Kann ich an einer Live-Session teilnehmen?',
          antwort: 'Ja. Wenn dein Lehrer eine Live-Session startet, erhältst du einen 6-stelligen Code. Gib ihn unter „Session beitreten" ein und siehst live, was dein Lehrer zeigt: Noten, Liedtext, Akkorde oder Videos.',
          aktion: { label: 'Session beitreten', event: 'staccato:open-join-session' },
        },
      ],
    },
    {
      kategorie: '⚙️ App & Profil',
      items: [
        {
          frage: 'Wie ändere ich meine Sprache oder das Design?',
          antwort: 'Klicke auf das ⚙️-Symbol in der Seitenleiste. Dort kannst du zwischen Deutsch, Englisch und Türkisch wechseln sowie das Farbthema und den Dunkel-/Hellmodus anpassen.',
          aktion: { label: 'Einstellungen öffnen', pfad: '/einstellungen' },
        },
        {
          frage: 'Wie ändere ich mein Passwort oder meine Daten?',
          antwort: 'Klicke in der Navigation auf „Profil". Dort kannst du deinen Namen, Telefonnummer, Adresse und dein Passwort aktualisieren.',
          aktion: { label: 'Zum Profil', pfad: '/profil' },
        },
      ],
    },
  ],

  en: [
    {
      kategorie: '📊 Dashboard & Overview',
      items: [
        {
          frage: 'What does the board dashboard show?',
          antwort: 'The dashboard shows at a glance: open tasks, number of goals, protocols, and the next meeting date. Below you see student tiles with their current courses and lessons. Click a KPI card to jump directly to the relevant page.',
          aktion: { label: 'Go to Dashboard', pfad: '/vorstand' },
        },
        {
          frage: 'What are the KPI cards?',
          antwort: '✅ Open Tasks — tasks still to be done\n🎯 Goals — number of active annual goals\n📝 Protocols — number of saved meeting protocols\n\nClick a card to open the details.',
          aktion: { label: 'Go to Dashboard', pfad: '/vorstand' },
        },
      ],
    },
    {
      kategorie: '🎯 Goals & Tasks',
      items: [
        {
          frage: 'How do I create a new goal?',
          antwort: 'Go to "Goals" and click "+ Add goal". You can set title, description, period (annual or quarterly) and status. Tasks can be added directly below the goal.',
          aktion: { label: 'Go to Goals', pfad: '/vorstand/ziele' },
        },
        {
          frage: 'What are tasks and how does status work?',
          antwort: 'Each goal can have multiple tasks. Status cycles through three stages:\n\n🔵 Open → 🟡 In Progress → ✅ Done\n\nClick the status badge of a task to advance it. The responsible person can be chosen from all board members.',
          aktion: { label: 'Go to Goals', pfad: '/vorstand/ziele' },
        },
        {
          frage: 'Can I collapse or archive goals?',
          antwort: 'Goals can be collapsed (click the goal header). Completed goals remain visible in the list so you can track overall progress.',
          aktion: { label: 'Go to Goals', pfad: '/vorstand/ziele' },
        },
      ],
    },
    {
      kategorie: '📝 Protocols',
      items: [
        {
          frage: 'How do I create a meeting protocol?',
          antwort: 'Go to "Protocols" and click "+ Protocol". Fill in date, attendees (selectable from all board members), content and decisions. Optionally link the protocol to an event.',
          aktion: { label: 'Go to Protocols', pfad: '/vorstand/protokolle' },
        },
        {
          frage: 'Can I attach files to a protocol?',
          antwort: 'Yes. In the protocol detail you can upload any number of files (e.g. agenda, annexes). Files are stored securely and are only visible to board members.',
          aktion: { label: 'Go to Protocols', pfad: '/vorstand/protokolle' },
        },
        {
          frage: 'How do I link a protocol to a board meeting?',
          antwort: 'When creating or editing a protocol there is a "Linked event" dropdown. It shows all events of type "Board meeting" for your music school.',
          aktion: { label: 'Go to Protocols', pfad: '/vorstand/protokolle' },
        },
      ],
    },
    {
      kategorie: '📦 Inventory',
      items: [
        {
          frage: 'How do I add a new inventory item?',
          antwort: 'Go to "Inventory" and click "+ Add". Choose category, name, condition (New / Good / Used / Defective) and optionally purchase value and date. The inventory number is assigned automatically.',
          aktion: { label: 'Go to Inventory', pfad: '/vorstand/inventar' },
        },
        {
          frage: 'What do the condition symbols mean?',
          antwort: '🟢 New — just acquired\n🔵 Good — in perfect condition\n🟡 Used — visible wear\n🔴 Defective — out of service\n\nThe total inventory value is shown on the dashboard.',
          aktion: { label: 'Go to Inventory', pfad: '/vorstand/inventar' },
        },
      ],
    },
    {
      kategorie: '📅 Student Area',
      items: [
        {
          frage: 'Why do I see courses and a schedule?',
          antwort: 'As a board member you also have access to the student area of the app. You see your personal schedule, your own courses and repertoire — just like a regular student.',
          aktion: { label: 'Go to Schedule', pfad: '/vorstand/stundenplan' },
        },
        {
          frage: 'How do I see events?',
          antwort: 'Under "Events" you see all events of the music school — concerts, exams, board meetings and more. You can manage your RSVP (Yes / No / Open) directly.',
          aktion: { label: 'Go to Events', pfad: '/vorstand/events' },
        },
      ],
    },
    {
      kategorie: '📡 Live Session',
      items: [
        {
          frage: 'Can I join a live session?',
          antwort: 'Yes. When your teacher starts a live session, you receive a 6-character code. Enter it under "Join session" and see live what your teacher is showing: sheet music, lyrics, chords or videos.',
          aktion: { label: 'Join session', event: 'staccato:open-join-session' },
        },
      ],
    },
    {
      kategorie: '⚙️ App & Profile',
      items: [
        {
          frage: 'How do I change my language or theme?',
          antwort: 'Click the ⚙️ icon in the sidebar. There you can switch between German, English and Turkish and adjust the colour theme and dark/light mode.',
          aktion: { label: 'Open Settings', pfad: '/einstellungen' },
        },
        {
          frage: 'How do I change my password or details?',
          antwort: 'Click "Profile" in the navigation. There you can update your name, phone number, address and password.',
          aktion: { label: 'Go to Profile', pfad: '/profil' },
        },
      ],
    },
  ],

  tr: [
    {
      kategorie: '📊 Kontrol Paneli ve Genel Bakış',
      items: [
        {
          frage: 'Yönetim kurulu paneli ne gösterir?',
          antwort: 'Panel, bir bakışta şunları gösterir: açık görevler, hedef sayısı, tutanaklar ve bir sonraki toplantı tarihi. Altında, mevcut kursları ve dersleriyle öğrenci kartları yer alır. İlgili sayfaya gitmek için bir KPI kartına tıklayın.',
          aktion: { label: 'Panele Git', pfad: '/vorstand' },
        },
        {
          frage: 'KPI kartları nedir?',
          antwort: '✅ Açık Görevler — tamamlanması gereken görevler\n🎯 Hedefler — aktif yıllık hedef sayısı\n📝 Tutanaklar — kaydedilen toplantı tutanağı sayısı\n\nAyrıntıları açmak için bir karta tıklayın.',
          aktion: { label: 'Panele Git', pfad: '/vorstand' },
        },
      ],
    },
    {
      kategorie: '🎯 Hedefler ve Görevler',
      items: [
        {
          frage: 'Yeni bir hedef nasıl oluştururum?',
          antwort: '"Hedefler"e gidin ve "+ Hedef ekle"ye tıklayın. Başlık, açıklama, dönem (yıllık veya çeyreklik) ve durumu belirleyebilirsiniz. Görevler doğrudan hedefin altına eklenebilir.',
          aktion: { label: 'Hedeflere Git', pfad: '/vorstand/ziele' },
        },
        {
          frage: 'Görevler nedir ve durum nasıl çalışır?',
          antwort: 'Her hedefin birden fazla görevi olabilir. Durum üç aşamadan geçer:\n\n🔵 Açık → 🟡 Devam Ediyor → ✅ Tamamlandı\n\nDurumu ilerletmek için görevin durum rozetine tıklayın. Sorumlu kişiyi tüm yönetim kurulu üyeleri arasından seçebilirsiniz.',
          aktion: { label: 'Hedeflere Git', pfad: '/vorstand/ziele' },
        },
        {
          frage: 'Hedefleri daraltabilir ya da arşivleyebilir miyim?',
          antwort: 'Hedefler daraltılabilir (hedef başlığına tıklayın). Tamamlanan hedefler, genel ilerlemeyi takip edebilmeniz için listede görünür kalır.',
          aktion: { label: 'Hedeflere Git', pfad: '/vorstand/ziele' },
        },
      ],
    },
    {
      kategorie: '📝 Tutanaklar',
      items: [
        {
          frage: 'Toplantı tutanağı nasıl oluştururum?',
          antwort: '"Tutanaklar"a gidin ve "+ Tutanak"a tıklayın. Tarih, katılımcılar (tüm yönetim kurulu üyeleri arasından seçilebilir), içerik ve kararları doldurun. İsteğe bağlı olarak tutanağı bir etkinlikle ilişkilendirebilirsiniz.',
          aktion: { label: 'Tutanaklara Git', pfad: '/vorstand/protokolle' },
        },
        {
          frage: 'Tutanağa dosya ekleyebilir miyim?',
          antwort: 'Evet. Tutanak ayrıntısında istediğiniz kadar dosya yükleyebilirsiniz (örn. gündem, ekler). Dosyalar güvenli şekilde saklanır ve yalnızca yönetim kurulu üyeleri tarafından görülebilir.',
          aktion: { label: 'Tutanaklara Git', pfad: '/vorstand/protokolle' },
        },
        {
          frage: 'Tutanağı bir yönetim kurulu toplantısıyla nasıl ilişkilendiririm?',
          antwort: 'Tutanak oluştururken veya düzenlerken "İlişkili etkinlik" açılır menüsü görünür. Orada müzik okuluya ait "Yönetim Kurulu Toplantısı" türündeki tüm etkinlikler listelenir.',
          aktion: { label: 'Tutanaklara Git', pfad: '/vorstand/protokolle' },
        },
      ],
    },
    {
      kategorie: '📦 Envanter',
      items: [
        {
          frage: 'Yeni bir envanter kalemi nasıl eklerim?',
          antwort: '"Envanter"e gidin ve "+ Ekle"ye tıklayın. Kategori, ad, durum (Yeni / İyi / Kullanılmış / Arızalı) ve isteğe bağlı olarak satın alma değeri ile tarihi seçin. Envanter numarası otomatik olarak atanır.',
          aktion: { label: 'Envantere Git', pfad: '/vorstand/inventar' },
        },
        {
          frage: 'Durum sembolleri ne anlama geliyor?',
          antwort: '🟢 Yeni — yeni alınan\n🔵 İyi — mükemmel durumda\n🟡 Kullanılmış — görünür yıpranma\n🔴 Arızalı — hizmet dışı\n\nToplam envanter değeri panelde gösterilir.',
          aktion: { label: 'Envantere Git', pfad: '/vorstand/inventar' },
        },
      ],
    },
    {
      kategorie: '📅 Öğrenci Alanı',
      items: [
        {
          frage: 'Neden kurslar ve ders programı görüyorum?',
          antwort: 'Yönetim kurulu üyesi olarak uygulamanın öğrenci alanına da erişiminiz vardır. Kişisel ders programınızı, kurslarınızı ve repertuarınızı normal bir öğrenci gibi görürsünüz.',
          aktion: { label: 'Ders Programına Git', pfad: '/vorstand/stundenplan' },
        },
        {
          frage: 'Etkinlikleri nasıl görebilirim?',
          antwort: '"Etkinlikler" altında müzik okulunun tüm etkinliklerini görürsünüz — konserler, sınavlar, yönetim kurulu toplantıları ve daha fazlası. Katılım durumunuzu (Evet / Hayır / Açık) doğrudan yönetebilirsiniz.',
          aktion: { label: 'Etkinliklere Git', pfad: '/vorstand/events' },
        },
      ],
    },
    {
      kategorie: '📡 Canlı Oturum',
      items: [
        {
          frage: 'Canlı bir oturuma katılabilir miyim?',
          antwort: 'Evet. Öğretmeniniz bir canlı oturum başlattığında 6 haneli bir kod alırsınız. "Oturuma katıl" bölümüne girin ve öğretmeninizin gösterdiklerini canlı izleyin: notalar, güfteler, akorlar veya videolar.',
          aktion: { label: 'Oturuma Katıl', event: 'staccato:open-join-session' },
        },
      ],
    },
    {
      kategorie: '⚙️ Uygulama ve Profil',
      items: [
        {
          frage: 'Dilimi veya temayı nasıl değiştirebilirim?',
          antwort: 'Kenar çubuğundaki ⚙️ simgesine tıklayın. Almanca, İngilizce ve Türkçe arasında geçiş yapabilir, renk temasını ve karanlık/aydınlık modu ayarlayabilirsiniz.',
          aktion: { label: 'Ayarları Aç', pfad: '/einstellungen' },
        },
        {
          frage: 'Şifremi veya bilgilerimi nasıl değiştirebilirim?',
          antwort: 'Navigasyonda "Profil"e tıklayın. Orada adınızı, telefon numaranızı, adresinizi ve şifrenizi güncelleyebilirsiniz.',
          aktion: { label: 'Profile Git', pfad: '/profil' },
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

export default function VorstandFAQ() {
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
