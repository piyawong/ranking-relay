import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const createRelayNodeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  tag: z.string().optional(),
  description: z.string().optional(),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  location: z.string().optional(),
  country: z.string().optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).default('active'),
  endpoint: z.string().url().optional().or(z.literal('')),
});

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const tag = searchParams.get('tag');
    const country = searchParams.get('country');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (tag) where.tag = tag;
    if (country) where.country = country;

    const nodes = await prisma.relayNode.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });

    const formattedNodes = nodes.map((node) => ({
      ...node,
      latitude: Number(node.latitude),
      longitude: Number(node.longitude),
    }));

    return NextResponse.json({
      success: true,
      data: formattedNodes,
      total: formattedNodes.length,
    });
  } catch (error) {
    console.error('Error fetching relay nodes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch relay nodes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = createRelayNodeSchema.parse(body);

    const node = await prisma.relayNode.create({
      data: {
        name: validatedData.name,
        tag: validatedData.tag || null,
        description: validatedData.description || null,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        location: validatedData.location || null,
        country: validatedData.country || null,
        status: validatedData.status,
        endpoint: validatedData.endpoint || null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...node,
        latitude: Number(node.latitude),
        longitude: Number(node.longitude),
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      );
    }
    console.error('Error creating relay node:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create relay node' },
      { status: 500 }
    );
  }
}
