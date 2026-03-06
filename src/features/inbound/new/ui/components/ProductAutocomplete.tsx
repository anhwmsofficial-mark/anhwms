'use client';

import { useEffect, useRef, useState } from 'react';
import { searchProducts, type ProductSearchItem } from '@/app/actions/product';

export default function ProductAutocomplete({
  value,
  clientId,
  onSelect,
  onChange,
}: {
  value: string;
  clientId: string;
  onSelect: (product: ProductSearchItem) => void;
  onChange: (val: string) => void;
}) {
  const [suggestions, setSuggestions] = useState<ProductSearchItem[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearch = async (query: string) => {
    onChange(query);
    if (query.length < 2) {
      setSuggestions([]);
      return;
    }
    try {
      const results = await searchProducts(query, clientId);
      setSuggestions(results || []);
      setShowSuggestions(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full">
      <input
        type="text"
        className="w-full border-gray-300 rounded-lg text-sm px-3 py-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="상품명/SKU 입력..."
        value={value}
        onChange={(e) => handleSearch(e.target.value)}
        onFocus={() => {
          if (suggestions.length > 0) setShowSuggestions(true);
        }}
      />
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-lg shadow-xl mt-1 max-h-60 overflow-y-auto">
          {suggestions.map((product) => (
            <div
              key={product.id}
              className="px-4 py-2 hover:bg-blue-50 cursor-pointer border-b last:border-b-0"
              onClick={() => {
                onSelect(product);
                setShowSuggestions(false);
              }}
            >
              <div className="font-bold text-sm text-gray-800">{product.name}</div>
              <div className="text-xs text-gray-500 flex justify-between">
                <span>{product.sku}</span>
                {product.barcode && <span>{product.barcode}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
