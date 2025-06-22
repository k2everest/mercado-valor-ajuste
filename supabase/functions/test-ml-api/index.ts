
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

    const { productId, zipCode, accessToken, testType = 'shipping_options' } = requestBody;
    
    if (!productId) {
      throw new Error('Product ID é obrigatório');
    }

    if (!accessToken) {
      throw new Error('Token de acesso é obrigatório');
    }

    const productIdToTest = productId.trim();
    
    console.log(`📦 Product ID: ${productIdToTest}`);
    console.log(`🧪 Tipo de teste: ${testType}`);

    let apiUrl = '';
    let testDescription = '';

    // Definir URL baseada no tipo de teste
    if (testType === 'shipping_options_free') {
      apiUrl = `https://api.mercadolibre.com/items/${productIdToTest}/free`;
      testDescription = 'Free Shipping Cost (Custo do Frete Grátis)';
      console.log(`🆓 Testando endpoint de frete grátis: ${apiUrl}`);
    } else {
      // Teste padrão de shipping_options com CEP
      if (!zipCode || zipCode.trim().length === 0) {
        throw new Error('CEP é obrigatório para este tipo de teste');
      }
      
      const zipCodeToTest = zipCode.trim().replace(/\D/g, '');
      console.log(`📍 CEP: ${zipCodeToTest}`);
      
      apiUrl = `https://api.mercadolibre.com/items/${productIdToTest}/shipping_options?zip_code=${zipCodeToTest}&include_dimensions=true`;
      testDescription = 'Shipping Options com CEP';
    }

    console.log(`🌐 Fazendo chamada para: ${apiUrl}`);
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'MercadoValor/1.0'
      },
    });

    console.log(`📡 Response status: ${response.status}`);
    console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Erro da API ML: ${response.status} - ${errorText}`);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Resposta recebida da API:', JSON.stringify(data, null, 2));

    let processedResult = {};

    if (testType === 'shipping_options_free') {
      // Processar resposta do endpoint /free
      console.log(`📊 Processando dados de frete grátis`);
      
      let freeShippingCost = 0;
      let currency = 'BRL';
      let hasFreeCoverage = false;
      
      // Diferentes estruturas possíveis de resposta
      if (data !== null && data !== undefined) {
        if (typeof data === 'number') {
          // Retorna apenas o valor numérico
          freeShippingCost = data;
          hasFreeCoverage = true;
          console.log('📊 Estrutura: valor numérico direto');
        } else if (data.list_cost !== undefined) {
          // Estrutura com list_cost direto
          freeShippingCost = data.list_cost;
          currency = data.currency_id || 'BRL';
          hasFreeCoverage = true;
          console.log('📊 Estrutura: objeto com list_cost');
        } else if (data.coverage && data.coverage.all_country && data.coverage.all_country.list_cost !== undefined) {
          // Estrutura com coverage
          freeShippingCost = data.coverage.all_country.list_cost;
          currency = data.coverage.all_country.currency_id || 'BRL';
          hasFreeCoverage = true;
          console.log('📊 Estrutura: objeto com coverage');
        } else {
          console.log('📊 Estrutura desconhecida ou sem dados de frete grátis');
        }
      }
      
      processedResult = {
        hasFreeShipping: hasFreeCoverage,
        freeShippingData: data,
        summary: {
          freeShippingCost: freeShippingCost,
          currency: currency,
          hasFreeCoverage: hasFreeCoverage
        }
      };
      
      console.log(`💰 Custo do frete grátis: ${currency} ${freeShippingCost}`);
      
    } else {
      // Processar resposta padrão de shipping_options
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

      processedResult = {
        summary: {
          totalOptions: data.options?.length || 0,
          hasLoyalDiscount: processedOptions.some((opt: any) => opt.hasLoyalDiscount),
          optionsWithBaseCost: processedOptions.filter((opt: any) => opt.baseCost > 0).length,
          freeShippingOptions: processedOptions.filter((opt: any) => opt.cost === 0).length
        },
        processedOptions
      };
      
      console.log(`📊 Resumo: ${processedResult.summary.totalOptions} opções, ${processedResult.summary.freeShippingOptions} gratuitas`);
    }

    const result = {
      success: true,
      testType,
      testDescription,
      productId: productIdToTest,
      zipCode: testType === 'shipping_options' ? zipCode.trim() : null,
      ...processedResult,
      rawApiResponse: data
    };

    console.log('✅ Teste concluído com sucesso');

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
