import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// simple in-memory rate limiting for API routes
// in production you'd use Redis, but this works for the hackathon demo
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function isRateLimited(ip: string, limit: number = 30, windowMs: number = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }

  entry.count++;
  return entry.count > limit;
}

export function proxy(req: NextRequest) {
  // only rate-limit API routes
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 'unknown';

    if (isRateLimited(ip)) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again in a minute.' },
        { status: 429 }
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
