// Erzeugte Datei herunterladen
export function dateiSpeichern(datei) {
  const url = URL.createObjectURL(datei)
  const a = document.createElement('a')
  a.href = url
  a.download = datei.name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
