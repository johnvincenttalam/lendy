/** SHA-256 hex of a PIN. Kept free of stores so tests can use it. */
export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}
