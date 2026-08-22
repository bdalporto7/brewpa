/**
 * Coffee Entry Card Component
 * 
 * This component displays a coffee entry in a clean, informative card format
 * with all the brewing details and actions for editing/deleting.
 */

'use client';

import { CoffeeEntry } from '@/types/coffee';
import { formatDate, getRatioLabel, ROAST_LEVELS, BREW_METHODS } from '@/utils/constants';
import { StarIcon, PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import BrewMethodIcon from './BrewMethodIcon';

interface CoffeeEntryCardProps {
  entry: CoffeeEntry;
  onEdit?: (entry: CoffeeEntry) => void;
  onDelete?: (id: string) => void;
}

export default function CoffeeEntryCard({ entry, onEdit, onDelete }: CoffeeEntryCardProps) {
  const roastLevel = ROAST_LEVELS.find(level => level.value === entry.roastLevel);
  const brewMethod = BREW_METHODS.find(method => method.value === entry.brewMethod);

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <StarIcon
          key={i}
          className={`h-4 w-4 ${
            i <= rating ? 'text-yellow-400 fill-current' : 'text-gray-300'
          }`}
        />
      );
    }
    return stars;
  };

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow duration-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {entry.name}
            </h3>
            <p className="text-sm text-gray-600 mb-2">
              {entry.origin} • {roastLevel?.label}
            </p>
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                {renderStars(entry.rating)}
              </div>
              <span className="text-sm text-gray-500">
                {entry.rating}/5
              </span>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex space-x-2">
            {onEdit && (
              <button
                onClick={() => onEdit(entry)}
                className="p-2 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors duration-200"
                title="Edit entry"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(entry.id)}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors duration-200"
                title="Delete entry"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Brew Details */}
      <div className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Brew Method
            </dt>
            <dd className="mt-1 text-sm text-gray-900 flex items-center">
              <BrewMethodIcon method={entry.brewMethod} size="sm" className="mr-2" />
              {brewMethod?.label}
            </dd>
          </div>
          
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Grind Size
            </dt>
            <dd className="mt-1 text-sm text-gray-900 capitalize">
              {entry.grindSize.replace('-', ' ')}
            </dd>
          </div>
          
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Temperature
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {entry.waterTemperature}°C
            </dd>
          </div>
          
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Brew Time
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {entry.brewTime} min
            </dd>
          </div>
        </div>

        {/* Weights and Ratio */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Coffee Weight
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {entry.coffeeWeight}g
            </dd>
          </div>
          
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Water Weight
            </dt>
            <dd className="mt-1 text-sm text-gray-900">
              {entry.waterWeight}g
            </dd>
          </div>
          
          <div>
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Ratio
            </dt>
            <dd className="mt-1 text-sm text-gray-900 font-medium">
              {getRatioLabel(entry.coffeeWeight, entry.waterWeight)}
            </dd>
          </div>
        </div>

        {/* Notes */}
        {entry.notes && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
              Notes
            </dt>
            <dd className="text-sm text-gray-700 leading-relaxed">
              {entry.notes}
            </dd>
          </div>
        )}

        {/* Timestamp */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <p className="text-xs text-gray-500">
            Brewed on {formatDate(entry.createdAt)}
          </p>
        </div>
      </div>
    </div>
  );
} 