/**
 * Custom Hook for Managing Coffee Entries
 * 
 * This hook provides state management for coffee entries with API
 * persistence. It includes CRUD operations and filtering capabilities.
 */

import { useState, useEffect, useCallback } from 'react';
import { CoffeeEntry, CoffeeFormData, FilterOptions } from '@/types/coffee';

export function useCoffeeEntries() {
  const [entries, setEntries] = useState<CoffeeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load entries from API on mount
  useEffect(() => {
    fetchEntries();
  }, []);

  const fetchEntries = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/coffee-entries');
      
      if (!response.ok) {
        throw new Error('Failed to fetch entries');
      }
      
      const data = await response.json();
      setEntries(data.entries || []);
      setError(null);
    } catch (err) {
      setError('Failed to load coffee entries');
      console.error('Error loading entries:', err);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Add a new coffee entry
   */
  const addEntry = useCallback(async (formData: CoffeeFormData): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch('/api/coffee-entries', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to create entry',
        };
      }

      // Refresh entries list
      await fetchEntries();
      setError(null);
      
      return { success: true };
    } catch (err) {
      console.error('Error adding entry:', err);
      return {
        success: false,
        error: 'Failed to create coffee entry',
      };
    }
  }, []);

  /**
   * Update an existing coffee entry
   */
  const updateEntry = useCallback(async (id: string, formData: CoffeeFormData): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await fetch(`/api/coffee-entries/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (!response.ok) {
        return {
          success: false,
          error: data.error || 'Failed to update entry',
        };
      }

      // Refresh entries list
      await fetchEntries();
      setError(null);
      
      return { success: true };
    } catch (err) {
      console.error('Error updating entry:', err);
      return {
        success: false,
        error: 'Failed to update coffee entry',
      };
    }
  }, []);

  /**
   * Delete a coffee entry
   */
  const deleteEntry = useCallback(async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/coffee-entries/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete entry');
      }

      // Refresh entries list
      await fetchEntries();
      setError(null);
    } catch (err) {
      setError('Failed to delete coffee entry');
      console.error('Error deleting entry:', err);
    }
  }, []);

  /**
   * Get a specific coffee entry by ID
   */
  const getEntry = useCallback(async (id: string): Promise<CoffeeEntry | null> => {
    try {
      const response = await fetch(`/api/coffee-entries/${id}`);
      
      if (!response.ok) {
        return null;
      }
      
      const entry = await response.json();
      return entry;
    } catch (err) {
      console.error('Error fetching entry:', err);
      return null;
    }
  }, []);

  /**
   * Filter entries based on criteria
   */
  const filterEntries = useCallback(async (filters: FilterOptions): Promise<CoffeeEntry[]> => {
    try {
      const params = new URLSearchParams();
      
      if (filters.roastLevel) {
        params.append('roastLevel', filters.roastLevel);
      }
      if (filters.brewMethod) {
        params.append('brewMethod', filters.brewMethod);
      }
      if (filters.minRating) {
        params.append('minRating', filters.minRating.toString());
      }

      const response = await fetch(`/api/coffee-entries?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch filtered entries');
      }
      
      const data = await response.json();
      return data.entries || [];
    } catch (err) {
      console.error('Error filtering entries:', err);
      return [];
    }
  }, []);

  /**
   * Get statistics about coffee entries
   */
  const getStats = useCallback(async () => {
    try {
      const response = await fetch('/api/stats');
      
      if (!response.ok) {
        throw new Error('Failed to fetch statistics');
      }
      
      const stats = await response.json();
      return stats;
    } catch (err) {
      console.error('Error fetching stats:', err);
      return {
        totalEntries: 0,
        averageRating: 0,
        favoriteBrewMethod: null,
        favoriteOrigin: '',
        totalBrewsThisMonth: 0,
      };
    }
  }, []);

  return {
    entries,
    loading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
    getEntry,
    filterEntries,
    getStats,
    refreshEntries: fetchEntries,
  };
} 