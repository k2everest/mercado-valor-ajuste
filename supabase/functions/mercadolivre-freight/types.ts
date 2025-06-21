
export interface Product {
  id: string;
  title: string;
  price: number;
  seller_id: number;
  shipping?: {
    free_shipping: boolean;
  };
}

export interface SellerData {
  seller_reputation?: {
    level_id?: string;
  };
}

// Interface baseada na documentação oficial ML
export interface ShippingOption {
  name?: string;
  shipping_method_id?: string | number;
  cost?: number;           // Custo que o comprador vê/paga
  list_cost?: number;      // Custo real do frete (campo oficial da API)
  estimated_delivery_time?: {
    date?: string;
  };
  discount?: {
    promoted_amount?: number;
    rate?: number;
    type?: string;
  };
}

export interface ProcessedFreightOption {
  method: string;
  carrier: string;
  price: number;           // Preço que o cliente vê
  sellerCost: number;      // Custo real para o vendedor
  buyerCost: number;       // Custo para o comprador
  deliveryTime: string;
  isFreeShipping: boolean;
  paidBy: string;
  source: string;
  rawData: any;
  discount: any;
  calculationMethod: string;
}

export interface FreightCalculationRequest {
  action: string;
  productId: string;
  zipCode: string;
  accessToken: string;
}

export interface FreightCalculationResponse {
  freightOptions: ProcessedFreightOption[];
  selectedOption: ProcessedFreightOption;
  zipCode: string;
  productId: string;
  hasRealCosts: boolean;
  apiSource: string;
  productData: {
    title: string;
    price: number;
    freeShipping: boolean;
    sellerId: number;
  };
  sellerData: {
    reputation: any;
    level: string;
  } | null;
}
