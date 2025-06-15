
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
    console.log('=== INÍCIO DO CÁLCULO DE FRETE ===');
    console.log('Action:', action);
    console.log('Product ID:', productId);
    console.log('ZIP Code:', zipCode);
    
    if (!accessToken) {
      throw new Error('Token de acesso é obrigatório');
    }

    if (action === 'getShippingCosts') {
      if (!productId || !zipCode) {
        throw new Error('Product ID e CEP são obrigatórios');
      }

      const apiService = new MercadoLibreApiService(accessToken);
      
      // Get product and seller details
      const product = await apiService.getProduct(productId);
      const sellerData = await apiService.getSeller(product.seller_id);

      // Try to get shipping options
      let freightOptions = [];

      // Method 1: Direct shipping options
      const directOptions = await apiService.getDirectShippingOptions(productId, zipCode);
      if (directOptions.length > 0) {
        const processedOptions = FreightCalculator.processShippingOptions(directOptions, product);
        freightOptions = processedOptions;
      }

      // Method 2: Fallback shipping costs (if no direct options)
      if (freightOptions.length === 0) {
        const fallbackCosts = await apiService.getFallbackShippingCosts(productId, zipCode, product.seller_id);
        if (fallbackCosts.length > 0) {
          freightOptions = FreightCalculator.processFallbackCosts(fallbackCosts);
        }
      }

      if (freightOptions.length === 0) {
        console.error('=== NENHUMA OPÇÃO DE FRETE ENCONTRADA ===');
        throw new Error('Não foi possível obter custos reais de frete da API do Mercado Livre');
      }

      // Filter and select best option
      const validOptions = FreightCalculator.filterValidOptions(freightOptions);

      if (validOptions.length === 0) {
        console.error('=== TODAS AS OPÇÕES FORAM FILTRADAS ===');
        throw new Error('Todas as opções de frete retornaram valores inválidos');
      }

      const selectedOption = FreightCalculator.selectBestOption(validOptions);

      console.log('=== OPÇÃO FINAL SELECIONADA ===');
      console.log('Método:', selectedOption.method);
      console.log('Preço Cliente:', selectedOption.price);
      console.log('Custo Vendedor:', selectedOption.sellerCost);
      console.log('Custo Comprador:', selectedOption.buyerCost);
      console.log('Pago por:', selectedOption.paidBy);
      console.log('Fonte:', selectedOption.source);
      console.log('É Mercado Envios Padrão:', selectedOption.isMercadoEnviosPadrao);
      console.log('Método de Cálculo:', selectedOption.calculationMethod);

      const response: FreightCalculationResponse = {
        freightOptions: validOptions,
        selectedOption: selectedOption,
        zipCode,
        productId,
        hasRealCosts: true,
        apiSource: selectedOption.source,
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
    console.error('Erro:', error.message);
    console.error('Stack:', error.stack);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
