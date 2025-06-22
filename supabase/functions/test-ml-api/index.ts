
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
    let processedResult = {};

    // Definir URL baseada no tipo de teste
    if (testType === 'shipping_options_free') {
      // Primeiro tentar o endpoint oficial /free
      apiUrl = `https://api.mercadolibre.com/items/${productIdToTest}/shipping_options/free`;
      testDescription = 'Free Shipping Options (Endpoint Oficial /free)';
      console.log(`🆓 Testando endpoint oficial /free: ${apiUrl}`);
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
      console.error(`❌ Erro da API ML (${response.status}): ${errorText}`);
      
      // Se for endpoint /free e der erro, tentar método alternativo
      if (testType === 'shipping_options_free' && response.status === 404) {
        console.log('🔄 Endpoint /free não disponível, tentando método alternativo...');
        
        // Usar shipping_options normal e filtrar opções grátis
        const fallbackUrl = `https://api.mercadolibre.com/items/${productIdToTest}/shipping_options`;
        console.log(`🔄 Tentando URL alternativa: ${fallbackUrl}`);
        
        const fallbackResponse = await fetch(fallbackUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'MercadoValor/1.0'
          },
        });
        
        if (!fallbackResponse.ok) {
          const fallbackErrorText = await fallbackResponse.text();
          throw new Error(`API Error (fallback): ${fallbackResponse.status} - ${fallbackErrorText}`);
        }
        
        const fallbackData = await fallbackResponse.json();
        console.log('✅ Resposta do método alternativo:', JSON.stringify(fallbackData, null, 2));
        
        // Processar método alternativo para encontrar frete grátis
        return await processFreeShippingAlternative(fallbackData, productIdToTest, testDescription);
      }
      
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('✅ Resposta recebida da API:', JSON.stringify(data, null, 2));

    if (testType === 'shipping_options_free') {
      // Processar resposta do endpoint oficial /free
      console.log(`📊 Processando resposta do endpoint /free`);
      
      let freeShippingCost = 0;
      let currency = 'BRL';
      let hasFreeCoverage = false;
      let freeShippingDetails = null;
      let totalOptions = 0;
      
      // Verificar diferentes formatos de resposta possíveis
      let optionsArray = [];
      
      if (Array.isArray(data)) {
        optionsArray = data;
      } else if (data && data.options && Array.isArray(data.options)) {
        optionsArray = data.options;
      } else if (data && data.shipping_options && Array.isArray(data.shipping_options)) {
        optionsArray = data.shipping_options;
      }
      
      if (optionsArray.length > 0) {
        totalOptions = optionsArray.length;
        console.log(`🔍 Encontradas ${totalOptions} opções de frete grátis no endpoint /free`);
        
        // Pegar a primeira opção disponível
        const firstOption = optionsArray[0];
        hasFreeCoverage = true;
        
        // Extrair custos conforme estrutura da API /free
        freeShippingCost = firstOption.cost || firstOption.list_cost || firstOption.base_cost || 0;
        currency = firstOption.currency_id || 'BRL';
        
        freeShippingDetails = {
          method: firstOption.name || 'Frete Grátis',
          shipping_method_id: firstOption.shipping_method_id,
          cost: firstOption.cost,
          list_cost: firstOption.list_cost,
          base_cost: firstOption.base_cost,
          estimated_delivery: firstOption.estimated_delivery_time?.date,
          coverage_areas: firstOption.coverage_areas || []
        };

        console.log(`💰 Custo do frete grátis (endpoint /free): ${currency} ${freeShippingCost}`);
      } else {
        console.log('📊 Nenhuma opção de frete grátis encontrada no endpoint /free');
      }
      
      processedResult = {
        hasFreeShipping: hasFreeCoverage,
        freeShippingDetails,
        summary: {
          freeShippingCost: freeShippingCost,
          currency: currency,
          hasFreeCoverage: hasFreeCoverage,
          totalOptions: totalOptions,
          endpoint: '/free'
        }
      };
      
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
      zipCode: testType === 'shipping_options' ? zipCode?.trim() : null,
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

// Função auxiliar para processar método alternativo
async function processFreeShippingAlternative(data: any, productId: string, testDescription: string) {
  console.log('📊 Processando método alternativo para frete grátis');
  
  let freeShippingCost = 0;
  let currency = 'BRL';
  let hasFreeCoverage = false;
  let freeShippingDetails = null;
  let totalFreeOptions = 0;
  
  if (data && data.options && Array.isArray(data.options)) {
    // Procurar por opções que indicam frete grátis
    const freeOptions = data.options.filter((option: any) => {
      return option.cost === 0 || 
             (option.discount && option.discount.rate === 1 && option.discount.type === 'loyal');
    });

    totalFreeOptions = freeOptions.length;
    console.log(`🔍 Encontradas ${totalFreeOptions} opções de frete grátis (método alternativo)`);

    if (freeOptions.length > 0) {
      hasFreeCoverage = true;
      const firstFreeOption = freeOptions[0];
      
      // O custo real pode estar em diferentes campos
      freeShippingCost = firstFreeOption.base_cost || 
                        firstFreeOption.list_cost || 
                        firstFreeOption.seller_cost || 0;
      
      currency = firstFreeOption.currency_id || 'BRL';
      
      freeShippingDetails = {
        method: firstFreeOption.name,
        shipping_method_id: firstFreeOption.shipping_method_id,
        cost: firstFreeOption.cost,
        list_cost: firstFreeOption.list_cost,
        base_cost: firstFreeOption.base_cost,
        estimated_delivery: firstFreeOption.estimated_delivery_time?.date,
        discount: firstFreeOption.discount
      };

      console.log(`💰 Custo real do frete grátis (método alternativo): ${currency} ${freeShippingCost}`);
    }
  }
  
  const result = {
    success: true,
    testType: 'shipping_options_free',
    testDescription: testDescription + ' (Método Alternativo)',
    productId: productId,
    zipCode: null,
    hasFreeShipping: hasFreeCoverage,
    freeShippingDetails,
    summary: {
      freeShippingCost: freeShippingCost,
      currency: currency,
      hasFreeCoverage: hasFreeCoverage,
      totalOptions: totalFreeOptions,
      endpoint: 'alternativo'
    },
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
}
