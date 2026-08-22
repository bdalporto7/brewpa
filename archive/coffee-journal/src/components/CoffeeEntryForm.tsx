/**
 * Coffee Entry Form Component
 * 
 * This component provides a comprehensive form for adding and editing
 * coffee entries with validation and a clean, user-friendly interface.
 */

'use client';

import { useState, useEffect } from 'react';
import { CoffeeFormData, CoffeeEntry, Rating } from '@/types/coffee';
import { 
  ROAST_LEVELS, 
  GRIND_SIZES, 
  BREW_METHODS, 
  PROCESSING_METHODS,
  TEMPERATURE_RANGE, 
  WEIGHT_RANGE, 
  BREW_TIME_RANGE, 
  RATING_RANGE 
} from '@/utils/constants';

interface CoffeeEntryFormProps {
  entry?: CoffeeEntry;
  onSubmit: (data: CoffeeFormData) => Promise<{ success: boolean; error?: string }>;
  onCancel?: () => void;
}

export default function CoffeeEntryForm({ entry, onSubmit, onCancel }: CoffeeEntryFormProps) {
  const [formData, setFormData] = useState<CoffeeFormData>({
    name: '',
    roastLevel: 'medium',
    origin: '',
    grindSize: 'medium',
    brewMethod: 'pour-over',
    waterTemperature: TEMPERATURE_RANGE.default,
    coffeeWeight: WEIGHT_RANGE.default,
    waterWeight: WEIGHT_RANGE.default * 16, // Default 1:16 ratio
    brewTime: BREW_TIME_RANGE.default,
    rating: RATING_RANGE.default as Rating,
    notes: '',
    beanVariety: '',
    processingMethod: 'washed',
    roastDate: undefined,
    farmer: '',
    elevation: undefined,
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form with entry data if editing
  useEffect(() => {
    if (entry) {
      setFormData({
        name: entry.name,
        roastLevel: entry.roastLevel,
        origin: entry.origin,
        grindSize: entry.grindSize,
        brewMethod: entry.brewMethod,
        waterTemperature: entry.waterTemperature,
        coffeeWeight: entry.coffeeWeight,
        waterWeight: entry.waterWeight,
        brewTime: entry.brewTime,
        rating: entry.rating,
        notes: entry.notes,
        beanVariety: entry.beanVariety || '',
        processingMethod: entry.processingMethod || 'washed',
        roastDate: entry.roastDate,
        farmer: entry.farmer || '',
        elevation: entry.elevation,
      });
    }
  }, [entry]);

  const handleInputChange = (field: keyof CoffeeFormData, value: string | number | Date | undefined) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear errors when user starts typing
    if (errors.length > 0) {
      setErrors([]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrors([]);

    const result = await onSubmit(formData);
    
    if (result.success) {
      // Reset form if not editing
      if (!entry) {
        setFormData({
          name: '',
          roastLevel: 'medium',
          origin: '',
          grindSize: 'medium',
          brewMethod: 'pour-over',
          waterTemperature: TEMPERATURE_RANGE.default,
          coffeeWeight: WEIGHT_RANGE.default,
          waterWeight: WEIGHT_RANGE.default * 16,
          brewTime: BREW_TIME_RANGE.default,
          rating: RATING_RANGE.default as Rating,
          notes: '',
          beanVariety: '',
          processingMethod: 'washed',
          roastDate: undefined,
          farmer: '',
          elevation: undefined,
        });
      }
    } else {
      setErrors([result.error!]);
    }
    
    setIsSubmitting(false);
  };

  const calculateRatio = () => {
    return (formData.waterWeight / formData.coffeeWeight).toFixed(1);
  };

  // Auto-suggest grind size based on brew method
  const handleBrewMethodChange = (brewMethod: string) => {
    const method = BREW_METHODS.find(m => m.value === brewMethod);
    if (method) {
      setFormData(prev => ({
        ...prev,
        brewMethod: method.value,
        grindSize: method.defaultGrind,
      }));
    }
  };

  const formatDateForInput = (date?: Date) => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow-lg">
      <div className="border-b border-gray-200 pb-4">
        <h2 className="text-2xl font-bold text-gray-900">
          {entry ? 'Edit Coffee Entry' : 'Add New Coffee Entry'}
        </h2>
        <p className="text-gray-600 mt-1">
          Record the details of your coffee brewing experience
        </p>
      </div>

      {errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Please fix the following errors:</h3>
              <div className="mt-2 text-sm text-red-700">
                <ul className="list-disc pl-5 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Coffee Name */}
        <div className="md:col-span-2">
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Coffee Name *
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="e.g., Ethiopian Yirgacheffe"
            required
          />
        </div>

        {/* Roast Level */}
        <div>
          <label htmlFor="roastLevel" className="block text-sm font-medium text-gray-700">
            Roast Level *
          </label>
          <select
            id="roastLevel"
            value={formData.roastLevel}
            onChange={(e) => handleInputChange('roastLevel', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {ROAST_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </div>

        {/* Origin */}
        <div>
          <label htmlFor="origin" className="block text-sm font-medium text-gray-700">
            Origin *
          </label>
          <input
            type="text"
            id="origin"
            value={formData.origin}
            onChange={(e) => handleInputChange('origin', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="e.g., Ethiopia, Colombia"
            required
          />
        </div>

        {/* Brew Method */}
        <div>
          <label htmlFor="brewMethod" className="block text-sm font-medium text-gray-700">
            Brew Method *
          </label>
          <select
            id="brewMethod"
            value={formData.brewMethod}
            onChange={(e) => handleBrewMethodChange(e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {BREW_METHODS.map((method) => (
              <option key={method.value} value={method.value} title={method.description}>
                {method.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            {BREW_METHODS.find(m => m.value === formData.brewMethod)?.description}
          </p>
        </div>

        {/* Grind Size */}
        <div>
          <label htmlFor="grindSize" className="block text-sm font-medium text-gray-700">
            Grind Size *
          </label>
          <select
            id="grindSize"
            value={formData.grindSize}
            onChange={(e) => handleInputChange('grindSize', e.target.value)}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {GRIND_SIZES.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label} - {size.description}
              </option>
            ))}
          </select>
        </div>

        {/* Water Temperature */}
        <div>
          <label htmlFor="waterTemperature" className="block text-sm font-medium text-gray-700">
            Water Temperature (°C) *
          </label>
          <input
            type="number"
            id="waterTemperature"
            value={formData.waterTemperature}
            onChange={(e) => handleInputChange('waterTemperature', parseFloat(e.target.value))}
            min={TEMPERATURE_RANGE.min}
            max={TEMPERATURE_RANGE.max}
            step={TEMPERATURE_RANGE.step}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        {/* Coffee Weight */}
        <div>
          <label htmlFor="coffeeWeight" className="block text-sm font-medium text-gray-700">
            Coffee Weight (g) *
          </label>
          <input
            type="number"
            id="coffeeWeight"
            value={formData.coffeeWeight}
            onChange={(e) => handleInputChange('coffeeWeight', parseFloat(e.target.value))}
            min={WEIGHT_RANGE.min}
            max={WEIGHT_RANGE.max}
            step={WEIGHT_RANGE.step}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        {/* Water Weight */}
        <div>
          <label htmlFor="waterWeight" className="block text-sm font-medium text-gray-700">
            Water Weight (g) *
          </label>
          <input
            type="number"
            id="waterWeight"
            value={formData.waterWeight}
            onChange={(e) => handleInputChange('waterWeight', parseFloat(e.target.value))}
            min={WEIGHT_RANGE.min}
            max={WEIGHT_RANGE.max * 10}
            step={WEIGHT_RANGE.step}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
          <p className="mt-1 text-sm text-gray-500">
            Ratio: 1:{calculateRatio()}
          </p>
        </div>

        {/* Brew Time */}
        <div>
          <label htmlFor="brewTime" className="block text-sm font-medium text-gray-700">
            Brew Time (minutes) *
          </label>
          <input
            type="number"
            id="brewTime"
            value={formData.brewTime}
            onChange={(e) => handleInputChange('brewTime', parseFloat(e.target.value))}
            min={BREW_TIME_RANGE.min}
            max={BREW_TIME_RANGE.max}
            step={BREW_TIME_RANGE.step}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        {/* Rating */}
        <div>
          <label htmlFor="rating" className="block text-sm font-medium text-gray-700">
            Rating (1-5) *
          </label>
          <input
            type="number"
            id="rating"
            value={formData.rating}
            onChange={(e) => handleInputChange('rating', parseFloat(e.target.value))}
            min={RATING_RANGE.min}
            max={RATING_RANGE.max}
            step={RATING_RANGE.step}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            required
          />
        </div>

        {/* Notes */}
        <div className="md:col-span-2">
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Notes
          </label>
          <textarea
            id="notes"
            value={formData.notes}
            onChange={(e) => handleInputChange('notes', e.target.value)}
            rows={4}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            placeholder="Describe the taste, aroma, and any other observations..."
          />
        </div>
      </div>

      {/* Enhanced Coffee Details */}
      <div className="border-t border-gray-200 pt-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Additional Coffee Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Bean Variety */}
          <div>
            <label htmlFor="beanVariety" className="block text-sm font-medium text-gray-700">
              Bean Variety
            </label>
            <input
              type="text"
              id="beanVariety"
              value={formData.beanVariety || ''}
              onChange={(e) => handleInputChange('beanVariety', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="e.g., Bourbon, Typica, Geisha"
            />
          </div>

          {/* Processing Method */}
          <div>
            <label htmlFor="processingMethod" className="block text-sm font-medium text-gray-700">
              Processing Method
            </label>
            <select
              id="processingMethod"
              value={formData.processingMethod || 'washed'}
              onChange={(e) => handleInputChange('processingMethod', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            >
              {PROCESSING_METHODS.map((method) => (
                <option key={method.value} value={method.value} title={method.description}>
                  {method.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              {PROCESSING_METHODS.find(m => m.value === formData.processingMethod)?.description}
            </p>
          </div>

          {/* Roast Date */}
          <div>
            <label htmlFor="roastDate" className="block text-sm font-medium text-gray-700">
              Roast Date
            </label>
            <input
              type="date"
              id="roastDate"
              value={formatDateForInput(formData.roastDate)}
              onChange={(e) => handleInputChange('roastDate', e.target.value ? new Date(e.target.value) : undefined)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
            />
          </div>

          {/* Farmer */}
          <div>
            <label htmlFor="farmer" className="block text-sm font-medium text-gray-700">
              Farmer/Producer
            </label>
            <input
              type="text"
              id="farmer"
              value={formData.farmer || ''}
              onChange={(e) => handleInputChange('farmer', e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="e.g., Juan Valdez"
            />
          </div>

          {/* Elevation */}
          <div>
            <label htmlFor="elevation" className="block text-sm font-medium text-gray-700">
              Elevation (meters)
            </label>
            <input
              type="number"
              id="elevation"
              value={formData.elevation || ''}
              onChange={(e) => handleInputChange('elevation', e.target.value ? parseInt(e.target.value) : undefined)}
              min={0}
              max={3000}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              placeholder="e.g., 1200"
            />
          </div>
        </div>
      </div>

      {/* Form Actions */}
      <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : entry ? 'Update Entry' : 'Add Entry'}
        </button>
      </div>
    </form>
  );
} 