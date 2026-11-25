import RechtsRahmen, { sek, h2, p, ul, link } from '../neu/seiten/RechtsRahmen'

export default function Datenschutz() {
  return (
    <RechtsRahmen titel="Datenschutzerklärung" unter="Stand: November 2026">
      <section style={sek}>
        <h2 style={h2}>1. Verantwortlicher</h2>
        <p style={p}>
          Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:<br /><br />
          <strong>Emre Dingil</strong><br />
          Karlstr. 101<br />
          64285 Darmstadt<br />
          E-Mail: <a href="mailto:staccato@401dev.de" style={link}>staccato@401dev.de</a>
        </p>
      </section>

      <section style={sek}>
        <h2 style={h2}>2. Art der Plattform</h2>
        <p style={p}>Staccato ist eine Musikschul-Verwaltungssoftware, die als privates Hobby-Projekt entwickelt und betrieben wird. Die Plattform wird einzelnen Musikschulen zur Verwaltung ihrer Schüler, Kurse und Lehrpläne bereitgestellt. Die jeweilige Musikschule ist datenschutzrechtlich eigenverantwortlicher Verantwortlicher für die von ihr eingegebenen Daten ihrer Mitglieder.</p>
        <p style={{ ...p, marginTop: 10 }}>Staccato ist verfügbar als Web-App (<strong>app.staccato-music.de</strong>) sowie als Android-App (Veröffentlichung im Google Play Store in Vorbereitung). Beide Varianten greifen auf dieselbe Server-Infrastruktur zu und unterliegen denselben Datenschutzbestimmungen.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>3. Welche Daten verarbeitet werden</h2>
        <p style={p}>Im Rahmen des Betriebs der Plattform werden folgende personenbezogene Daten verarbeitet:</p>
        <ul style={ul}>
          <li><strong>Stammdaten:</strong> Name, E-Mail-Adresse, Telefonnummer, Geburtsdatum, Adresse</li>
          <li><strong>Zahlungsdaten:</strong> Kontoinhaber, IBAN, BIC, Zahlungsweise (SEPA-Lastschrift, Überweisung, bar), Zahlungsrhythmus und Höhe des Mitgliedsbeitrags, Rechnungen</li>
          <li><strong>Daten von Erziehungsberechtigten</strong> (bei Minderjährigen): Name, Telefonnummer, E-Mail-Adresse</li>
          <li><strong>Nutzungsdaten:</strong> Anwesenheiten, Kurszuordnungen, Repertoire-Fortschritt, Unterrichtsprotokolle</li>
          <li><strong>Technische Daten:</strong> Login-Zeitpunkte, Sitzungsinformationen (Session-Token), Push-Notification-Token (gerätegebundener Bezeichner für Benachrichtigungen via Web Push oder Firebase Cloud Messaging, nur bei aktivierten Push-Benachrichtigungen)</li>
          <li><strong>Einstellungen:</strong> Sprachpräferenz, Design (lokal im Gerätespeicher, kein Server-Zugriff)</li>
          <li><strong>Dateien:</strong> Hochgeladene Dokumente (z. B. Aufnahmeformulare, Noten, Audiodateien)</li>
          <li><strong>Nachrichten und Veranstaltungen:</strong> Nachrichten innerhalb der Musikschule, Zu- und Absagen</li>
          <li><strong>Tickets:</strong> Name, E-Mail-Adresse (bei Gästen im Ticketshop), bestellte Tickets, Zahlungs- und Erstattungsbeträge, Zeitpunkt des Einlasses. Kartendaten werden nicht in Staccato gespeichert. Zum Schutz vor Missbrauch wird die IP-Adresse beim Kauf nur als Prüfsumme gespeichert und nach 24 Stunden mit dem nächsten Vorgang gelöscht.</li>
          <li><strong>Live-Unterricht:</strong> Teilnahme, Reaktionen; bei Gästen ohne Konto der selbst angegebene Name</li>
          <li><strong>Server-Protokolle:</strong> IP-Adresse, Zeitpunkt, aufgerufene Adresse und Browserkennung, zur Sicherheit und Fehlersuche (Webserver: in der Regel 14 Tage)</li>
        </ul>
      </section>

      <section style={sek}>
        <h2 style={h2}>4. Zweck und Rechtsgrundlage</h2>
        <p style={p}>Die Verarbeitung der Daten erfolgt ausschließlich zum Zweck des Betriebs der Musikschul-Verwaltungsplattform:</p>
        <ul style={ul}>
          <li>Verwaltung von Schüler-, Lehrer- und Mitgliedsdaten (Art. 6 Abs. 1 lit. b DSGVO)</li>
          <li>Anwesenheitserfassung und Unterrichtsplanung (Art. 6 Abs. 1 lit. b DSGVO)</li>
          <li>Kommunikation zwischen Lehrern, Schülern und Eltern (Art. 6 Abs. 1 lit. b DSGVO)</li>
          <li>Bereitstellung von Unterrichtsmaterialien und Repertoire (Art. 6 Abs. 1 lit. b DSGVO)</li>
          <li>Ticketverkauf, Einlass und Erstattung (Art. 6 Abs. 1 lit. b DSGVO); Aufbewahrung von Zahlungsbelegen aufgrund gesetzlicher Pflichten (Art. 6 Abs. 1 lit. c DSGVO)</li>
          <li>Betrieb, Sicherheit und Missbrauchsschutz (Art. 6 Abs. 1 lit. f DSGVO)</li>
          <li>Vereinsverwaltung (Ziele, Protokolle, Inventar) für Vorstandsmitglieder (Art. 6 Abs. 1 lit. b DSGVO)</li>
          <li>Abrechnung der Unterrichts- bzw. Mitgliedsbeiträge, Rechnungsstellung und Einzug per SEPA-Lastschrift durch die jeweilige Musikschule (Art. 6 Abs. 1 lit. b DSGVO); Aufbewahrung von Rechnungen und Buchungsbelegen aufgrund gesetzlicher Pflichten (Art. 6 Abs. 1 lit. c DSGVO i.&nbsp;V.&nbsp;m. § 147 AO, § 257 HGB)</li>
        </ul>
        <p style={{ ...p, marginTop: 10 }}>Zahlungsdaten werden von der Musikschule oder von Ihnen selbst (z.&nbsp;B. beim Annehmen einer Einladung oder im Profil) eingetragen und ausschließlich von der jeweiligen Musikschule genutzt. Einsehen können sie nur die Verwaltung (Administratoren) dieser Musikschule und die betroffene Person selbst. Die Bankverbindung wird nicht an Dritte weitergegeben – mit Ausnahme der für den Lastschrifteinzug erforderlichen Übermittlung durch die Musikschule an ihre Bank. Online-Zahlungen für Tickets sind in Abschnitt 7 beschrieben.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>5. Hosting und Speicherung</h2>
        <p style={p}>
          Die Daten der Plattform werden auf einem gemieteten Server in Deutschland gespeichert (Anbieter: 1blu). Die Datenbankinfrastruktur basiert auf <strong>Supabase (selbst betrieben)</strong>. E-Mails der Plattform (z. B. Einladungen, Tickets) werden über den Mailserver von 1blu verschickt.<br /><br />
          Einige Funktionen rufen Dienste anderer Anbieter auf. Dabei werden Daten, mindestens die IP-Adresse, an diese übermittelt, teils auch außerhalb der EU. Welche das sind, steht in Abschnitt 7.<br /><br />
          Dateien (Noten, Audiodateien, Dokumente) liegen in einem geschützten Speicher und sind nur mit Berechtigung über zeitlich begrenzte, signierte Adressen abrufbar. Ausnahme: Profilbilder sind für alle abrufbar, die ihre genaue Adresse kennen.
        </p>
      </section>

      <section style={sek}>
        <h2 style={h2}>6. Lokale Speicherung / Cookies</h2>
        <p style={p}>Die Web-App (<strong>app.staccato-music.de</strong>) speichert ausschließlich technisch notwendige Daten lokal auf dem Gerät — es werden keine Tracking-Cookies gesetzt:</p>
        <ul style={ul}>
          <li><strong>Sitzungsdaten (Supabase Auth):</strong> Für sichere Anmeldung und Authentifizierung. Werden beim Abmelden gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO</li>
          <li><strong>Design-Einstellungen:</strong> Theme, Dark Mode und Sprache (kein Server-Zugriff). Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO</li>
          <li><strong>Versionsinformation:</strong> Gesehene Changelog-Version (kein Server-Zugriff). Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO</li>
          <li><strong>Zwischenspeicher der Web-App:</strong> Nur das Programm selbst (Seiten, Schriften, Symbole), damit die App schnell startet. Persönliche Inhalte und Dateien werden nicht dauerhaft zwischengespeichert; beim Abmelden werden geladene Inhalte verworfen und Push-Benachrichtigungen in diesem Browser beendet. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO</li>
          <li><strong>Push-Notification-Token:</strong> Gerätegebundener Token für den Empfang von Push-Benachrichtigungen (Web Push im Browser; Firebase Cloud Messaging in der Android-App). Wird auf dem Server gespeichert, solange Push-Benachrichtigungen aktiviert sind. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO</li>
        </ul>
        <p style={{ ...p, marginTop: 16 }}>Auf der <strong>Marketingwebsite (staccato-music.de)</strong> wird Google Analytics eingesetzt — ausschließlich nach Ihrer ausdrücklichen Einwilligung (Cookie-Banner). Google Analytics setzt Cookies (<code>_ga</code>, <code>_ga_*</code>) zur Analyse des Nutzungsverhaltens. IP-Adressen werden anonymisiert. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO. Sie können Ihre Einwilligung jederzeit widerrufen, indem Sie den Browser-Speicher (localStorage) löschen.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>7. Drittdienste</h2>
        <p style={p}><strong>Google Analytics 4</strong> (nur auf staccato-music.de, nach Einwilligung): Google Ireland Ltd., Gordon House, Barrow Street, Dublin 4, Irland. IP-Adressen werden anonymisiert. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO. Weitere Informationen: <a href="https://policies.google.com/privacy" style={link} target="_blank" rel="noreferrer">policies.google.com/privacy</a></p>
        <p style={{ ...p, marginTop: 12 }}><strong>Firebase Cloud Messaging (FCM)</strong> (nur Android-App, nur bei aktivierten Push-Benachrichtigungen): Google Ireland Ltd. FCM wird genutzt, um Push-Benachrichtigungen an Android-Geräte zu übermitteln. Dabei wird ein gerätegebundenes FCM-Token erzeugt und auf unserem Server gespeichert. Das Token enthält keine personenbezogenen Daten, ermöglicht jedoch die gezielte Zustellung von Benachrichtigungen an ein bestimmtes Gerät. Das Token wird gelöscht, sobald Push-Benachrichtigungen in den Einstellungen deaktiviert oder das Konto gelöscht wird. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Weitere Informationen: <a href="https://firebase.google.com/support/privacy" style={link} target="_blank" rel="noreferrer">firebase.google.com/support/privacy</a></p>
        <p style={{ ...p, marginTop: 12 }}><strong>Stripe und SumUp</strong> (nur beim Kauf im Ticketshop): Die Musikschule wählt den Zahlungsanbieter und nutzt dort ihr eigenes Konto. Zum Bezahlen werden Sie auf die Seite des Anbieters weitergeleitet. Wir übermitteln Betrag, Veranstaltung, Anzahl der Tickets und eine Bestellnummer, an Stripe zusätzlich Ihre E-Mail-Adresse. Zahlungsdaten (z. B. Kartennummer, Apple Pay, Google Pay) geben Sie nur dort ein; wir erhalten lediglich Status, Betrag und Vorgangsnummern. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Es gelten die Datenschutzhinweise des Anbieters: <a href="https://stripe.com/de/privacy" style={link} target="_blank" rel="noreferrer">stripe.com/de/privacy</a>, <a href="https://www.sumup.com/de-de/datenschutzbestimmungen/" style={link} target="_blank" rel="noreferrer">sumup.com/datenschutz</a></p>
        <p style={{ ...p, marginTop: 12 }}><strong>Web Push</strong> (nur Web-App, nur bei aktivierten Push-Benachrichtigungen): Die Zustellung läuft über den Push-Dienst Ihres Browsers (z. B. Google, Apple oder Mozilla). Dort liegt eine gerätebezogene Adresse; der Inhalt der Benachrichtigung wird verschlüsselt übertragen. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO; widerrufbar in den Einstellungen.</p>
        <p style={{ ...p, marginTop: 12 }}><strong>OpenStreetMap</strong> (nur Verwaltung im klassischen Design): Beim Eintragen eines Veranstaltungsortes wird der eingegebene Ort zusammen mit der IP-Adresse an den Suchdienst der OpenStreetMap Foundation (Vereinigtes Königreich) übermittelt und gegebenenfalls eine Karte geladen. Wohnadressen werden nicht übermittelt. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO. <a href="https://osmfoundation.org/wiki/Privacy_Policy" style={link} target="_blank" rel="noreferrer">osmfoundation.org</a></p>
        <p style={{ ...p, marginTop: 12 }}><strong>YouTube und Spotify</strong>: Videos und Player werden erst geladen, wenn Sie darauf tippen. Dann werden Ihre IP-Adresse und Gerätedaten an YouTube (Google) bzw. Spotify übermittelt, gegebenenfalls auch in die USA; es können Cookies gesetzt werden. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO. Auf dem Beamer der Musikschule lädt das Video, sobald die Lehrkraft es dort anzeigt.</p>
        <p style={{ ...p, marginTop: 12 }}><strong>Texterkennung und Transkription</strong> (nur wenn Lehrkräfte diese Werkzeuge öffnen): Fotos und Aufnahmen werden auf dem Gerät verarbeitet und nicht hochgeladen. Die dafür nötigen Programm- und Sprachdateien lädt der Browser von jsDelivr bzw. Hugging Face (USA); dabei wird die IP-Adresse übermittelt. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO.</p>
        <p style={{ ...p, marginTop: 12 }}><strong>Liedsuche</strong> (nur für Lehrkräfte und Verwaltung): Titel und Interpret werden an Musikdienste (u. a. Spotify, YouTube Music) übermittelt, um Liedangaben und Texte zu finden. Daten von Mitgliedern werden dabei nicht übermittelt. Bei der Suche in MusicBrainz ruft der Browser den Dienst direkt auf, dabei wird die IP-Adresse der suchenden Person übermittelt.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>8. Speicherdauer</h2>
        <p style={p}>Personenbezogene Daten werden gelöscht, sobald sie für den Zweck ihrer Erhebung nicht mehr benötigt werden — in der Regel nach Beendigung der Mitgliedschaft in der jeweiligen Musikschule. Steuerrelevante Unterlagen werden gemäß gesetzlicher Aufbewahrungsfristen aufbewahrt (i. d. R. 10 Jahre).</p>
        <p style={{ ...p, marginTop: 10 }}>Gelöschte Daten können noch in Sicherungskopien enthalten sein, bis diese gelöscht werden.</p>
        <p style={{ ...p, marginTop: 10 }}>Bankverbindungen (IBAN, BIC, Kontoinhaber) werden gelöscht, sobald sie für den Beitragseinzug nicht mehr benötigt werden, spätestens mit Löschung des Kontos. SEPA-Lastschriftmandate bewahrt die Musikschule bis mindestens 14 Monate nach der letzten Lastschrift auf (Erstattungsfristen nach § 676b BGB). Bereits ausgestellte Rechnungen bleiben aufgrund der gesetzlichen Aufbewahrungspflicht (10 Jahre) erhalten; sie enthalten keine Bankverbindung des Mitglieds.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>9. Selbstauskunft, Datenexport und Kontolöschung</h2>
        <p style={p}>
          Sie können jederzeit eine Kopie aller über Sie gespeicherten personenbezogenen Daten herunterladen
          sowie Ihr Konto und alle zugehörigen Daten sofort und unwiderruflich selbst löschen (Art. 15, 17, 20 DSGVO).
          Der Export enthält u.&nbsp;a. Stammdaten, Zahlungsdaten, Daten von Erziehungsberechtigten, Kurse, Anwesenheiten, Dokumente, Rechnungen und Nachrichten.
          Die Löschung umfasst Stammdaten, Zahlungsdaten, Nutzungsdaten, hochgeladene Dateien und Push-Notification-Tokens.
        </p>
        <p style={{ ...p, marginTop: 10 }}>
          <strong>Daten exportieren:</strong> Profil → „Meine Daten (DSGVO Art. 15)" → „Daten herunterladen" — sofortiger Download als JSON-Datei.<br />
          <strong>Konto löschen:</strong> Profil → „Konto löschen" → Bestätigung mit „LÖSCHEN" — sofortige, unwiderrufliche Löschung.<br />
          <strong>Anleitung:</strong> <a href="/konto-loeschen" style={link}>app.staccato-music.de/konto-loeschen</a><br />
          <strong>Per E-Mail:</strong> <a href="mailto:staccato@401dev.de?subject=Kontolöschung%20beantragen" style={link}>staccato@401dev.de</a>
        </p>
        <p style={{ ...p, marginTop: 10 }}>Gesetzliche Aufbewahrungspflichten (z.&nbsp;B. steuerrelevante Unterlagen) bleiben davon unberührt.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>10. Ihre weiteren Rechte</h2>
        <p style={p}>Sie haben gegenüber dem Verantwortlichen folgende Rechte hinsichtlich Ihrer personenbezogenen Daten:</p>
        <ul style={ul}>
          <li><strong>Auskunft</strong> (Art. 15 DSGVO): Jederzeit Auskunft über Ihre gespeicherten Daten</li>
          <li><strong>Berichtigung</strong> (Art. 16 DSGVO): Korrektur unrichtiger Daten</li>
          <li><strong>Löschung</strong> (Art. 17 DSGVO): Löschung Ihrer Daten, sofern keine gesetzliche Aufbewahrungspflicht besteht</li>
          <li><strong>Einschränkung</strong> (Art. 18 DSGVO): Einschränkung der Verarbeitung</li>
          <li><strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO): Daten in einem gängigen Format erhalten</li>
          <li><strong>Widerspruch</strong> (Art. 21 DSGVO): Widerspruch gegen die Verarbeitung</li>
        </ul>
        <p style={{ ...p, marginTop: 10 }}>Zur Ausübung Ihrer Rechte wenden Sie sich an: <a href="mailto:staccato@401dev.de" style={link}>staccato@401dev.de</a></p>
      </section>

      <section style={sek}>
        <h2 style={h2}>11. Beschwerderecht</h2>
        <p style={p}>
          Sie haben das Recht, sich bei der zuständigen Datenschutz-Aufsichtsbehörde zu beschweren. Die zuständige Behörde für Hessen ist:<br /><br />
          <strong>Der Hessische Beauftragte für Datenschutz und Informationsfreiheit (HBDI)</strong><br />
          Gustav-Stresemann-Ring 1<br />
          65189 Wiesbaden<br />
          <a href="https://datenschutz.hessen.de" style={link}>https://datenschutz.hessen.de</a>
        </p>
      </section>

      <section style={sek}>
        <h2 style={h2}>12. Datensicherheit</h2>
        <p style={p}>Die Plattform setzt folgende technische und organisatorische Sicherheitsmaßnahmen ein:</p>
        <ul style={ul}>
          <li>Verschlüsselte Übertragung aller Daten via HTTPS/TLS</li>
          <li>Passwortverschlüsselung mit bcrypt</li>
          <li>Rollenbasierte Zugriffskontrollen (Row Level Security auf Datenbankebene)</li>
          <li>Signierte, zeitlich begrenzte Adressen für Dateizugriffe</li>
          <li>Verschlüsselte Speicherung der Zugangsdaten zu Zahlungsanbietern</li>
          <li>Verschlüsselte tägliche Sicherung</li>
          <li>Keine öffentlichen Datenbankzugriffe ohne Authentifizierung</li>
        </ul>
      </section>

      <section style={sek}>
        <h2 style={h2}>13. Minderjährige</h2>
        <p style={p}>Sofern Schülerinnen und Schüler unter 16 Jahren in der Plattform erfasst werden, erfolgt dies auf Grundlage der Einwilligung der Erziehungsberechtigten durch die jeweilige Musikschule. Erziehungsberechtigte können jederzeit Auskunft, Berichtigung oder Löschung der Daten ihrer Kinder verlangen.</p>
      </section>

    </RechtsRahmen>
  )
}
