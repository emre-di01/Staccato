// Each entry: { version, date, features: [{ icon, de, en, tr }] }
// Newest first.

export const CURRENT_VERSION = '2.3.0'

export const CHANGELOG = [
  {
    version: '2.3.0',
    date: '2026-05-16',
    features: [
      {
        icon: '🎼',
        de: 'MusicXML-Notation – Partituren aus MuseScore & Co. direkt im Browser als interaktive Notenansicht (powered by Verovio)',
        en: 'MusicXML Notation – scores from MuseScore rendered directly in the browser as interactive sheet music (powered by Verovio)',
        tr: 'MusicXML Notasyonu – MuseScore partisyonları, tarayıcıda interaktif nota görünümü olarak (Verovio destekli)',
      },
      {
        icon: '🔍',
        de: 'MusicBrainz-Integration – Komponist, Tonart und Metadaten beim Bearbeiten eines Stücks automatisch befüllen',
        en: 'MusicBrainz integration – automatically fill in composer, key and metadata when editing a piece',
        tr: 'MusicBrainz entegrasyonu – eser düzenlerken besteci, tonalite ve meta verileri otomatik doldur',
      },
      {
        icon: '✨',
        de: 'Überarbeiteter Stück-Header – Titel in einer Zeile, harmonisches Layout mit klarer Aktionsleiste',
        en: 'Redesigned piece header – title on one line, harmonious layout with clear action bar',
        tr: 'Yeniden tasarlanan eser başlığı – tek satırda başlık, net eylem çubuğuyla uyumlu düzen',
      },
    ],
  },
  {
    version: '2.2.0',
    date: '2026-05-16',
    features: [
      {
        icon: '💶',
        de: 'Rechnungen – GoBD-konforme Rechnungen nach §14 UStG mit automatischer Nummerierung, Stornierung und PDF-Druck',
        en: 'Invoicing – GoBD-compliant invoices (§14 UStG) with automatic numbering, cancellation and PDF print',
        tr: 'Faturalama – GoBD uyumlu, §14 UStG kapsamında otomatik numaralı faturalar, iptal ve PDF yazdırma',
      },
      {
        icon: '📋',
        de: 'Interessenten-Pipeline – CRM-Timeline mit neuen Status (Kontaktiert, Angebot, Verloren) und Aktivitätsverlauf',
        en: 'Prospects pipeline – CRM timeline with new statuses (Contacted, Offer, Lost) and activity history',
        tr: 'Aday boru hattı – yeni durumlar (İletişime geçildi, Teklif, Kaybedildi) ve aktivite geçmişiyle CRM zaman çizelgesi',
      },
      {
        icon: '🔧',
        de: 'Tools für alle – Stimmgerät, Akkord-Transposer und Kapo-Rechner jetzt für alle Nutzerrollen in der Sidebar',
        en: 'Tools for everyone – tuner, chord transposer and capo calculator now available to all roles in the sidebar',
        tr: 'Herkes için araçlar – akort cihazı, akor transposer ve kapo hesaplayıcı artık tüm roller için kenar çubuğunda',
      },
      {
        icon: '🎼',
        de: 'Stücke: Takt und Anmerkungen – neue Felder für Taktart und freie Notizen pro Stück',
        en: 'Pieces: time signature and notes – new fields for time signature and free notes per piece',
        tr: 'Parçalar: ölçü ve notlar – her parça için ölçü ve serbest notlar için yeni alanlar',
      },
      {
        icon: '🧹',
        de: 'Navigation aufgeräumt – schlankere Sidebar, weniger Einträge pro Gruppe',
        en: 'Navigation cleaned up – slimmer sidebar, fewer entries per group',
        tr: 'Gezinti temizlendi – daha sade kenar çubuğu, grup başına daha az giriş',
      },
    ],
  },
  {
    version: '2.1.0',
    date: '2026-05-11',
    features: [
      {
        icon: '📺',
        de: 'Beamer-Modus – Projektor oder TV mit dem Unterrichtsmodus koppeln und Inhalte direkt anzeigen',
        en: 'Beamer mode – connect a projector or TV to teaching mode and display content directly',
        tr: 'Beamer modu – projektör veya TV\'yi ders moduna bağla ve içerikleri doğrudan görüntüle',
      },
      {
        icon: '🎵',
        de: 'Metronom mit BPM-Tap – direkt im Stück, inkl. Tempo-Label (Largo … Presto) und Speichern',
        en: 'Metronome with BPM tap – directly in the piece, with tempo label (Largo … Presto) and save',
        tr: 'BPM-Tap\'lı metronom – parçada doğrudan, tempo etiketi (Largo … Presto) ve kaydetme',
      },
      {
        icon: '🖨️',
        de: 'Konzertprogramm-Druck – druckbares Programm mit Schullogo direkt aus dem Event-Repertoire',
        en: 'Concert programme print – printable programme with school logo directly from event repertoire',
        tr: 'Konser programı baskısı – etkinlik repertuarından okul logolu yazdırılabilir program',
      },
      {
        icon: '♿',
        de: 'Barrierefreiheit & Große-Schrift-Modus – größere Touchflächen, ARIA-Labels, Zoom-Einstellung',
        en: 'Accessibility & large-text mode – larger touch targets, ARIA labels, zoom setting',
        tr: 'Erişilebilirlik ve büyük yazı modu – daha geniş dokunma alanları, ARIA etiketleri, zoom',
      },
      {
        icon: '🌐',
        de: 'Mehrsprachiger Stundenplan – Datum und Uhrzeit in der gewählten App-Sprache (DE/EN/TR)',
        en: 'Multilingual schedule – dates and times in the selected app language (DE/EN/TR)',
        tr: 'Çok dilli program – tarih ve saatler seçilen uygulama dilinde (DE/EN/TR)',
      },
    ],
  },
  {
    version: '2.0.0',
    date: '2026-05-09',
    features: [
      {
        icon: '🏫',
        de: 'Multi-Tenancy – mehrere Musikschulen auf einer Plattform, sauber voneinander getrennt',
        en: 'Multi-tenancy – multiple music schools on one platform, cleanly separated',
        tr: 'Çok kiracılı yapı – tek platformda birden fazla müzik okulu, tamamen ayrı',
      },
      {
        icon: '📧',
        de: 'Einladungssystem – Mitglieder per E-Mail einladen oder direkt hinzufügen',
        en: 'Invitation system – invite members via email or add them directly',
        tr: 'Davet sistemi – üyeleri e-posta ile davet et veya doğrudan ekle',
      },
      {
        icon: '🔄',
        de: 'Schul-Wechsler – nahtlos zwischen Schulen wechseln (für Mitglieder in mehreren Schulen)',
        en: 'School switcher – seamlessly switch between schools (for members in multiple schools)',
        tr: 'Okul değiştirici – okullar arasında sorunsuz geçiş (birden fazla okuldaki üyeler için)',
      },
      {
        icon: '🛡️',
        de: 'Superadmin-Dashboard – alle Schulen verwalten, neue Schulen anlegen, Kontext wechseln',
        en: 'Superadmin dashboard – manage all schools, create new schools, switch context',
        tr: 'Süper yönetici paneli – tüm okulları yönet, yeni okul oluştur, bağlam değiştir',
      },
    ],
  },
  {
    version: '1.9.0',
    date: '2026-05-08',
    features: [
      {
        icon: '👋',
        de: 'Willkommens-Tour für neue Schüler – 6-schrittiger Onboarding-Guide beim ersten Login',
        en: 'Welcome tour for new students – 6-step onboarding guide on first login',
        tr: 'Yeni öğrenciler için karşılama turu – ilk girişte 6 adımlı rehber',
      },
      {
        icon: '🗺️',
        de: 'Tour jederzeit neu starten – Button im Profil unter „Tour erneut starten"',
        en: 'Restart tour anytime – button in profile under "Restart tour"',
        tr: 'Turu istediğin zaman yeniden başlat – profilde "Turu yeniden başlat" butonu',
      },
      {
        icon: '🌍',
        de: 'Kursverwaltung vollständig übersetzt – alle Labels, Buttons und Meldungen in DE/EN/TR',
        en: 'Course management fully translated – all labels, buttons and messages in DE/EN/TR',
        tr: 'Ders yönetimi tam çeviri – tüm etiketler, butonlar ve mesajlar DE/EN/TR dilinde',
      },
      {
        icon: '📅',
        de: 'Stundenplan vollständig übersetzt – alle Texte und Aktionen in DE/EN/TR verfügbar',
        en: 'Schedule fully translated – all texts and actions available in DE/EN/TR',
        tr: 'Ders programı tam çeviri – tüm metinler ve işlemler DE/EN/TR dilinde mevcut',
      },
    ],
  },
  {
    version: '1.8.4',
    date: '2026-05-08',
    features: [
      {
        icon: '📥',
        de: 'Anwesenheitsübersicht als CSV exportieren – direkt aus dem Kurs-Detail',
        en: 'Export attendance overview as CSV – directly from course detail',
        tr: 'Devamsızlık özetini CSV olarak dışa aktar – kurs detayından doğrudan',
      },
      {
        icon: '🗑️',
        de: 'Nachrichten löschen – Nachrichten können jetzt einzeln entfernt werden',
        en: 'Delete messages – messages can now be removed individually',
        tr: 'Mesajları sil – mesajlar artık tek tek kaldırılabilir',
      },
      {
        icon: '📵',
        de: 'Offline-Banner – Hinweis wenn keine Internetverbindung besteht',
        en: 'Offline banner – notification when there is no internet connection',
        tr: 'Çevrimdışı banner – internet bağlantısı olmadığında bildirim',
      },
      {
        icon: '🙋',
        de: 'Schüler können sich für bevorstehende Stunden selbst entschuldigen',
        en: 'Students can excuse themselves for upcoming lessons',
        tr: 'Öğrenciler gelecek dersler için kendilerini mazur gösterebilir',
      },
      {
        icon: '⚙️',
        de: 'Theme & Sprache werden im Profil gespeichert – Einstellungen auf allen Geräten synchron',
        en: 'Theme & language saved to profile – settings synced across all devices',
        tr: 'Tema ve dil profile kaydedildi – ayarlar tüm cihazlarda senkronize',
      },
    ],
  },
  {
    version: '1.8.3',
    date: '2026-05-08',
    features: [
      {
        icon: '📲',
        de: 'PWA-Installationshinweis – App direkt zum Homescreen hinzufügen (Android & iOS)',
        en: 'PWA install prompt – add app directly to home screen (Android & iOS)',
        tr: 'PWA kurulum bildirimi – uygulamayı doğrudan ana ekrana ekle (Android & iOS)',
      },
      {
        icon: '🎨',
        de: 'Dynamische Statusbar-Farbe – passt sich automatisch dem gewählten Theme an',
        en: 'Dynamic status bar color – automatically adapts to the selected theme',
        tr: 'Dinamik durum çubuğu rengi – seçilen temaya otomatik uyum sağlar',
      },
      {
        icon: '⚙️',
        de: 'Einstellungen als natives Bottom Sheet auf Mobilgeräten, Tab-Bar mit Aktiv-Indikator',
        en: 'Settings as native bottom sheet on mobile, tab bar with active indicator',
        tr: 'Mobilde ayarlar için yerel alt sayfa, aktif göstergeli sekme çubuğu',
      },
    ],
  },
  {
    version: '1.8.2',
    date: '2026-05-08',
    features: [
      {
        icon: '🗺️',
        de: 'Veranstaltungsorte direkt in Google Maps öffnen – klickbarer Link in Karten & Stundenplan',
        en: 'Open event locations directly in Google Maps – clickable link in cards & schedule',
        tr: 'Etkinlik konumlarını doğrudan Google Maps\'te aç – kartlarda ve ders programında tıklanabilir bağlantı',
      },
      {
        icon: '📍',
        de: 'Strukturierte Adresseingabe (Straße, PLZ, Ort, Land) mit OpenStreetMap-Autocomplete',
        en: 'Structured address input (street, ZIP, city, country) with OpenStreetMap autocomplete',
        tr: 'Yapılandırılmış adres girişi (sokak, posta kodu, şehir, ülke) OpenStreetMap otomatik tamamlama ile',
      },
      {
        icon: '✨',
        de: 'UI-Aufwertung: Moderne StatCards mit Farbakzenten & Hover-Animationen, schlanke Scrollbar, Fokus-Ringe für Eingabefelder',
        en: 'UI upgrade: modern StatCards with color accents & hover animations, slim scrollbar, focus rings for inputs',
        tr: 'Arayüz güncellemesi: renk vurgulu & hover animasyonlu modern StatCard\'lar, ince kaydırma çubuğu, giriş alanları için odak halkaları',
      },
    ],
  },
  {
    version: '1.8.1',
    date: '2026-05-08',
    features: [
      {
        icon: '🌐',
        de: 'Unterrichtsmodus: Öffentliche Sessions – Gäste können ohne Staccato-Login per Code/QR beitreten',
        en: 'Teaching mode: public sessions – guests can join via code/QR without a Staccato login',
        tr: 'Öğretim modu: herkese açık oturumlar – misafirler Staccato girişi olmadan kod/QR ile katılabilir',
      },
      {
        icon: '⚡',
        de: 'Unterrichtsmodus: Laufende Session nach Seitenreload automatisch erkennen und fortsetzen',
        en: 'Teaching mode: automatically detect and resume an active session after page reload',
        tr: 'Öğretim modu: sayfa yenilendikten sonra aktif oturumu otomatik olarak algıla ve devam et',
      },
      {
        icon: '🔗',
        de: 'Nach dem Login landet man wieder auf der ursprünglich aufgerufenen Seite',
        en: 'After login, you are redirected back to the page you originally tried to open',
        tr: 'Giriş yaptıktan sonra açmaya çalıştığınız sayfaya geri yönlendirilirsiniz',
      },
    ],
  },
  {
    version: '1.7.1',
    date: '2026-05-06',
    features: [
      {
        icon: '📷',
        de: 'Inventar: Barcode / EAN beim Anlegen direkt per Kamera scannen',
        en: 'Inventory: scan barcode / EAN directly via camera when creating items',
        tr: 'Envanter: eşya oluştururken barkod / EAN\'ı kamera ile doğrudan tara',
      },
      {
        icon: '📦',
        de: 'Dashboard (Admin & Vorstand): neue Kachel zeigt den Gesamtwert des Inventars',
        en: 'Dashboard (admin & board): new tile shows the total value of the inventory',
        tr: 'Dashboard (yönetici & yönetim kurulu): yeni kart envanter toplam değerini gösteriyor',
      },
    ],
  },
  {
    version: '1.7.0',
    date: '2026-05-05',
    features: [
      {
        icon: '📦',
        de: 'Inventar-Verwaltung: Gegenstände erfassen, kategorisieren, Zustand verfolgen und per QR-Code scannen',
        en: 'Inventory management: record items, categorise, track condition and scan via QR code',
        tr: 'Envanter yönetimi: eşyaları kaydet, kategorilere ayır, durumu takip et ve QR kodu ile tara',
      },
      {
        icon: '🔒',
        de: 'Bugfix: Datei-Upload im Repertoire und anderen Bereichen funktioniert wieder zuverlässig',
        en: 'Bugfix: file upload in repertoire and other areas works reliably again',
        tr: 'Hata düzeltme: repertuarda ve diğer alanlarda dosya yükleme yeniden güvenilir şekilde çalışıyor',
      },
    ],
  },
  {
    version: '1.6.2',
    date: '2026-05-05',
    features: [
      {
        icon: '🖱️',
        de: 'Dashboard: Veranstaltungs- und Stundenkarten sind jetzt anklickbar und führen direkt zur jeweiligen Seite',
        en: 'Dashboard: event and lesson cards are now clickable and navigate directly to the relevant page',
        tr: 'Gösterge paneli: etkinlik ve ders kartları artık tıklanabilir ve doğrudan ilgili sayfaya yönlendirir',
      },
    ],
  },
  {
    version: '1.6.1',
    date: '2026-05-05',
    features: [
      {
        icon: '🔐',
        de: 'Session-Stabilität: Login bleibt nach Browser-Neustart zuverlässig erhalten',
        en: 'Session stability: login is reliably preserved after browser restart',
        tr: 'Oturum kararlılığı: tarayıcı yeniden başlatıldıktan sonra giriş güvenilir biçimde korunur',
      },
      {
        icon: '✅',
        de: 'RSVP für Admins und bei öffentlichen Veranstaltungen für alle',
        en: 'RSVP for admins and for all on public events',
        tr: 'Yöneticiler için ve herkese açık etkinliklerde tüm kullanıcılar için RSVP',
      },
      {
        icon: '⚡',
        de: 'Schnellerer App-Start durch Code-Splitting aller Seiten',
        en: 'Faster app start through code-splitting of all pages',
        tr: 'Tüm sayfaların kod bölünmesiyle daha hızlı uygulama başlangıcı',
      },
    ],
  },
  {
    version: '1.6.0',
    date: '2026-05-05',
    features: [
      {
        icon: '💬',
        de: 'Nachrichten-Modul: Broadcast, Kurs- und Direktnachrichten für alle Rollen',
        en: 'Messages module: broadcast, course and direct messages for all roles',
        tr: 'Mesaj modülü: tüm roller için yayın, kurs ve doğrudan mesajlar',
      },
      {
        icon: '📱',
        de: 'Nachrichten vollständig für Mobilgeräte optimiert',
        en: 'Messages fully optimised for mobile devices',
        tr: 'Mesajlar mobil cihazlar için tam olarak optimize edildi',
      },
    ],
  },
  {
    version: '1.5.1',
    date: '2026-05-04',
    features: [
      {
        icon: '📅',
        de: 'iCal-Kalenderabo: persönlichen Stundenplan und Events in Google, Apple & Outlook abonnieren',
        en: 'iCal calendar subscription: subscribe to your personal schedule and events in Google, Apple & Outlook',
        tr: 'iCal takvim aboneliği: kişisel ders programını ve etkinlikleri Google, Apple ve Outlook\'ta abone ol',
      },
    ],
  },
  {
    version: '1.5.0',
    date: '2026-05-03',
    features: [
      {
        icon: '⚡',
        de: 'Seiten laden schneller: Daten bleiben 3 Minuten gecacht — kein erneutes Laden beim Zurücknavigieren',
        en: 'Pages load faster: data is cached for 3 minutes — no reload when navigating back',
        tr: 'Sayfalar daha hızlı yüklenir: veriler 3 dakika önbelleğe alınır — geri giderken yeniden yükleme yok',
      },
      {
        icon: '🛡️',
        de: 'Fehlermeldung statt weißem Bildschirm wenn eine Seite abstürzt',
        en: 'Error message instead of white screen when a page crashes',
        tr: 'Bir sayfa çöktüğünde beyaz ekran yerine hata mesajı',
      },
      {
        icon: '📱',
        de: 'Layout reagiert jetzt korrekt auf Bildschirmdrehung ohne Neu-laden',
        en: 'Layout now responds correctly to screen rotation without reload',
        tr: 'Düzen artık yeniden yükleme olmadan ekran döndürmeye doğru tepki veriyor',
      },
    ],
  },
  {
    version: '1.4.2',
    date: '2026-05-03',
    features: [
      {
        icon: '🔀',
        de: 'Liedtext: Freie Wahl zwischen Markdown-Formatierung und reinem Text (MD / Plain)',
        en: 'Lyrics: freely switch between Markdown formatting and plain text (MD / Plain)',
        tr: 'Şarkı sözleri: Markdown biçimlendirme ve düz metin arasında özgürce geçiş (MD / Plain)',
      },
    ],
  },
  {
    version: '1.4.1',
    date: '2026-05-03',
    features: [
      {
        icon: '⚙️',
        de: 'Schuleinstellungen: Name, Logo, Website, E-Mail, Telefon und Adresse direkt im Admin-Dashboard bearbeitbar',
        en: 'School settings: name, logo, website, email, phone and address now editable in the admin dashboard',
        tr: 'Okul ayarları: isim, logo, web sitesi, e-posta, telefon ve adres artık admin panelinde düzenlenebilir',
      },
      {
        icon: '✍️',
        de: 'Liedtext unterstützt jetzt Markdown: Abschnittstitel, Fettdruck, Trennlinien u.v.m.',
        en: 'Lyrics now support Markdown: section headings, bold text, dividers and more',
        tr: 'Şarkı sözleri artık Markdown destekler: bölüm başlıkları, kalın metin, ayırıcılar ve daha fazlası',
      },
      {
        icon: '👁',
        de: 'Liedtext-Editor mit Vorschau-Button und Markdown-Cheatsheet',
        en: 'Lyrics editor now has a preview button and a Markdown cheatsheet',
        tr: 'Şarkı sözleri editöründe önizleme butonu ve Markdown kılavuzu',
      },
      {
        icon: '🖼️',
        de: 'PDF-Export: Schullogo wird automatisch eingebettet (Logo in Schuleinstellungen hinterlegbar)',
        en: 'PDF export: school logo is automatically embedded (configurable in school settings)',
        tr: 'PDF dışa aktarma: okul logosu otomatik olarak eklenir (okul ayarlarında yapılandırılabilir)',
      },
    ],
  },
  {
    version: '1.4.0',
    date: '2026-05-03',
    features: [
      {
        icon: '✏️',
        de: 'Stück-Metadaten (Titel, Komponist, Tonart, Tempo) nachträglich bearbeitbar',
        en: 'Piece metadata (title, composer, key, tempo) can now be edited',
        tr: 'Parça meta verileri (başlık, besteci, ton, tempo) artık düzenlenebilir',
      },
      {
        icon: '🔢',
        de: 'Veranstaltungs-Repertoire: Reihenfolge der Stücke per ▲/▼ sortierbar',
        en: 'Event repertoire: piece order can be rearranged with ▲/▼ buttons',
        tr: 'Etkinlik repertuarı: parça sırası ▲/▼ butonlarıyla düzenlenebilir',
      },
      {
        icon: '🎸',
        de: 'Neues Admin-Modul: Instrumente verwalten (Emoji, Mehrsprachig, Aktiv-Status)',
        en: 'New admin module: manage instruments (emoji, multilingual, active status)',
        tr: 'Yeni admin modülü: enstrümanları yönetin (emoji, çok dilli, aktif durum)',
      },
      {
        icon: '🎵',
        de: 'Kursanlage: Instrument-Auswahl zeigt jetzt nur Instrumente der eigenen Schule',
        en: "Course creation: instrument selector now shows only your school's instruments",
        tr: 'Ders oluşturma: enstrüman seçici artık yalnızca kendi okulunuzun enstrümanlarını gösterir',
      },
    ],
  },
  {
    version: '1.3.0',
    date: '2026-05-03',
    features: [
      {
        icon: '📱',
        de: 'Datenladen nach Bildschirm-aus / Browser-Hintergrund zuverlässig behoben',
        en: 'Data loading after screen-off / browser background reliably fixed',
        tr: 'Ekran kapatma / tarayıcı arka planından sonra veri yükleme güvenilir şekilde düzeltildi',
      },
      {
        icon: '🔒',
        de: 'Live-Unterrichtssession bleibt beim Bildschirm-Einschalten aktiv',
        en: 'Live teaching session stays active when screen is turned back on',
        tr: 'Ekran açıldığında canlı ders oturumu aktif kalır',
      },
    ],
  },
  {
    version: '1.2.0',
    date: '2026-05-03',
    features: [
      {
        icon: '📱',
        de: 'App-Refresh bei Rückkehr aus dem Hintergrund (mobile State)',
        en: 'App refresh when returning from background (mobile state)',
        tr: 'Arka plandan dönerken uygulama yenileme (mobil durum)',
      },
    ],
  },
  {
    version: '1.1.2',
    date: '2026-05-03',
    features: [
      {
        icon: '🎨',
        de: 'Login-Screen überarbeitet: animierte Noten, Farbverlauf, Mobile-Header',
        en: 'Login screen redesigned: animated notes, gradient, mobile header',
        tr: 'Giriş ekranı yenilendi: animasyonlu notalar, renk geçişi, mobil başlık',
      },
      {
        icon: '✨',
        de: '"Was ist neu?"-Anzeige beim Login und nach dem ersten Einloggen',
        en: '"What\'s new?" display on login and after first sign-in',
        tr: 'Giriş ekranında ve ilk girişten sonra "Yenilikler" gösterimi',
      },
      {
        icon: '🔍',
        de: 'Stunden: Jahr- und Monatsfilter, Status-Filter, kein Limit mehr',
        en: 'Lessons: year & month filter, status filter, no more 20-item limit',
        tr: 'Dersler: yıl & ay filtresi, durum filtresi, 20 öğe sınırı kaldırıldı',
      },
      {
        icon: '👥',
        de: 'Schülerliste: Filter nach Kurstyp (Einzel, Gruppe, Chor, Ensemble)',
        en: 'Student list: filter by course type (individual, group, choir, ensemble)',
        tr: 'Öğrenci listesi: ders türüne göre filtre (bireysel, grup, koro, topluluk)',
      },
      {
        icon: '📱',
        de: 'Mobile Stunden-Karte: Buttons in eigener Zeile, kein Überlauf mehr',
        en: 'Mobile lesson card: buttons in own row, no more overflow',
        tr: 'Mobil ders kartı: butonlar ayrı satırda, taşma sorunu giderildi',
      },
    ],
  },
  {
    version: '1.1.0',
    date: '2026-05-01',
    features: [
      {
        icon: '📱',
        de: 'PWA-Support: App kann jetzt auf dem Homescreen installiert werden',
        en: 'PWA support: the app can now be installed on your home screen',
        tr: 'PWA desteği: Uygulama artık ana ekrana kurulabilir',
      },
      {
        icon: '🎛️',
        de: 'Versionsnummer im mobilen Menü sichtbar',
        en: 'Version number shown in the mobile sidebar menu',
        tr: 'Mobil menüde sürüm numarası gösteriliyor',
      },
      {
        icon: '🐛',
        de: 'Diverse Bugfixes: State-Management, Navigation, Mobile-Optimierung',
        en: 'Various bug fixes: state management, navigation, mobile optimisation',
        tr: 'Çeşitli hata düzeltmeleri: durum yönetimi, navigasyon, mobil iyileştirmeler',
      },
      {
        icon: '📧',
        de: 'E-Mail-Versand (Passwort-Reset) zuverlässig repariert',
        en: 'E-mail delivery (password reset) reliably fixed',
        tr: 'E-posta gönderimi (şifre sıfırlama) güvenilir şekilde düzeltildi',
      },
    ],
  },
  {
    version: '1.0.0',
    date: '2026-04-01',
    features: [
      {
        icon: '🎉',
        de: 'Erster offizieller Release von Staccato',
        en: 'First official release of Staccato',
        tr: "Staccato'nun ilk resmi sürümü",
      },
      {
        icon: '🏫',
        de: 'Vollständiges Musikschul-Management: Kurse, Stunden, Anwesenheit',
        en: 'Complete music school management: courses, lessons, attendance',
        tr: 'Tam müzik okulu yönetimi: dersler, saatler, devam durumu',
      },
      {
        icon: '🎼',
        de: 'Repertoire-Verwaltung mit ChordPro, Noten-PDFs und Audio',
        en: 'Repertoire management with ChordPro, sheet music PDFs and audio',
        tr: "ChordPro, nota PDF'leri ve ses ile repertuar yönetimi",
      },
      {
        icon: '🎭',
        de: 'Events, RSVP und Live-Unterrichtsmodus',
        en: 'Events, RSVP and live teaching session mode',
        tr: 'Etkinlikler, RSVP ve canlı ders modu',
      },
    ],
  },
]
