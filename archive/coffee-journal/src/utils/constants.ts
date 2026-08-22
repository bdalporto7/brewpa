/**
 * Coffee Journal Constants and Utilities
 * 
 * This file contains constants, utility functions, and helper methods
 * used throughout the coffee journal application.
 */

import { RoastLevel, GrindSize, BrewMethod, ProcessingMethod, CoffeeFormData } from '@/types/coffee';

export const ROAST_LEVELS: { value: RoastLevel; label: string; color: string; description: string }[] = [
  { value: 'light', label: 'Light', color: 'bg-amber-200', description: 'Light brown, no oil on surface' },
  { value: 'medium-light', label: 'Medium Light', color: 'bg-amber-300', description: 'Medium brown, still no oil' },
  { value: 'medium', label: 'Medium', color: 'bg-amber-400', description: 'Medium brown, traces of oil' },
  { value: 'medium-dark', label: 'Medium Dark', color: 'bg-amber-600', description: 'Dark brown with some oil' },
  { value: 'dark', label: 'Dark', color: 'bg-amber-800', description: 'Dark brown with oil sheen' },
  { value: 'very-dark', label: 'Very Dark', color: 'bg-amber-900', description: 'Nearly black with oil' },
];

export const GRIND_SIZES: { value: GrindSize; label: string; description: string; bestFor: string[] }[] = [
  { value: 'extra-fine', label: 'Extra Fine', description: 'Like powdered sugar', bestFor: ['espresso', 'moka-pot'] },
  { value: 'fine', label: 'Fine', description: 'Like table salt', bestFor: ['espresso', 'aeropress'] },
  { value: 'medium-fine', label: 'Medium Fine', description: 'Like sand', bestFor: ['pour-over', 'v60', 'chemex'] },
  { value: 'medium', label: 'Medium', description: 'Like coarse sand', bestFor: ['drip', 'siphon'] },
  { value: 'medium-coarse', label: 'Medium Coarse', description: 'Like breadcrumbs', bestFor: ['pour-over', 'kalita'] },
  { value: 'coarse', label: 'Coarse', description: 'Like sea salt', bestFor: ['french-press', 'cold-brew'] },
  { value: 'extra-coarse', label: 'Extra Coarse', description: 'Like peppercorns', bestFor: ['cold-brew'] },
];

export const BREW_METHODS: { value: BrewMethod; label: string; description: string; defaultGrind: GrindSize; category: string }[] = [
  { value: 'espresso', label: 'Espresso', description: 'High-pressure extraction', defaultGrind: 'fine', category: 'pressure' },
  { value: 'pour-over', label: 'Pour Over', description: 'Manual pouring technique', defaultGrind: 'medium-fine', category: 'pour-over' },
  { value: 'french-press', label: 'French Press', description: 'Full immersion brewing', defaultGrind: 'coarse', category: 'immersion' },
  { value: 'aeropress', label: 'AeroPress', description: 'Air pressure extraction', defaultGrind: 'fine', category: 'pressure' },
  { value: 'moka-pot', label: 'Moka Pot', description: 'Stovetop pressure brewing', defaultGrind: 'fine', category: 'pressure' },
  { value: 'cold-brew', label: 'Cold Brew', description: 'Long cold extraction', defaultGrind: 'coarse', category: 'cold' },
  { value: 'drip', label: 'Drip', description: 'Automatic drip machine', defaultGrind: 'medium', category: 'drip' },
  { value: 'siphon', label: 'Siphon', description: 'Vacuum brewing method', defaultGrind: 'medium', category: 'vacuum' },
  { value: 'chemex', label: 'Chemex', description: 'Pour-over with thick filters', defaultGrind: 'medium-fine', category: 'pour-over' },
  { value: 'v60', label: 'V60', description: 'Hario V60 dripper', defaultGrind: 'medium-fine', category: 'pour-over' },
  { value: 'kalita', label: 'Kalita', description: 'Flat-bottom dripper', defaultGrind: 'medium-coarse', category: 'pour-over' },
  { value: 'other', label: 'Other', description: 'Other brewing methods', defaultGrind: 'medium', category: 'other' },
];

export const PROCESSING_METHODS: { value: ProcessingMethod; label: string; description: string }[] = [
  { value: 'washed', label: 'Washed', description: 'Fruit removed before drying, clean taste' },
  { value: 'natural', label: 'Natural', description: 'Dried with fruit intact, fruity flavors' },
  { value: 'honey', label: 'Honey', description: 'Partially washed, sweet and fruity' },
  { value: 'semi-washed', label: 'Semi-Washed', description: 'Hybrid process, balanced flavors' },
  { value: 'wet-hulled', label: 'Wet-Hulled', description: 'Indonesian method, earthy taste' },
  { value: 'anaerobic', label: 'Anaerobic', description: 'Fermented without oxygen, unique flavors' },
];

export const TEMPERATURE_RANGE = {
  min: 80,
  max: 100,
  step: 1,
  default: 93,
};

export const WEIGHT_RANGE = {
  min: 1,
  max: 100,
  step: 0.1,
  default: 18,
};

export const BREW_TIME_RANGE = {
  min: 1,
  max: 30,
  step: 0.5,
  default: 3,
};

export const RATING_RANGE = {
  min: 1,
  max: 5,
  step: 0.5,
  default: 3,
};

/**
 * Generate a unique ID for coffee entries
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Format a date for display
 */
export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/**
 * Calculate the coffee-to-water ratio
 */
export function calculateRatio(coffeeWeight: number, waterWeight: number): number {
  return waterWeight / coffeeWeight;
}

/**
 * Get the ratio label (e.g., "1:16")
 */
export function getRatioLabel(coffeeWeight: number, waterWeight: number): string {
  const ratio = calculateRatio(coffeeWeight, waterWeight);
  return `1:${ratio.toFixed(1)}`;
}

/**
 * Validate coffee entry data
 */
export function validateCoffeeEntry(data: Partial<CoffeeFormData>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || data.name.trim().length === 0) {
    errors.push('Coffee name is required');
  }

  if (!data.origin || data.origin.trim().length === 0) {
    errors.push('Origin is required');
  }

  if (data.waterTemperature !== undefined && (data.waterTemperature < TEMPERATURE_RANGE.min || data.waterTemperature > TEMPERATURE_RANGE.max)) {
    errors.push(`Water temperature must be between ${TEMPERATURE_RANGE.min}°C and ${TEMPERATURE_RANGE.max}°C`);
  }

  if (data.coffeeWeight !== undefined && (data.coffeeWeight < WEIGHT_RANGE.min || data.coffeeWeight > WEIGHT_RANGE.max)) {
    errors.push(`Coffee weight must be between ${WEIGHT_RANGE.min}g and ${WEIGHT_RANGE.max}g`);
  }

  if (data.waterWeight !== undefined && (data.waterWeight < WEIGHT_RANGE.min || data.waterWeight > WEIGHT_RANGE.max * 10)) {
    errors.push(`Water weight must be between ${WEIGHT_RANGE.min}g and ${WEIGHT_RANGE.max * 10}g`);
  }

  if (data.brewTime !== undefined && (data.brewTime < BREW_TIME_RANGE.min || data.brewTime > BREW_TIME_RANGE.max)) {
    errors.push(`Brew time must be between ${BREW_TIME_RANGE.min} and ${BREW_TIME_RANGE.max} minutes`);
  }

  if (data.rating !== undefined && (data.rating < RATING_RANGE.min || data.rating > RATING_RANGE.max)) {
    errors.push(`Rating must be between ${RATING_RANGE.min} and ${RATING_RANGE.max}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
} 