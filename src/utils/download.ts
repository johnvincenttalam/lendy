/** Saves text as a file through the browser's download. */
export function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Today's date for file names, e.g. 2026-11-26. */
export function dateSuffix() {
  return new Date().toISOString().split('T')[0]
}
