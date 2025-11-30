import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { z } from 'zod';

const updateRelayNodeSchema = z.object({
  name: z.string().min(1).optional(),
  tag: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  location: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
  endpoint: z.string().nullable().optional(),
});

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const node = await prisma.relayNode.findUnique({
      where: { id: params.id },
    });

    if (!node) {
      return NextResponse.json(
        { success: false, error: 'Relay node not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...node,
        latitude: Number(node.latitude),
        longitude: Number(node.longitude),
      },
    });
  } catch (error) {
    console.error('Error fetching relay node:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch relay node' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const validatedData = updateRelayNodeSchema.parse(body);

    const existingNode = await prisma.relayNode.findUnique({
      where: { id: params.id },
    });

    if (!existingNode) {
      return NextResponse.json(
        { success: false, error: 'Relay node not found' },
        { status: 404 }
      );
    }

    const node = await prisma.relayNode.update({
      where: { id: params.id },
      data: {
        ...(validatedData.name !== undefined && { name: validatedData.name }),
        ...(validatedData.tag !== undefined && { tag: validatedData.tag }),
        ...(validatedData.description !== undefined && { description: validatedData.description }),
        ...(validatedData.latitude !== undefined && { latitude: validatedData.latitude }),
        ...(validatedData.longitude !== undefined && { longitude: validatedData.longitude }),
        ...(validatedData.location !== undefined && { location: validatedData.location }),
        ...(validatedData.country !== undefined && { country: validatedData.country }),
        ...(validatedData.status !== undefined && { status: validatedData.status }),
        ...(validatedData.endpoint !== undefined && { endpoint: validatedData.endpoint || null }),
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
    console.error('Error updating relay node:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update relay node' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const existingNode = await prisma.relayNode.findUnique({
      where: { id: params.id },
    });

    if (!existingNode) {
      return NextResponse.json(
        { success: false, error: 'Relay node not found' },
        { status: 404 }
      );
    }

    await prisma.relayNode.delete({
      where: { id: params.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Relay node deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting relay node:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete relay node' },
      { status: 500 }
    );
  }
}
