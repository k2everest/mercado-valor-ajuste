
export interface Product {
  id: string;
  title: string;
  price: number; // Adicionando propriedade price que estava faltando
  originalPrice: number;
  status: 'active' | 'paused' | 'closed';
  freeShipping: boolean;
  adjustedPrice?: number;
  permalink?: string;
  thumbnail?: string;
  availableQuantity?: number;
  soldQuantity?: number;
  freightCost?: number;
  sellerFreightCost?: number;
  freightMethod?: string;
}

export interface PaginationInfo {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

export interface ProductsListProps {
  products: Product[];
  pagination?: PaginationInfo;
  onLoadMore?: (products: Product[], newPagination: PaginationInfo) => void;
}
