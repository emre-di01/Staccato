// Each entry: { version, date, features: [{ icon, de, en, tr }] }
// Newest first.

export const CURRENT_VERSION = '1.4.2'

export const CHANGELOG = [
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
