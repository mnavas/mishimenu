const SESSION_KEY = 'mishimenu_session_id'

export function getOrCreateSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = localStorage.getItem(SESSION_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(SESSION_KEY, id)
    // Also set as cookie so service workers and server routes can read it
    document.cookie = `${SESSION_KEY}=${id}; path=/; max-age=31536000; SameSite=Lax`
  }
  return id
}

export function getSessionIdFromCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(new RegExp(`${SESSION_KEY}=([^;]+)`))
  return match ? match[1] : null
}
