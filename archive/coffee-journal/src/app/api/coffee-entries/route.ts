/**
 * Coffee Entries API Routes
 * 
 * This file handles all CRUD operations for coffee entries:
 * - GET /api/coffee-entries - List all entries
 * - POST /api/coffee-entries - Create new entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { validateCoffeeEntry } from '@/utils/constants';
import { ApiResponse, CoffeeEntry } from '@/types/coffee';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')));
    const brewMethod = searchParams.get('brewMethod');
    const roastLevel = searchParams.get('roastLevel');
    const minRating = searchParams.get('minRating');
    const maxRating = searchParams.get('maxRating');
    const origin = searchParams.get('origin');
    const processingMethod = searchParams.get('processingMethod');
    const searchTerm = searchParams.get('search');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const sortDirection = searchParams.get('sortDirection') || 'desc';

    // Build where clause for filtering
    const where: Record<string, unknown> = {};
    
    if (brewMethod) {
      where.brewMethod = brewMethod;
    }
    
    if (roastLevel) {
      where.roastLevel = roastLevel;
    }
    
    if (minRating || maxRating) {
      where.rating = {};
      if (minRating) (where.rating as Record<string, number>).gte = parseFloat(minRating);
      if (maxRating) (where.rating as Record<string, number>).lte = parseFloat(maxRating);
    }

    if (origin) {
      where.origin = {
        contains: origin,
        mode: 'insensitive'
      };
    }

    if (processingMethod) {
      where.processingMethod = processingMethod;
    }

    if (searchTerm) {
      where.OR = [
        { name: { contains: searchTerm, mode: 'insensitive' } },
        { origin: { contains: searchTerm, mode: 'insensitive' } },
        { notes: { contains: searchTerm, mode: 'insensitive' } },
        { beanVariety: { contains: searchTerm, mode: 'insensitive' } },
        { farmer: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    // Get total count for pagination
    const total = await prisma.coffeeEntry.count({ where });

    // Validate sort field and create orderBy object
    const validSortFields = ['createdAt', 'rating', 'name', 'brewMethod'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'createdAt';
    const direction = sortDirection === 'asc' ? 'asc' : 'desc';
    const orderBy = { [sortField]: direction };

    // Get entries with pagination
    const entries = await prisma.coffeeEntry.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
    });

    const response: ApiResponse<{
      entries: CoffeeEntry[];
      pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
      };
    }> = {
      success: true,
      data: {
        entries: entries as CoffeeEntry[],
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      },
      timestamp: new Date()
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching coffee entries:', error);
    const errorResponse: ApiResponse<null> = {
      success: false,
      error: 'Failed to fetch coffee entries',
      timestamp: new Date()
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the input data
    const validation = validateCoffeeEntry(body);
    if (!validation.isValid) {
      const errorResponse: ApiResponse<null> = {
        success: false,
        error: validation.errors.join(', '),
        timestamp: new Date()
      };
      return NextResponse.json(errorResponse, { status: 400 });
    }

    // Parse optional date fields
    const roastDate = body.roastDate ? new Date(body.roastDate) : null;

    // Create the coffee entry with enhanced fields
    const entry = await prisma.coffeeEntry.create({
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
        // Enhanced fields
        beanVariety: body.beanVariety || null,
        processingMethod: body.processingMethod || null,
        roastDate,
        farmer: body.farmer || null,
        elevation: body.elevation ? parseInt(body.elevation) : null,
      },
    });

    const response: ApiResponse<CoffeeEntry> = {
      success: true,
      data: entry as CoffeeEntry,
      timestamp: new Date()
    };

    return NextResponse.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating coffee entry:', error);
    const errorResponse: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create coffee entry',
      timestamp: new Date()
    };
    return NextResponse.json(errorResponse, { status: 500 });
  }
} 