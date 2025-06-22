
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
    console.log('🔍 Iniciando teste completo da API Mercado Livre...');
    
    let requestBody;
    try {
      requestBody = await req.json();
      console.log('📝 Request body received:', JSON.stringify(requestBody));
    } catch (error) {
      console.error('❌ Erro ao fazer parse do JSON:', error);
      throw new Error('Body da requisição inválido');
    }

    const { productId, zipCode, accessToken, testType = 'all_options' } = requestBody;
    
    if (!productId) {
      throw new Error('Product ID é obrigatório');
    }

    if (!accessToken) {
      throw new Error('Token de acesso é obrigatório');
    }

    const productIdToTest = productId.trim();
    console.log(`📦 Product ID: ${productIdToTest}`);
    console.log(`🧪 Tipo de teste: ${testType}`);

    const results: any = {
      success: true,
      productId: productIdToTest,
      testType,
      allResults: {}
    };

    // 1. Testar endpoint de opções normais (com CEP se fornecido)
    if (zipCode && zipCode.trim().length > 0) {
      const zipCodeToTest = zipCode.trim().replace(/\D/g, '');
      console.log(`📍 CEP: ${zipCodeToTest}`);
      
      console.log('🚚 === TESTANDO ENDPOINT SHIPPING_OPTIONS ===');
      const shippingUrl = `https://api.mercadolibre.com/items/${productIdToTest}/shipping_options?zip_code=${zipCodeToTest}&include_dimensions=true`;
      
      try {
        const response = await fetch(shippingUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'MercadoValor/1.0'
          },
        });

        if (response.ok) {
          const data = await response.json();
          console.log('✅ Shipping Options Response:', JSON.stringify(data, null, 2));
          
          results.allResults.shipping_options = {
            success: true,
            endpoint: `/items/${productIdToTest}/shipping_options`,
            zipCode: zipCodeToTest,
            totalOptions: data.options?.length || 0,
            options: data.options?.map((option: any, index: number) => ({
              index: index + 1,
              name: option.name,
              shippingMethodId: option.shipping_method_id,
              cost: option.cost,
              listCost: option.list_cost,
              baseCost: option.base_cost,
              sellerCost: option.seller_cost,
              currencyId: option.currency_id,
              estimatedDelivery: option.estimated_delivery_time?.date,
              discount: option.discount,
              isFreeForCustomer: option.cost === 0,
              hasLoyalDiscount: option.discount?.type === 'loyal'
            })) || [],
            rawResponse: data
          };
        } else {
          const errorText = await response.text();
          console.log(`⚠️ Shipping Options Error: ${response.status} - ${errorText}`);
          results.allResults.shipping_options = {
            success: false,
            error: `${response.status} - ${errorText}`,
            endpoint: `/items/${productIdToTest}/shipping_options`
          };
        }
      } catch (error: any) {
        console.error('❌ Erro no shipping_options:', error);
        results.allResults.shipping_options = {
          success: false,
          error: error.message,
          endpoint: `/items/${productIdToTest}/shipping_options`
        };
      }
    }

    // 2. Testar endpoint de frete grátis oficial (/free)
    console.log('🆓 === TESTANDO ENDPOINT FREE SHIPPING ===');
    const freeShippingUrl = `https://api.mercadolibre.com/items/${productIdToTest}/shipping_options/free`;
    
    try {
      const freeResponse = await fetch(freeShippingUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'MercadoValor/1.0'
        },
      });

      if (freeResponse.ok) {
        const freeData = await freeResponse.json();
        console.log('✅ Free Shipping Response:', JSON.stringify(freeData, null, 2));
        
        // Processar resposta do endpoint /free
        let freeShippingInfo = null;
        
        // Verificar se há cobertura para todo o país
        if (freeData.coverage?.all_country) {
          const allCountry = freeData.coverage.all_country;
          freeShippingInfo = {
            hasNationalCoverage: true,
            listCost: allCountry.list_cost, // Custo oferecido ao vendedor
            currencyId: allCountry.currency_id,
            logisticType: allCountry.logistic_type,
            shippingMethodId: allCountry.shipping_method_id
          };
          console.log(`💰 Custo nacional para vendedor: ${allCountry.currency_id} ${allCountry.list_cost}`);
        }

        // Verificar cobertura por áreas específicas
        const areasCoverage = [];
        if (freeData.coverage?.areas && Array.isArray(freeData.coverage.areas)) {
          for (const area of freeData.coverage.areas) {
            areasCoverage.push({
              areaId: area.area_id,
              listCost: area.list_cost,
              currencyId: area.currency_id,
              logisticType: area.logistic_type,
              shippingMethodId: area.shipping_method_id
            });
          }
        }

        results.allResults.free_shipping = {
          success: true,
          endpoint: `/items/${productIdToTest}/shipping_options/free`,
          freeShippingInfo,
          areasCoverage,
          totalAreas: areasCoverage.length,
          rawResponse: freeData
        };

      } else {
        const freeErrorText = await freeResponse.text();
        console.log(`⚠️ Free Shipping Error: ${freeResponse.status} - ${freeErrorText}`);
        results.allResults.free_shipping = {
          success: false,
          error: `${freeResponse.status} - ${freeErrorText}`,
          endpoint: `/items/${productIdToTest}/shipping_options/free`
        };
      }
    } catch (error: any) {
      console.error('❌ Erro no free shipping:', error);
      results.allResults.free_shipping = {
        success: false,
        error: error.message,
        endpoint: `/items/${productIdToTest}/shipping_options/free`
      };
    }

    // 3. Testar endpoint básico sem CEP
    console.log('📋 === TESTANDO ENDPOINT BÁSICO (SEM CEP) ===');
    const basicUrl = `https://api.mercadolivre.com/items/${productIdToTest}/shipping_options`;
    
    try {
      const basicResponse = await fetch(basicUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'MercadoValor/1.0'
        },
      });

      if (basicResponse.ok) {
        const basicData = await basicResponse.json();
        console.log('✅ Basic Shipping Response:', JSON.stringify(basicData, null, 2));
        
        results.allResults.basic_shipping = {
          success: true,
          endpoint: `/items/${productIdToTest}/shipping_options`,
          totalOptions: basicData.options?.length || 0,
          options: basicData.options?.map((option: any, index: number) => ({
            index: index + 1,
            name: option.name,
            shippingMethodId: option.shipping_method_id,
            cost: option.cost,
            listCost: option.list_cost,
            baseCost: option.base_cost,
            sellerCost: option.seller_cost,
            currencyId: option.currency_id,
            estimatedDelivery: option.estimated_delivery_time?.date,
            discount: option.discount
          })) || [],
          rawResponse: basicData
        };
      } else {
        const basicErrorText = await basicResponse.text();
        console.log(`⚠️ Basic Shipping Error: ${basicResponse.status} - ${basicErrorText}`);
        results.allResults.basic_shipping = {
          success: false,
          error: `${basicResponse.status} - ${basicErrorText}`,
          endpoint: `/items/${productIdToTest}/shipping_options`
        };
      }
    } catch (error: any) {
      console.error('❌ Erro no basic shipping:', error);
      results.allResults.basic_shipping = {
        success: false,
        error: error.message,
        endpoint: `/items/${productIdToTest}/shipping_options`
      };
    }

    // 4. Buscar informações do produto primeiro para obter USER_ID
    console.log('📦 === BUSCANDO INFORMAÇÕES DO PRODUTO ===');
    let userId = null;
    try {
      const productResponse = await fetch(`https://api.mercadolibre.com/items/${productIdToTest}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'MercadoValor/1.0'
        },
      });

      if (productResponse.ok) {
        const productData = await productResponse.json();
        console.log('✅ Product Info:', productData.title);
        console.log('📦 Free Shipping declarado:', productData.shipping?.free_shipping);
        userId = productData.seller_id;
        console.log('👤 User ID do vendedor:', userId);
        
        results.allResults.product_info = {
          success: true,
          title: productData.title,
          price: productData.price,
          currencyId: productData.currency_id,
          condition: productData.condition,
          freeShippingDeclared: productData.shipping?.free_shipping || false,
          shippingProfile: productData.shipping,
          sellerId: productData.seller_id
        };
      } else {
        const productErrorText = await productResponse.text();
        console.log(`⚠️ Product Info Error: ${productResponse.status} - ${productErrorText}`);
        results.allResults.product_info = {
          success: false,
          error: `${productResponse.status} - ${productErrorText}`
        };
      }
    } catch (error: any) {
      console.error('❌ Erro nas informações do produto:', error);
      results.allResults.product_info = {
        success: false,
        error: error.message
      };
    }

    // 5. NOVO: Testar endpoint de frete grátis do usuário
    if (userId) {
      console.log('👤 === TESTANDO ENDPOINT USER FREE SHIPPING ===');
      
      // Buscar informações básicas do produto para os parâmetros
      const productInfo = results.allResults.product_info;
      
      // Construir URL com parâmetros básicos
      const userFreeUrl = `https://api.mercadolibre.com/users/${userId}/shipping_options/free?item_price=${productInfo?.price || 100}&condition=${productInfo?.condition || 'new'}&verbose=true`;
      
      try {
        const userFreeResponse = await fetch(userFreeUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'User-Agent': 'MercadoValor/1.0'
          },
        });

        if (userFreeResponse.ok) {
          const userFreeData = await userFreeResponse.json();
          console.log('✅ User Free Shipping Response:', JSON.stringify(userFreeData, null, 2));
          
          // Processar opções de frete grátis do usuário
          let userFreeOptions = [];
          if (userFreeData.options && Array.isArray(userFreeData.options)) {
            userFreeOptions = userFreeData.options.map((option: any, index: number) => ({
              index: index + 1,
              name: option.name || 'N/A',
              shippingMethodId: option.shipping_method_id,
              cost: option.cost || 0,
              listCost: option.list_cost || 0,
              currencyId: option.currency_id || 'BRL',
              logisticType: option.logistic_type,
              estimatedDelivery: option.estimated_delivery_time?.date,
              coverage: option.coverage
            }));
          }

          results.allResults.user_free_shipping = {
            success: true,
            endpoint: `/users/${userId}/shipping_options/free`,
            userId: userId,
            totalOptions: userFreeOptions.length,
            options: userFreeOptions,
            rawResponse: userFreeData
          };

        } else {
          const userFreeErrorText = await userFreeResponse.text();
          console.log(`⚠️ User Free Shipping Error: ${userFreeResponse.status} - ${userFreeErrorText}`);
          results.allResults.user_free_shipping = {
            success: false,
            error: `${userFreeResponse.status} - ${userFreeErrorText}`,
            endpoint: `/users/${userId}/shipping_options/free`,
            userId: userId
          };
        }
      } catch (error: any) {
        console.error('❌ Erro no user free shipping:', error);
        results.allResults.user_free_shipping = {
          success: false,
          error: error.message,
          endpoint: `/users/${userId}/shipping_options/free`,
          userId: userId
        };
      }
    } else {
      console.log('⚠️ Não foi possível obter USER_ID, pulando teste do endpoint /users/.../shipping_options/free');
      results.allResults.user_free_shipping = {
        success: false,
        error: 'USER_ID não disponível',
        endpoint: '/users/{USER_ID}/shipping_options/free'
      };
    }

    // 6. Gerar resumo consolidado
    console.log('📊 === GERANDO RESUMO CONSOLIDADO ===');
    const summary = {
      totalEndpointsTested: Object.keys(results.allResults).length,
      successfulEndpoints: Object.values(results.allResults).filter((r: any) => r.success).length,
      hasProductInfo: results.allResults.product_info?.success || false,
      hasFreeShippingEndpoint: results.allResults.free_shipping?.success || false,
      hasUserFreeShippingEndpoint: results.allResults.user_free_shipping?.success || false,
      hasShippingOptions: results.allResults.shipping_options?.success || false,
      hasBasicShipping: results.allResults.basic_shipping?.success || false,
      
      // Informações consolidadas de frete grátis
      freeShippingAnalysis: {
        productDeclaresFreeShipping: results.allResults.product_info?.freeShippingDeclared || false,
        freeEndpointAvailable: results.allResults.free_shipping?.success || false,
        userFreeEndpointAvailable: results.allResults.user_free_shipping?.success || false,
        nationalCoverageCost: results.allResults.free_shipping?.freeShippingInfo?.listCost || null,
        areasWithFreeCoverage: results.allResults.free_shipping?.totalAreas || 0,
        userFreeOptions: results.allResults.user_free_shipping?.totalOptions || 0
      }
    };

    results.summary = summary;

    console.log('✅ === TESTE COMPLETO FINALIZADO ===');
    console.log(`📊 Endpoints testados: ${summary.totalEndpointsTested}`);
    console.log(`✅ Sucessos: ${summary.successfulEndpoints}`);
    console.log(`🆓 Frete grátis (item) disponível: ${summary.freeShippingAnalysis.freeEndpointAvailable ? 'Sim' : 'Não'}`);
    console.log(`👤 Frete grátis (usuário) disponível: ${summary.freeShippingAnalysis.userFreeEndpointAvailable ? 'Sim' : 'Não'}`);
    if (summary.freeShippingAnalysis.nationalCoverageCost) {
      console.log(`💰 Custo nacional vendedor: R$ ${summary.freeShippingAnalysis.nationalCoverageCost}`);
    }

    return new Response(
      JSON.stringify(results),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error: any) {
    console.error('❌ Erro no teste completo:', error.message);
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
