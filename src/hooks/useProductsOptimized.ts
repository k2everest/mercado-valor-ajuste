import { useState, useCallback, useMemo } from 'react';
import { Product } from '@/components/dashboard/types';

export const useProductsOptimized = (initialProducts: Product[] = []) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);

  // Memoized product map for faster lookups
  const productMap = useMemo(() => {
    return products.reduce((map, product) => {
      map[product.id] = product;
      return map;
    }, {} as Record<string, Product>);
  }, [products]);

  // Memoized filtered products for different states
  const activeProducts = useMemo(() => 
    products.filter(p => p.status === 'active'),
    [products]
  );

  const freeShippingProducts = useMemo(() => 
    products.filter(p => p.freeShipping),
    [products]
  );

  const productsWithFreight = useMemo(() => 
    products.filter(p => p.sellerFreightCost !== undefined),
    [products]
  );

  // Optimized update functions
  const updateProduct = useCallback((productId: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => 
      p.id === productId ? { ...p, ...updates } : p
    ));
  }, []);

  const updateMultipleProducts = useCallback((updates: Record<string, Partial<Product>>) => {
    setProducts(prev => prev.map(p => 
      updates[p.id] ? { ...p, ...updates[p.id] } : p
    ));
  }, []);

  const addProducts = useCallback((newProducts: Product[]) => {
    setProducts(prev => {
      const existingIds = new Set(prev.map(p => p.id));
      const uniqueNewProducts = newProducts.filter(p => !existingIds.has(p.id));
      return [...prev, ...uniqueNewProducts];
    });
  }, []);

  const replaceProducts = useCallback((newProducts: Product[]) => {
    setProducts(newProducts);
  }, []);

  return {
    products,
    productMap,
    activeProducts,
    freeShippingProducts,
    productsWithFreight,
    updateProduct,
    updateMultipleProducts,
    addProducts,
    replaceProducts,
    setProducts
  };
};