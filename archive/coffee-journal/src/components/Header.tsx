/**
 * Header Component
 * 
 * Modern header with Brewpa branding and search functionality
 */

'use client';

import { useState } from 'react';
import { MagnifyingGlassIcon, Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  onSearch: (searchTerm: string) => void;
  searchValue: string;
  onMenuToggle?: () => void;
}

export default function Header({ onSearch, searchValue, onMenuToggle }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearch(e.target.value);
  };

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
    onMenuToggle?.();
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo/Brand */}
          <div className="flex items-center">
            <div className="flex items-center space-x-3">
              {/* Coffee Bean Icon - Custom SVG */}
              <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center">
                <svg 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  className="w-5 h-5 text-white"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 4.75 9.5 7 11.5 2.25-2 7-6.25 7-11.5 0-3.87-3.13-7-7-7z"/>
                  <circle cx="12" cy="9" r="2.5"/>
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-gray-900">
                <span className="text-amber-600">Brew</span>pa
              </h1>
            </div>
          </div>

          {/* Search Bar - Desktop */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={searchValue}
                onChange={handleSearchChange}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors duration-200"
                placeholder="Search coffee entries..."
              />
            </div>
          </div>

          {/* Navigation Items */}
          <div className="hidden md:flex items-center space-x-4">
            <nav className="flex space-x-8">
              <a
                href="#"
                className="text-gray-600 hover:text-amber-600 px-3 py-2 text-sm font-medium transition-colors duration-200"
              >
                Dashboard
              </a>
              <a
                href="#"
                className="text-gray-600 hover:text-amber-600 px-3 py-2 text-sm font-medium transition-colors duration-200"
              >
                Analytics
              </a>
              <a
                href="#"
                className="text-gray-600 hover:text-amber-600 px-3 py-2 text-sm font-medium transition-colors duration-200"
              >
                Profile
              </a>
            </nav>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <button
              onClick={handleMobileMenuToggle}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-amber-600 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-amber-500 transition-colors duration-200"
            >
              {isMobileMenuOpen ? (
                <XMarkIcon className="block h-6 w-6" />
              ) : (
                <Bars3Icon className="block h-6 w-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Search Bar */}
        <div className="md:hidden pb-3">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              value={searchValue}
              onChange={handleSearchChange}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors duration-200"
              placeholder="Search coffee entries..."
            />
          </div>
        </div>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden border-t border-gray-200">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <a
                href="#"
                className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-amber-600 hover:bg-gray-50 rounded-md transition-colors duration-200"
              >
                Dashboard
              </a>
              <a
                href="#"
                className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-amber-600 hover:bg-gray-50 rounded-md transition-colors duration-200"
              >
                Analytics
              </a>
              <a
                href="#"
                className="block px-3 py-2 text-base font-medium text-gray-600 hover:text-amber-600 hover:bg-gray-50 rounded-md transition-colors duration-200"
              >
                Profile
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}