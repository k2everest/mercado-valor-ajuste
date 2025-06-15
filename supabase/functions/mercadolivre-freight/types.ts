
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

export interface ShippingOption {
  name?: string;
  shipping_method_id?: string | number;
  cost?: number;
  base_cost?: number;
  list_cost?: number;
  seller_cost?: number;
  discount?: {
    promoted_amount?: number;
    rate?: number;
  };
  estimated_delivery_time?: {
    date?: string;
  };
}

export interface ProcessedFreightOption {
  method: string;
  carrier: string;
  price: number;
  sellerCost: number;
  buyerCost: number;
  deliveryTime: string;
  isFreeShipping: boolean;
  paidBy: string;
  source: string;
  rawData: any;
  discount: any;
  isMercadoEnviosPadrao: boolean;
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
