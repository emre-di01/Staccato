export function getNavConfig(rolle, T) {
  if (rolle === 'superadmin') {
    return [
      { icon: '🏫', label: T('all_schools'), to: '/superadmin' },
      { icon: '📊', label: T('dashboard'),   to: '/admin' },
      { gruppe: 'Unterricht', items: [
        { icon: '🎵', label: T('courses'),       to: '/admin/kurse' },
        { icon: '📅', label: T('schedule'),      to: '/admin/stundenplan' },
        { icon: '🎼', label: T('repertoire'),    to: '/admin/repertoire' },
      ]},
      { gruppe: 'Verwaltung', items: [
        { icon: '👥', label: T('members'),       to: '/admin/mitglieder' },
        { icon: '🎭', label: T('events'),        to: '/admin/events' },
        { icon: '🏫', label: T('rooms'),         to: '/admin/raeume' },
        { icon: '🎸', label: T('instruments'),   to: '/admin/instrumente' },
        { icon: '📦', label: T('inventar'),      to: '/admin/inventar' },
        { icon: '📋', label: T('prospects'),     to: '/admin/interessenten' },
        { icon: '💬', label: T('messages'),      to: '/admin/nachrichten', nachrichten: true },
      ]},
      { gruppe: 'Vorstand', items: [
        { icon: '🎯', label: T('vorstand_ziele'),      to: '/vorstand/ziele' },
        { icon: '📝', label: T('vorstand_protokolle'), to: '/vorstand/protokolle' },
      ]},
    ]
  }
  if (rolle === 'admin') {
    return [
      { icon: '📊', label: T('dashboard'), to: '/admin' },
      { gruppe: 'Unterricht', items: [
        { icon: '🎵', label: T('courses'),       to: '/admin/kurse' },
        { icon: '📅', label: T('schedule'),      to: '/admin/stundenplan' },
        { icon: '🎼', label: T('repertoire'),    to: '/admin/repertoire' },
      ]},
      { gruppe: 'Verwaltung', items: [
        { icon: '👥', label: T('members'),       to: '/admin/mitglieder' },
        { icon: '🎭', label: T('events'),        to: '/admin/events' },
        { icon: '🏫', label: T('rooms'),         to: '/admin/raeume' },
        { icon: '🎸', label: T('instruments'),   to: '/admin/instrumente' },
        { icon: '📦', label: T('inventar'),      to: '/admin/inventar' },
        { icon: '📋', label: T('prospects'),     to: '/admin/interessenten' },
        { icon: '💬', label: T('messages'),      to: '/admin/nachrichten', nachrichten: true },
      ]},
      { gruppe: 'Vorstand', items: [
        { icon: '🎯', label: T('vorstand_ziele'),      to: '/vorstand/ziele' },
        { icon: '📝', label: T('vorstand_protokolle'), to: '/vorstand/protokolle' },
      ]},
    ]
  }
  if (rolle === 'vorstand') {
    return [
      { icon: '📊', label: T('dashboard'), to: '/vorstand' },
      { gruppe: 'Schüler-Bereich', items: [
        { icon: '📅', label: T('schedule'),    to: '/vorstand/stundenplan' },
        { icon: '🎵', label: T('my_classes'), to: '/vorstand/kurse' },
        { icon: '🎼', label: T('repertoire'), to: '/vorstand/repertoire' },
        { icon: '🎭', label: T('events'),     to: '/vorstand/events' },
      ]},
      { gruppe: 'Vorstand', items: [
        { icon: '🎯', label: T('vorstand_ziele'),      to: '/vorstand/ziele' },
        { icon: '📝', label: T('vorstand_protokolle'), to: '/vorstand/protokolle' },
        { icon: '📦', label: T('inventar'),              to: '/vorstand/inventar' },
        { icon: '❓', label: T('faq_title'),            to: '/vorstand/faq' },
      ]},
    ]
  }
  const flat = {
    lehrer: [
      { icon: '📊', label: T('dashboard'),    to: '/lehrer' },
      { icon: '🎵', label: T('my_classes'),   to: '/lehrer/kurse' },
      { icon: '📅', label: T('schedule'),      to: '/lehrer/anwesenheit' },
      { icon: '👥', label: T('my_students'),  to: '/lehrer/schueler' },
      { icon: '🎼', label: T('repertoire'),   to: '/lehrer/repertoire' },
      { icon: '🎭', label: T('events'),       to: '/lehrer/events' },
      { icon: '💬', label: T('messages'),     to: '/lehrer/nachrichten', nachrichten: true },
    ],
    schueler: [
      { icon: '📊', label: T('dashboard'),   to: '/schueler' },
      { icon: '📅', label: T('schedule'),     to: '/schueler/stundenplan' },
      { icon: '🎵', label: T('my_classes'),  to: '/schueler/kurse' },
      { icon: '🎼', label: T('repertoire'),  to: '/schueler/repertoire' },
      { icon: '🎭', label: T('events'),      to: '/schueler/events' },
      { icon: '💬', label: T('messages'),    to: '/schueler/nachrichten', nachrichten: true },
      { icon: '❓', label: T('faq_title'),   to: '/schueler/faq' },
    ],
    eltern: [
      { icon: '📊', label: T('dashboard'),  to: '/eltern' },
      { icon: '📅', label: T('schedule'),   to: '/eltern/stundenplan' },
      { icon: '📁', label: T('files'),      to: '/eltern/dateien' },
      { icon: '🎭', label: T('events'),     to: '/eltern/events' },
      { icon: '💬', label: T('messages'),   to: '/eltern/nachrichten', nachrichten: true },
    ],
  }
  return flat[rolle] ?? []
}

export function flattenNav(config) {
  return config.flatMap(entry => entry.gruppe ? entry.items : [entry])
}
