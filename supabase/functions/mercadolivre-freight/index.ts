
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { MercadoLibreApiService } from './api-service.ts';
import { FreightCalculator } from './freight-calculator.ts';
import { FreightCalculationRequest, FreightCalculationResponse } from './types.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, productId, zipCode, accessToken }: FreightCalculationRequest = await req.json();
    
    console.log('=== CÁLCULO DE FRETE MERCADO LIVRE ===');
    console.log('Product ID:', productId);
    console.log('CEP:', zipCode);
    console.log('Action:', action);
    
    if (!accessToken) {
      throw new Error('Token de acesso é obrigatório');
    }

    if (action === 'getShippingCosts') {
      if (!productId || !zipCode) {
        throw new Error('Product ID e CEP são obrigatórios');
      }

      const apiService = new MercadoLibreApiService(accessToken);
      
      // 1. Buscar dados do produto
      console.log('📦 Buscando dados do produto...');
      const product = await apiService.getProduct(productId);
      
      // 2. Buscar dados do vendedor (opcional)
      console.log('👤 Buscando dados do vendedor...');
      const sellerData = await apiService.getSeller(product.seller_id);

      // 3. Buscar opções de frete
      console.log('🚚 Buscando opções de frete...');
      const shippingOptions = await apiService.getShippingOptions(productId, zipCode);

      if (shippingOptions.length === 0) {
        console.error('❌ Nenhuma opção de frete encontrada');
        throw new Error('Não foram encontradas opções de frete válidas para este produto e CEP');
      }

      // 4. Processar opções
      console.log('⚙️ Processando opções de frete...');
      const processedOptions = FreightCalculator.processShippingOptions(shippingOptions, product);
      
      // 5. Filtrar opções válidas
      const validOptions = FreightCalculator.filterValidOptions(processedOptions);

      if (validOptions.length === 0) {
        throw new Error('Todas as opções de frete retornaram valores inválidos');
      }

      // 6. Selecionar melhor opção
      const selectedOption = FreightCalculator.selectBestOption(validOptions);

      console.log('=== RESULTADO FINAL ===');
      console.log('Opção selecionada:', selectedOption.method);
      console.log('Preço cliente:', selectedOption.price);
      console.log('Custo vendedor:', selectedOption.sellerCost);
      console.log('Custo comprador:', selectedOption.buyerCost);
      console.log('Pago por:', selectedOption.paidBy);

      const response: FreightCalculationResponse = {
        freightOptions: validOptions,
        selectedOption: selectedOption,
        zipCode,
        productId,
        hasRealCosts: true,
        apiSource: 'shipping_options_official',
        productData: {
          title: product.title,
          price: product.price,
          freeShipping: product.shipping?.free_shipping || false,
          sellerId: product.seller_id
        },
        sellerData: sellerData ? {
          reputation: sellerData.seller_reputation,
          level: sellerData.seller_reputation?.level_id || ''
        } : null
      };

      return new Response(
        JSON.stringify(response),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== ERRO NO CÁLCULO DE FRETE ===');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno do servidor',
        details: 'Verifique os logs da função para mais detalhes'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
