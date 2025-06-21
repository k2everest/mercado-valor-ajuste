
import { Product, SellerData, ShippingOption } from './types.ts';

export class MercadoLibreApiService {
  constructor(private accessToken: string) {}

  async getProduct(productId: string): Promise<Product> {
    console.log('🔍 Buscando detalhes do produto:', productId);
    const productResponse = await fetch(`https://api.mercadolibre.com/items/${productId}`, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'User-Agent': 'MercadoValor/1.0'
      },
    });

    if (!productResponse.ok) {
      const errorText = await productResponse.text();
      console.error('❌ Erro ao buscar produto:', productResponse.status, errorText);
      throw new Error(`Falha ao buscar produto: ${productResponse.status}`);
    }

    const product = await productResponse.json();
    console.log('✅ Produto encontrado:', product.title);
    console.log('📦 Frete grátis:', product.shipping?.free_shipping);

    return product;
  }

  async getSeller(sellerId: number): Promise<SellerData | null> {
    console.log('👤 Buscando informações do vendedor:', sellerId);
    try {
      const sellerResponse = await fetch(`https://api.mercadolibre.com/users/${sellerId}`, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'User-Agent': 'MercadoValor/1.0'
        },
      });

      if (sellerResponse.ok) {
        const sellerData = await sellerResponse.json();
        console.log('✅ Reputação do vendedor:', sellerData.seller_reputation?.level_id);
        return sellerData;
      }
    } catch (error) {
      console.warn('⚠️ Erro ao buscar dados do vendedor:', error);
    }

    return null;
  }

  async getShippingOptions(productId: string, zipCode: string): Promise<ShippingOption[]> {
    console.log('🚚 Buscando opções de frete - Método Principal');
    console.log('📍 CEP destino:', zipCode);
    
    // Método principal: shipping_options (conforme documentação)
    const shippingUrl = `https://api.mercadolibre.com/items/${productId}/shipping_options?zip_code=${zipCode}`;
    console.log('🌐 URL da API:', shippingUrl);
    
    try {
      const response = await fetch(shippingUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'User-Agent': 'MercadoValor/1.0'
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Resposta da API shipping_options:', JSON.stringify(data, null, 2));

        if (data?.options && Array.isArray(data.options) && data.options.length > 0) {
          console.log(`📦 ${data.options.length} opções encontradas`);
          return data.options;
        }
      } else {
        const errorText = await response.text();
        console.warn('⚠️ Erro na API shipping_options:', response.status, errorText);
      }
    } catch (error) {
      console.warn('⚠️ Erro ao chamar shipping_options:', error);
    }

    // Fallback: se não conseguir opções específicas, retorna array vazio
    console.log('❌ Nenhuma opção de frete encontrada');
    return [];
  }
}
