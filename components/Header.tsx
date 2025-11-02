'use client';

import { BellIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';

interface HeaderProps {
  title: string;
}

export default function Header({ title }: HeaderProps) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8">
      <h2 className="text-2xl font-semibold text-gray-900">{title}</h2>
      <div className="flex items-center gap-4">
        <div className="relative">
          <input
            type="text"
            placeholder="검색..."
            className="w-64 rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
        </div>
        <button className="relative rounded-lg p-2 hover:bg-gray-100">
          <BellIcon className="h-6 w-6 text-gray-600" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-red-500" />
        </button>
      </div>
    </header>
  );
}

