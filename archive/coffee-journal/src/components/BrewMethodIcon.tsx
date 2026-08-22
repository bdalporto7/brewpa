/**
 * Brew Method Icon Component
 * 
 * Provides styled icons for different coffee brewing methods
 */

import { BrewMethod } from '@/types/coffee';

interface BrewMethodIconProps {
  method: BrewMethod;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export default function BrewMethodIcon({ method, size = 'md', className = '' }: BrewMethodIconProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const iconClass = `${sizeClasses[size]} ${className}`;

  const getIcon = () => {
    switch (method) {
      case 'espresso':
        return (
          <div className={`${iconClass} bg-amber-700 rounded-full flex items-center justify-center`}>
            <svg className="w-1/2 h-1/2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z"/>
            </svg>
          </div>
        );

      case 'pour-over':
      case 'v60':
      case 'chemex':
      case 'kalita':
        return (
          <div className={`${iconClass} bg-blue-500 rounded-full flex items-center justify-center`}>
            <svg className="w-1/2 h-1/2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
        );

      case 'french-press':
        return (
          <div className={`${iconClass} bg-green-600 rounded-full flex items-center justify-center`}>
            <svg className="w-1/2 h-1/2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v3.586L7.707 9.293a1 1 0 00-1.414 1.414l3 3a1 1 0 001.414 0l3-3a1 1 0 00-1.414-1.414L11 10.586V7z" clipRule="evenodd" />
            </svg>
          </div>
        );

      case 'aeropress':
        return (
          <div className={`${iconClass} bg-purple-500 rounded-full flex items-center justify-center`}>
            <svg className="w-1/2 h-1/2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        );

      case 'moka-pot':
        return (
          <div className={`${iconClass} bg-orange-500 rounded-full flex items-center justify-center`}>
            <svg className="w-1/2 h-1/2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
        );

      case 'cold-brew':
        return (
          <div className={`${iconClass} bg-cyan-500 rounded-full flex items-center justify-center`}>
            <svg className="w-1/2 h-1/2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM7 3V1m0 18v2m8-10h2m-2 4h2m-2-8h2m-2-4h2" />
            </svg>
          </div>
        );

      case 'drip':
        return (
          <div className={`${iconClass} bg-indigo-500 rounded-full flex items-center justify-center`}>
            <svg className="w-1/2 h-1/2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </div>
        );

      case 'siphon':
        return (
          <div className={`${iconClass} bg-pink-500 rounded-full flex items-center justify-center`}>
            <svg className="w-1/2 h-1/2 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
        );

      default:
        return (
          <div className={`${iconClass} bg-gray-500 rounded-full flex items-center justify-center`}>
            <svg className="w-1/2 h-1/2 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-8.293l-3-3a1 1 0 00-1.414 0l-3 3a1 1 0 001.414 1.414L9 9.828V13a1 1 0 102 0V9.828l1.293 1.293a1 1 0 001.414-1.414z" clipRule="evenodd" />
            </svg>
          </div>
        );
    }
  };

  return getIcon();
}