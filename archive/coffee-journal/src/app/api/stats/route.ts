/**
 * Coffee Statistics API Route
 * 
 * This file provides statistics about coffee entries:
 * - GET /api/stats - Get brewing statistics
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get total count
    const totalEntries = await prisma.coffeeEntry.count();

    if (totalEntries === 0) {
      return NextResponse.json({
        totalEntries: 0,
        averageRating: 0,
        favoriteBrewMethod: null,
        favoriteOrigin: '',
        totalBrewsThisMonth: 0,
      });
    }

    // Get average rating
    const avgRatingResult = await prisma.coffeeEntry.aggregate({
      _avg: {
        rating: true,
      },
    });
    const averageRating = avgRatingResult._avg.rating || 0;

    // Get brews this month
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const totalBrewsThisMonth = await prisma.coffeeEntry.count({
      where: {
        createdAt: {
          gte: thisMonth,
        },
      },
    });

    // Get favorite brew method
    const brewMethodStats = await prisma.coffeeEntry.groupBy({
      by: ['brewMethod'],
      _count: {
        brewMethod: true,
      },
      orderBy: {
        _count: {
          brewMethod: 'desc',
        },
      },
      take: 1,
    });
    const favoriteBrewMethod = brewMethodStats[0]?.brewMethod || null;

    // Get favorite origin
    const originStats = await prisma.coffeeEntry.groupBy({
      by: ['origin'],
      _count: {
        origin: true,
      },
      orderBy: {
        _count: {
          origin: 'desc',
        },
      },
      take: 1,
    });
    const favoriteOrigin = originStats[0]?.origin || '';

    return NextResponse.json({
      totalEntries,
      averageRating: Math.round(averageRating * 10) / 10,
      favoriteBrewMethod,
      favoriteOrigin,
      totalBrewsThisMonth,
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
} 