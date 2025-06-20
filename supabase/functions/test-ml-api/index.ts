
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  console.log(`🔍 Request method: ${req.method}`);
  console.log(`🔍 Request URL: ${req.url}`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ Handling CORS preflight request');
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔍 Iniciando teste da API Mercado Livre...');
    
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📝 Request body received:', JSON.stringify(requestBody));
    } catch (error) {
      console.error('❌ Erro ao fazer parse do JSON:', error);
      throw new Error('Body da requisição inválido');
    }

    const { productId, zipCode, accessToken } = requestBody;
    
    if (!productId || !zipCode) {
      throw new Error('Product ID e CEP são obrigatórios');
    }

    if (!accessToken) {
      throw new Error('Token de acesso é obrigatório');
    }

    const productIdToTest = productId.trim();
    const zipCodeToTest = zipCode.trim().replace(/\D/g, '');
    
    console.log(`📦 Product ID: ${productIdToTest}`);
    console.log(`📍 CEP: ${zipCodeToTest}`);

    // Chamada única à API de shipping options
    const shippingUrl = `https://api.mercadolibre.com/items/${productIdToTest}/shipping_options?zip_code=${zipCodeToTest}&include_dimensions=true`;
    console.log(`🌐 Fazendo chamada para: ${shippingUrl}`);
    
    const response = await fetch(shippingUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MercadoValor/1.0'
      },
    });

    console.log(`📡 Response status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro da API ML: ${response.status} - ${errorText}`);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Resposta recebida da API');
    console.log(`📊 Total de opções encontradas: ${data.options?.length || 0}`);

    // Processar e analisar as opções
    const processedOptions = data.options?.map((option: any, index: number) => {
      const hasDiscount = option.discount?.type === 'loyal';
      const discountRate = option.discount?.rate || 0;
      const promotedAmount = option.discount?.promoted_amount || 0;
      
      return {
        index: index + 1,
        name: option.name,
        shippingMethodId: option.shipping_method_id,
        cost: option.cost,
        baseCost: option.base_cost,
        listCost: option.list_cost,
        sellerCost: option.seller_cost,
        hasLoyalDiscount: hasDiscount,
        discountRate: discountRate,
        promotedAmount: promotedAmount,
        estimatedDelivery: option.estimated_delivery_time?.date
      };
    }) || [];

    const summary = {
      totalOptions: data.options?.length || 0,
      hasLoyalDiscount: processedOptions.some((opt: any) => opt.hasLoyalDiscount),
      optionsWithBaseCost: processedOptions.filter((opt: any) => opt.baseCost > 0).length,
      freeShippingOptions: processedOptions.filter((opt: any) => opt.cost === 0).length
    };

    console.log(`📊 Resumo: ${summary.totalOptions} opções, ${summary.freeShippingOptions} gratuitas`);

    const result = {
      success: true,
      productId: productIdToTest,
      zipCode: zipCodeToTest,
      summary,
      processedOptions,
      rawApiResponse: data
    };

    return new Response(
      JSON.stringify(result),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro no teste da API:', error.message);
    console.error('❌ Stack trace:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro interno do servidor',
        details: error.stack || 'Stack trace não disponível'
      }),
      { 
        status: 500, 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});
