import { NextResponse, NextRequest } from 'next/server'

const CSRF_COOKIE_NAME = '__Host-swiftmc_csrf'

const AUTH_PAGES = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email']

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  if (process.env.BACKEND_RUNTIME === 'node' && !pathname.startsWith('/api/health/')) {
    // Public static assets and internal image optimization fetches run on the
    // loopback backend; the gateway enforces the secret at the edge.
    const internalAsset = pathname.startsWith('/brand/') || pathname.startsWith('/_next/')
    const expected = process.env.BACKEND_PROXY_SECRET
    if (!internalAsset && (!expected || expected.length < 32 || request.headers.get('x-swift-backend-key') !== expected)) {
      return NextResponse.json({ error: { code: 'ORIGIN_UNAUTHORIZED' } }, { status: 403 })
    }
  }
  // Hide the legacy admin page URLs; rewrite the public console path to the
  // existing server-rendered pages. API authorization remains independently enforced.
  const isLegacyAdmin = pathname === '/admin' || pathname.startsWith('/admin/')
  if (isLegacyAdmin) return new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' },
  })
  const adminPrefix = "/console-r7m4q9v2"
  const isConsole = pathname === adminPrefix || pathname.startsWith(adminPrefix + '/')
  if (isConsole) {
    const target = request.nextUrl.clone()
    target.pathname = '/admin' + pathname.slice(adminPrefix.length)
    const rewritten = NextResponse.rewrite(target)
    rewritten.headers.set('Cache-Control', 'private, no-store')
    rewritten.headers.set('X-Robots-Tag', 'noindex, nofollow')
    rewritten.headers.set('Referrer-Policy', 'no-referrer')
    return rewritten
  }
  const isAuthPage = AUTH_PAGES.includes(pathname)
  const isAdminRoute = pathname === '/admin' || pathname.startsWith('/admin/')
  const isPrivatePage = pathname === '/account' || pathname.startsWith('/account/') ||
    pathname === '/checkout' || pathname.startsWith('/checkout/')
  // Public read-only API caches retain their explicit upstream policies.
  const isPrivateApi = pathname.startsWith('/api/') &&
    pathname !== '/api/server-status' && pathname !== '/api/players/online'
  const response = NextResponse.next()
  // Never allow shared caches to hold session-specific HTML or APIs.
  // These response headers supplement server authorization and do not cache
  // authenticated output, even if a CDN is later configured more aggressively.
  if (isAdminRoute || isPrivatePage || isPrivateApi) {
    response.headers.set('Cache-Control', 'private, no-store')
  }
  if (isAdminRoute) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow, noarchive')
    response.headers.set('Referrer-Policy', 'no-referrer')
  } else if (isPrivatePage) {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow')
  }
  // Canonical metadata may still point to production on preview deployments.
  // Protect the actual serving host independently of that build-time setting.
  if (!isAdminRoute && !['swiftmc.com.br', 'www.swiftmc.com.br'].includes(request.nextUrl.hostname)) {
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
