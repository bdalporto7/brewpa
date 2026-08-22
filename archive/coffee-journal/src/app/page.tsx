/**
 * Coffee Journal - Main Page
 * 
 * This is the main page of the coffee journal application that allows users
 * to add new coffee entries, view their brewing history, and see statistics.
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import { useCoffeeEntries } from '@/hooks/useCoffeeEntries';
import CoffeeEntryForm from '@/components/CoffeeEntryForm';
import CoffeeEntryCard from '@/components/CoffeeEntryCard';
import StatsDashboard from '@/components/StatsDashboard';
import Header from '@/components/Header';
import { CoffeeEntry, CoffeeStats, CoffeeFormData } from '@/types/coffee';

export default function HomePage() {
  const {
    entries,
    loading,
    error,
    addEntry,
    updateEntry,
    deleteEntry,
    getStats,
  } = useCoffeeEntries();

  const [showForm, setShowForm] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CoffeeEntry | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [stats, setStats] = useState<CoffeeStats>({
    totalEntries: 0,
    averageRating: 0,
    favoriteBrewMethod: null,
    favoriteOrigin: '',
    totalBrewsThisMonth: 0,
    bestRatedCoffee: null,
    brewMethodDistribution: {} as Record<string, number>,
    originDistribution: {} as Record<string, number>,
    monthlyTrends: [],
  });
  const [statsLoading, setStatsLoading] = useState(true);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const statsData = await getStats();
      setStats(statsData);
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setStatsLoading(false);
    }
  }, [getStats]);

  // Filter entries based on search term
  const filteredEntries = useMemo(() => {
    if (!searchTerm.trim()) return entries;
    
    const search = searchTerm.toLowerCase();
    return entries.filter((entry) =>
      entry.name.toLowerCase().includes(search) ||
      entry.origin.toLowerCase().includes(search) ||
      entry.brewMethod.toLowerCase().includes(search) ||
      entry.roastLevel.toLowerCase().includes(search) ||
      entry.notes.toLowerCase().includes(search) ||
      entry.beanVariety?.toLowerCase().includes(search) ||
      entry.farmer?.toLowerCase().includes(search)
    );
  }, [entries, searchTerm]);

  // Load stats on mount
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleSearch = (search: string) => {
    setSearchTerm(search);
  };

  const handleAddEntry = async (formData: CoffeeFormData) => {
    const result = await addEntry(formData);
    if (result.success) {
      setShowForm(false);
      // Reload stats after adding entry
      await loadStats();
    }
    return result;
  };

  const handleUpdateEntry = async (formData: CoffeeFormData) => {
    if (!editingEntry) return { success: false, error: 'No entry to update' };
    
    const result = await updateEntry(editingEntry.id, formData);
    if (result.success) {
      setEditingEntry(null);
      // Reload stats after updating entry
      await loadStats();
    }
    return result;
  };

  const handleEditEntry = (entry: CoffeeEntry) => {
    setEditingEntry(entry);
    setShowForm(true);
  };

  const handleDeleteEntry = async (id: string) => {
    if (confirm('Are you sure you want to delete this coffee entry?')) {
      await deleteEntry(id);
      // Reload stats after deleting entry
      await loadStats();
    }
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingEntry(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your coffee journal...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Modern Header with Search */}
      <Header 
        onSearch={handleSearch} 
        searchValue={searchTerm}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">
                  <p>{error}</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stats Dashboard */}
        <div className="mb-8">
          <StatsDashboard stats={stats} loading={statsLoading} />
        </div>

        {/* Form Modal */}
        {showForm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <CoffeeEntryForm
                  entry={editingEntry || undefined}
                  onSubmit={editingEntry ? handleUpdateEntry : handleAddEntry}
                  onCancel={handleCancelForm}
                />
              </div>
            </div>
          </div>
        )}

        {/* Coffee Entries */}
        <div>
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Your Coffee Entries
              </h2>
              {searchTerm && (
                <p className="text-sm text-gray-500 mt-1">
                  Showing {filteredEntries.length} of {entries.length} entries for &ldquo;{searchTerm}&rdquo;
                </p>
              )}
            </div>
            <div className="flex items-center space-x-4">
              <p className="text-gray-600">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-amber-600 hover:bg-amber-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-amber-500 transition-colors duration-200"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Entry
              </button>
            </div>
          </div>

          {entries.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No coffee entries yet
              </h3>
              <p className="text-gray-600 mb-6">
                Start your coffee journal by adding your first brew entry.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Add Your First Entry
              </button>
            </div>
          ) : filteredEntries.length === 0 && searchTerm ? (
            <div className="text-center py-12 bg-white rounded-lg shadow">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No entries found
              </h3>
              <p className="text-gray-600 mb-4">
                No coffee entries match &ldquo;{searchTerm}&rdquo;. Try a different search term.
              </p>
              <button
                onClick={() => setSearchTerm('')}
                className="text-amber-600 hover:text-amber-500 font-medium"
              >
                Clear search
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredEntries.map((entry) => (
                <CoffeeEntryCard
                  key={entry.id}
                  entry={entry}
                  onEdit={handleEditEntry}
                  onDelete={handleDeleteEntry}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
