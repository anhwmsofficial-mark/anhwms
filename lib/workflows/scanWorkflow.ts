import { ScanMode } from '@/types/scanner';
import { getProducts } from '@/lib/api/products';
import { Product } from '@/types';

/**
 * Validates if the scanned item is valid for the current workflow.
 */

export async function handleScanWorkflow(
  barcode: string, 
  mode: ScanMode, 
  context: any = {}
): Promise<any> {
  console.log(`Processing scan: ${barcode} in mode: ${mode}`);

  // Common: Fetch product info
  // We use the search parameter which searches name, sku, and barcode
  let product: Product | null = null;
  
  try {
    const { data } = await getProducts({ search: barcode, limit: 10 });
    
    // Try to find exact match first
    product = data.find(p => p.barcode === barcode || p.sku === barcode) || null;
    
    // If no exact match, take the first one (partial match)
    if (!product && data.length > 0) {
      product = data[0];
    }
  } catch (error) {
    console.error('Failed to fetch product:', error);
    // Don't throw yet, maybe it's a location code
  }

  // Handle Location Codes
  if (!product && (barcode.startsWith('LOC-') || barcode.startsWith('BIN-') || barcode.startsWith('ZONE-'))) {
    return {
      type: 'location',
      id: barcode,
      name: `Location ${barcode}`
    };
  }

  if (!product) {
    throw new Error(`Product not found for barcode: ${barcode}`);
  }

  // Logic based on mode
  switch (mode) {
    case 'lookup':
      return {
        name: product.name,
        sku: product.sku,
        barcode: product.barcode,
        location: product.location || 'No Location',
        qty: product.quantity,
        unit: product.unit,
        category: product.category
      };
      
    case 'inbound':
      // Check if item is expected inbound
      const expected = product.expectedInbound || 0;
      if (expected <= 0) {
         // Still return info but maybe with a warning flag?
         // For now just return info
      }
      return {
        action: 'add_to_inbound',
        name: product.name,
        sku: product.sku,
        expected_qty: expected,
        current_qty: product.quantity
      };

    case 'outbound':
      // Check if item is available
      if (product.quantity <= 0) {
        throw new Error(`Out of stock: ${product.name}`);
      }
      return {
        action: 'pick_item',
        name: product.name,
        sku: product.sku,
        qty_available: product.quantity,
        location: product.location
      };

    case 'relocation':
      return { 
        type: 'product', 
        id: product.id,
        name: product.name,
        current_location: product.location
      };

    case 'count':
      return {
        action: 'count_increment',
        name: product.name,
        sku: product.sku,
        qty: 1
      };

    default:
      throw new Error(`Unknown mode: ${mode}`);
  }
}
