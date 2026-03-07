import { ParsedBarcode } from '@/types/scanner';

/**
 * Parses a raw barcode string to determine its type and clean value.
 * @param barcode Raw barcode string
 * @returns ParsedBarcode object
 */
export function parseBarcode(barcode: string): ParsedBarcode {
  const code = barcode.trim();
  
  // Location patterns
  // LOC-A-01-02, BIN-03-05, etc.
  const locationPattern = /^(LOC|BIN|ZONE|SHELF)-/i;
  
  if (locationPattern.test(code)) {
    return {
      original: code,
      type: 'location',
      value: code.toUpperCase() // Locations are usually uppercase
    };
  }
  
  // Product patterns (EAN, UPC, Custom SKU)
  // Usually just numeric or alphanumeric without specific prefixes unless defined
  // For now, if it's not a location, we assume it's a product or unknown
  
  // Basic validation: ensure it has some length
  if (code.length < 3) {
    return {
      original: code,
      type: 'unknown',
      value: code
    };
  }

  return {
    original: code,
    type: 'product',
    value: code
  };
}

export function isValidBarcode(barcode: string): boolean {
  return barcode.length >= 3;
}
