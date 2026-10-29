'use client';

import ProtectedRoute from '@/components/ProtectedRoute';
import ProductShowcasePage from '../../admin/product-showcase/page';

export default function InventoryProductShowcasePage() {
  return (
    <ProtectedRoute requiredPermission="inventory:count">
      <ProductShowcasePage />
    </ProtectedRoute>
  );
}
