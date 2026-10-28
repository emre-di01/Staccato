// Rollen, für die das neue Design gebaut ist (dort Standard; klassisches Design per Einstellung).
// Eigene Datei ohne Abhängigkeiten, damit AppContext sie ohne Import-Kreis nutzen kann.
export const NEU_ROLLEN = ['schueler', 'lehrer']

// Rollen, für die das neue Design im Aufbau ist: nur per Opt-in (profiles.neues_design)
export const OPTIN_ROLLEN = ['admin', 'superadmin']

export const DESIGN_ROLLEN = [...NEU_ROLLEN, ...OPTIN_ROLLEN]
