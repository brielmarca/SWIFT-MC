import { NextResponse, NextRequest } from 'next/server'

const CSRF_COOKIE_NAME = '__Host-swiftmc_csrf'

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isAuthPage = AUTH_PAGES.includes(pathname)
  const response = NextResponse.next()
  // Canonical metadata may still point to production on preview deployments.
  // Protect the actual serving host independently of that build-time setting.
  if (!['swiftmc.com.br', 'www.swiftmc.com.br'].includes(request.nextUrl.hostname)) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }

  // Set CSRF cookie on auth page GET requests so the client can read it
  // and send it as an X-CSRF-Token header on state-changing requests.
  if (request.method === 'GET' &&
      isAuthPage &&
      !request.cookies.has(CSRF_COOKIE_NAME)) {
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    const csrfToken = btoa(String.fromCharCode(...array))
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 86400 * 30,
    })
    response.headers.set("Cache-Control", "private, no-store")
    if (pathname === '/verify-email') response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  }

  // Always mark authentication page HTML responses as private, no-store so
  // they are never cached by browsers, CDNs, or intermediate proxies.
  if (isAuthPage) {
    response.headers.set("Cache-Control", "private, no-store")
    if (pathname === '/verify-email') response.headers.set('Referrer-Policy', 'no-referrer')
    return response
  }
  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image).*)'],
}
