/**
 * Stats Dashboard Component
 * 
 * This component displays key statistics about the user's coffee brewing
 * history in an attractive dashboard format.
 */

'use client';

import { CoffeeStats } from '@/types/coffee';
import { BREW_METHODS } from '@/utils/constants';
import BrewMethodIcon from './BrewMethodIcon';
import { 
  BeakerIcon, 
  StarIcon, 
  CalendarIcon, 
  GlobeAltIcon 
} from '@heroicons/react/24/outline';

interface StatsDashboardProps {
  stats: CoffeeStats;
  loading?: boolean;
}

export default function StatsDashboard({ stats, loading = false }: StatsDashboardProps) {
  const favoriteBrewMethod = BREW_METHODS.find(method => method.value === stats.favoriteBrewMethod);

  const statCards = [
    {
      name: 'Total Entries',
      value: stats.totalEntries,
      icon: BeakerIcon,
      color: 'bg-blue-500',
      description: 'Coffee entries recorded',
    },
    {
      name: 'Average Rating',
      value: stats.averageRating.toFixed(1),
      icon: StarIcon,
      color: 'bg-yellow-500',
      description: 'Out of 5 stars',
    },
    {
      name: 'Brews This Month',
      value: stats.totalBrewsThisMonth,
      icon: CalendarIcon,
      color: 'bg-green-500',
      description: 'Current month',
    },
    {
      name: 'Favorite Origin',
      value: stats.favoriteOrigin || 'None',
      icon: GlobeAltIcon,
      color: 'bg-purple-500',
      description: 'Most brewed origin',
    },
  ];

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-lg p-6">
        <div className="border-b border-gray-200 pb-4 mb-6">
          <h2 className="text-xl font-semibold text-gray-900">
            Your Coffee Stats
          </h2>
          <p className="text-gray-600 mt-1">
            Loading statistics...
          </p>
        </div>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="border-b border-gray-200 pb-4 mb-6">
        <h2 className="text-xl font-semibold text-gray-900">
          Your Coffee Stats
        </h2>
        <p className="text-gray-600 mt-1">
          Insights from your brewing journey
        </p>
      </div>

      {stats.totalEntries === 0 ? (
        <div className="text-center py-8">
          <BeakerIcon className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No entries yet</h3>
          <p className="mt-1 text-sm text-gray-500">
            Start recording your coffee brews to see your stats here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {statCards.map((stat) => (
            <div key={stat.name} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center">
                <div className={`flex-shrink-0 p-2 rounded-md ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-500">{stat.name}</p>
                  <p className="text-2xl font-semibold text-gray-900">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Favorite Brew Method */}
      {stats.favoriteBrewMethod && favoriteBrewMethod && (
        <div className="mt-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-lg border border-amber-200">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <BrewMethodIcon method={stats.favoriteBrewMethod} size="lg" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-amber-800">
                Favorite Brew Method
              </h3>
              <p className="text-lg font-semibold text-amber-900">
                {favoriteBrewMethod.label}
              </p>
              <p className="text-sm text-amber-700">
                Your most used brewing method
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Quick Tips */}
      {stats.totalEntries > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="text-sm font-medium text-blue-800 mb-2">
            💡 Brewing Tips
          </h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Try different grind sizes to find your perfect extraction</li>
            <li>• Experiment with water temperature between 90-96°C</li>
            <li>• Keep your coffee-to-water ratio between 1:15 and 1:17</li>
            <li>• Record your observations to improve your technique</li>
          </ul>
        </div>
      )}
    </div>
  );
} 