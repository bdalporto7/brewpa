/**
 * Coffee Journal Types and Interfaces
 * 
 * This file contains all the TypeScript types and interfaces used throughout
 * the coffee journal application. These ensure type safety and provide
 * clear documentation of data structures.
 */

export interface CoffeeEntry {
  readonly id: string;
  name: string;
  roastLevel: RoastLevel;
  origin: string;
  grindSize: GrindSize;
  brewMethod: BrewMethod;
  waterTemperature: number;
  coffeeWeight: number;
  waterWeight: number;
  brewTime: number;
  rating: Rating;
  notes: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  // Enhanced properties for better tracking
  beanVariety?: string;
  processingMethod?: ProcessingMethod;
  roastDate?: Date;
  farmer?: string;
  elevation?: number;
  cupping?: CuppingNotes;
}

export const ROAST_LEVELS = [
  'light', 'medium-light', 'medium', 'medium-dark', 'dark', 'very-dark'
] as const;
export type RoastLevel = typeof ROAST_LEVELS[number];

export const GRIND_SIZES = [
  'extra-fine', 'fine', 'medium-fine', 'medium', 'medium-coarse', 'coarse', 'extra-coarse'
] as const;
export type GrindSize = typeof GRIND_SIZES[number];

export const BREW_METHODS = [
  'espresso', 'pour-over', 'french-press', 'aeropress', 'moka-pot', 
  'cold-brew', 'drip', 'siphon', 'chemex', 'v60', 'kalita', 'other'
] as const;
export type BrewMethod = typeof BREW_METHODS[number];

export const PROCESSING_METHODS = [
  'washed', 'natural', 'honey', 'semi-washed', 'wet-hulled', 'anaerobic'
] as const;
export type ProcessingMethod = typeof PROCESSING_METHODS[number];

export type Rating = 1 | 2 | 3 | 4 | 5;

export interface CuppingNotes {
  aroma: number; // 1-10 scale
  flavor: number;
  aftertaste: number;
  acidity: number;
  body: number;
  balance: number;
  overall: number;
  descriptors: string[];
}

export interface CoffeeFormData {
  name: string;
  roastLevel: RoastLevel;
  origin: string;
  grindSize: GrindSize;
  brewMethod: BrewMethod;
  waterTemperature: number;
  coffeeWeight: number;
  waterWeight: number;
  brewTime: number;
  rating: Rating;
  notes: string;
  // Enhanced optional fields
  beanVariety?: string;
  processingMethod?: ProcessingMethod;
  roastDate?: Date;
  farmer?: string;
  elevation?: number;
  cupping?: CuppingNotes;
}

export interface CoffeeStats {
  readonly totalEntries: number;
  readonly averageRating: number;
  readonly favoriteBrewMethod: BrewMethod | null;
  readonly favoriteOrigin: string;
  readonly totalBrewsThisMonth: number;
  readonly bestRatedCoffee: Pick<CoffeeEntry, 'id' | 'name' | 'rating'> | null;
  readonly brewMethodDistribution: Record<BrewMethod, number>;
  readonly originDistribution: Record<string, number>;
  readonly monthlyTrends: Array<{
    month: string;
    totalBrews: number;
    averageRating: number;
  }>;
}

export interface FilterOptions {
  roastLevel?: RoastLevel;
  brewMethod?: BrewMethod;
  minRating?: Rating;
  maxRating?: Rating;
  dateRange?: {
    start: Date;
    end: Date;
  };
  origin?: string;
  processingMethod?: ProcessingMethod;
  searchTerm?: string;
}

export interface UserRole {
  readonly id: string;
  name: 'coffee_enthusiast' | 'barista' | 'roaster' | 'admin';
  permissions: readonly Permission[];
}

export type Permission = 
  | 'view_entries'
  | 'create_entries'
  | 'edit_entries'
  | 'delete_entries'
  | 'view_stats'
  | 'manage_users'
  | 'export_data';

export interface User {
  readonly id: string;
  email: string;
  name?: string;
  role: UserRole;
  preferences: UserPreferences;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface UserPreferences {
  defaultBrewMethod: BrewMethod;
  measurementUnit: 'metric' | 'imperial';
  theme: 'light' | 'dark' | 'auto';
  notifications: {
    newFeatures: boolean;
    weeklyStats: boolean;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export type SortField = 'createdAt' | 'rating' | 'name' | 'brewMethod';
export type SortDirection = 'asc' | 'desc';

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy: SortField;
  sortDirection: SortDirection;
} 