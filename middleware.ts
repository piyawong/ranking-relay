import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const response = NextResponse.next();

  // Only track page views, not API calls or static assets
  const path = request.nextUrl.pathname;
  if (
    path.startsWith('/api/') ||
    path.startsWith('/_next/') ||
    path.startsWith('/favicon') ||
    path.includes('.')
  ) {
    return response;
  }

  // Extract IP from headers
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const ip = forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';

  // Skip localhost
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'unknown') {
    return response;
  }

  const userAgent = request.headers.get('user-agent') || undefined;

  // Fire and forget - non-blocking log request
  const logUrl = new URL('/api/visitor-log', request.url);
  fetch(logUrl.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ip, path, userAgent }),
  }).catch(() => {});

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
