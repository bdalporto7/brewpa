/**
 * Individual Coffee Entry API Routes
 * 
 * This file handles operations for individual coffee entries:
 * - GET /api/coffee-entries/[id] - Get specific entry
 * - PUT /api/coffee-entries/[id] - Update entry
 * - DELETE /api/coffee-entries/[id] - Delete entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateCoffeeEntry } from '@/utils/constants';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const entry = await prisma.coffeeEntry.findUnique({
      where: { id },
    });

    if (!entry) {
      return NextResponse.json(
        { error: 'Coffee entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(entry);
  } catch (error) {
    console.error('Error fetching coffee entry:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coffee entry' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    
    // Validate the input data
    const validation = validateCoffeeEntry(body);
    if (!validation.isValid) {
      return NextResponse.json(
        { error: validation.errors.join(', ') },
        { status: 400 }
      );
    }

    // Check if entry exists
    const existingEntry = await prisma.coffeeEntry.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Coffee entry not found' },
        { status: 404 }
      );
    }

    // Update the coffee entry
    const updatedEntry = await prisma.coffeeEntry.update({
      where: { id },
      data: {
        name: body.name,
        roastLevel: body.roastLevel,
        origin: body.origin,
        grindSize: body.grindSize,
        brewMethod: body.brewMethod,
        waterTemperature: body.waterTemperature,
        coffeeWeight: body.coffeeWeight,
        waterWeight: body.waterWeight,
        brewTime: body.brewTime,
        rating: body.rating,
        notes: body.notes || null,
      },
    });

    return NextResponse.json(updatedEntry);
  } catch (error) {
    console.error('Error updating coffee entry:', error);
    return NextResponse.json(
      { error: 'Failed to update coffee entry' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Check if entry exists
    const existingEntry = await prisma.coffeeEntry.findUnique({
      where: { id },
    });

    if (!existingEntry) {
      return NextResponse.json(
        { error: 'Coffee entry not found' },
        { status: 404 }
      );
    }

    // Delete the coffee entry
    await prisma.coffeeEntry.delete({
      where: { id },
    });

    return NextResponse.json(
      { message: 'Coffee entry deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting coffee entry:', error);
    return NextResponse.json(
      { error: 'Failed to delete coffee entry' },
      { status: 500 }
    );
  }
} 