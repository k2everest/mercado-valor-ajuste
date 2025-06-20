
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { productId, zipCode, accessToken } = await req.json();
    
    const productIdToTest = productId || '690488868';
    const zipCodeToTest = zipCode || '01310-100';
    
    console.log('=== TESTE DIRETO DA API MERCADO LIVRE ===');
    console.log('Product ID:', productIdToTest);
    console.log('CEP:', zipCodeToTest);
    
    if (!accessToken) {
      throw new Error('Token de acesso é obrigatório');
    }

    // Chamada direta à API de shipping options
    const shippingUrl = `https://api.mercadolibre.com/items/${productIdToTest}/shipping_options?zip_code=${zipCodeToTest}&include_dimensions=true`;
    console.log('URL completa:', shippingUrl);
    
    const response = await fetch(shippingUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro da API:', response.status, errorText);
      throw new Error(`API Error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('=== RESPOSTA COMPLETA DA API ===');
    console.log(JSON.stringify(data, null, 2));

    // Analisar cada opção de frete
    if (data.options && data.options.length > 0) {
      console.log('=== ANÁLISE DETALHADA DAS OPÇÕES ===');
      data.options.forEach((option: any, index: number) => {
        console.log(`\n--- OPÇÃO ${index + 1} ---`);
        console.log('Nome:', option.name);
        console.log('Shipping Method ID:', option.shipping_method_id);
        console.log('Cost (cliente paga):', option.cost);
        console.log('Base Cost:', option.base_cost);
        console.log('List Cost:', option.list_cost);
        console.log('Seller Cost:', option.seller_cost);
        console.log('Discount:', JSON.stringify(option.discount, null, 2));
        console.log('Estimated Delivery:', option.estimated_delivery_time);
        
        // Cálculo manual do desconto
        if (option.discount && option.discount.type === 'loyal') {
          const baseCost = Number(option.base_cost) || 0;
          const discountRate = Number(option.discount.rate) || 0;
          const promotedAmount = Number(option.discount.promoted_amount) || 0;
          
          console.log('--- CÁLCULO DE DESCONTO ---');
          console.log('Base Cost original:', baseCost);
          console.log('Taxa de desconto (%):', discountRate);
          console.log('Promoted Amount:', promotedAmount);
          
          if (discountRate > 0) {
            const calculatedDiscount = baseCost * (discountRate / 100);
            const finalCost = baseCost - calculatedDiscount;
            console.log(`Desconto calculado (${discountRate}%):`, calculatedDiscount);
            console.log('Custo final para vendedor:', finalCost);
          }
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        productId: productIdToTest,
        zipCode: zipCodeToTest,
        rawApiResponse: data,
        summary: {
          totalOptions: data.options?.length || 0,
          hasLoyalDiscount: data.options?.some((opt: any) => opt.discount?.type === 'loyal') || false,
          optionsWithBaseCost: data.options?.filter((opt: any) => opt.base_cost > 0).length || 0
        }
      }, null, 2),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('=== ERRO NO TESTE DA API ===');
    console.error('Erro:', error.message);
    console.error('Stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro interno do servidor',
        stack: error.stack
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
