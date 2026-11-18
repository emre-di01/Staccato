// Prüfungen für Bankverbindungen (IBAN per Modulo-97, BIC per Format)

export function bicGueltig(bic) {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic.replace(/\s/g, '').toUpperCase())
}

export function ibanGueltig(iban) {
  const rein = iban.replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(rein)) return false
  const umgestellt = rein.slice(4) + rein.slice(0, 4)
  const ziffern = umgestellt.split('').map(c => isNaN(c) ? String(c.charCodeAt(0) - 55) : c).join('')
  let rest = 0
  for (const chunk of ziffern.match(/.{1,9}/g)) rest = Number(String(rest) + chunk) % 97
  return rest === 1
}
