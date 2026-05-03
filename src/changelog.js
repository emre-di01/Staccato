// Each entry: { version, date, features: [{ icon, de, en, tr }] }
// Newest first.

export const CURRENT_VERSION = '1.1.1'

export const CHANGELOG = [
  {
    version: '1.1.1',
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
