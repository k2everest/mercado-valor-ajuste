
import { Product, SellerData, ShippingOption } from './types.ts';

export class MercadoLibreApiService {
  constructor(private accessToken: string) {}

  async getProduct(productId: string): Promise<Product> {
    console.log('Buscando detalhes do produto...');
    const productResponse = await fetch(`https://api.mercadolibre.com/items/${productId}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (!productResponse.ok) {
      console.error('Erro ao buscar produto:', productResponse.status);
      throw new Error(`Falha ao buscar produto: ${productResponse.status}`);
    }

    const product = await productResponse.json();
    console.log('Produto encontrado:', product.title);
    console.log('Seller ID:', product.seller_id);
    console.log('Frete grátis do produto:', product.shipping?.free_shipping);

    return product;
  }

  async getSeller(sellerId: number): Promise<SellerData | null> {
    console.log('Buscando informações do vendedor...');
    const sellerResponse = await fetch(`https://api.mercadolibre.com/users/${sellerId}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (sellerResponse.ok) {
      const sellerData = await sellerResponse.json();
      console.log('Seller reputation:', sellerData.seller_reputation);
      return sellerData;
    }

    return null;
  }

  async getDirectShippingOptions(productId: string, zipCode: string): Promise<ShippingOption[]> {
    console.log('=== TENTATIVA 1: Opções de frete diretas com breakdown ===');
    const directShippingUrl = `https://api.mercadolibre.com/items/${productId}/shipping_options?zip_code=${zipCode}&include_dimensions=true`;
    console.log('URL:', directShippingUrl);
    
    const directShippingResponse = await fetch(directShippingUrl, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (directShippingResponse.ok) {
      const directShippingData = await directShippingResponse.json();
      console.log('Resposta completa da API de frete direto:', JSON.stringify(directShippingData, null, 2));

      if (directShippingData?.options && directShippingData.options.length > 0) {
        console.log('Processando opções de frete diretas...');
        return directShippingData.options;
      }
    } else {
      console.error('Falha na API de frete direto:', directShippingResponse.status, await directShippingResponse.text());
    }

    return [];
  }

  async getFallbackShippingCosts(productId: string, zipCode: string, sellerId: number): Promise<any[]> {
    console.log('=== TENTATIVA 2: API de custos de frete com contexto do vendedor ===');
    const costsUrl = `https://api.mercadolibre.com/sites/MLB/shipping_costs?dimensions=20x20x20,1000&zip_code_from=${sellerId}&zip_code_to=${zipCode}&item_id=${productId}`;
    console.log('URL:', costsUrl);
    
    const costsResponse = await fetch(costsUrl, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
      },
    });

    if (costsResponse.ok) {
      const costsData = await costsResponse.json();
      console.log('Resposta da API de custos:', JSON.stringify(costsData, null, 2));
      
      if (costsData?.costs && costsData.costs.length > 0) {
        return costsData.costs;
      }
    } else {
      console.error('Falha na API de custos:', costsResponse.status, await costsResponse.text());
    }

    return [];
  }
}
