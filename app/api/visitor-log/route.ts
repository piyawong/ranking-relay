import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/db/prisma';

// Lightweight visitor logging - fire and forget
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { ip, path, userAgent } = body;

    if (!ip || ip === '127.0.0.1' || ip === '::1') {
      return NextResponse.json({ ok: true });
    }

    // Fire and forget - don't await, let it run in background
    logVisitor(ip, path, userAgent).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}

async function logVisitor(ip: string, path?: string, userAgent?: string) {
  try {
    // Get geo data from free ip-api.com (no API key needed)
    let country: string | null = null;
    let city: string | null = null;

    try {
      const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=country,city`, {
        signal: AbortSignal.timeout(2000), // 2s timeout
      });
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        country = geoData.country || null;
        city = geoData.city || null;
      }
    } catch {
      // Geo lookup failed, continue without it
    }

    await prisma.visitorLog.create({
      data: {
        id: randomUUID(),
        ip,
        country,
        city,
        path,
        user_agent: userAgent,
      },
    });
  } catch {
    // Silent fail - don't disrupt anything
  }
}
