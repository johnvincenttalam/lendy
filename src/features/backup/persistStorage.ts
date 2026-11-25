/**
 * Asks the browser to keep Ollie's data even when the device runs low on
 * space. Without this, the browser may clear site storage on its own, and
 * everything here lives in that storage. Only asked once there's data worth
 * keeping, since some browsers (Firefox) show a prompt.
 */
export async function requestPersistentStorage(hasData: boolean): Promise<void> {
  if (!hasData || typeof navigator === 'undefined' || !navigator.storage?.persist) return
  try {
    if (await navigator.storage.persisted()) return
    await navigator.storage.persist()
  } catch {
    // Not critical: backups still protect the data.
  }
}
