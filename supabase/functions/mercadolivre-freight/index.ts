
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, productId, zipCode, accessToken } = await req.json()
    console.log('Mercado Livre freight request:', { action, productId, zipCode })
    
    if (!accessToken) {
      throw new Error('Token de acesso é obrigatório')
    }

    if (action === 'getShippingCosts') {
      if (!productId || !zipCode) {
        throw new Error('Product ID e CEP são obrigatórios')
      }

      // Get product details first
      const productResponse = await fetch(`https://api.mercadolibre.com/items/${productId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!productResponse.ok) {
        throw new Error(`Falha ao buscar produto: ${productResponse.status}`)
      }

      const product = await productResponse.json()
      console.log('Product data:', product)

      // Get shipping options for customer (this contains the REAL seller costs in base_cost)
      const customerShippingResponse = await fetch(`https://api.mercadolibre.com/items/${productId}/shipping_options?zip_code=${zipCode}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      let freightOptions = []

      if (customerShippingResponse.ok) {
        const customerShippingData = await customerShippingResponse.json()
        console.log('Shipping options data:', customerShippingData)

        if (customerShippingData?.options && customerShippingData.options.length > 0) {
          freightOptions = customerShippingData.options.map((option: any) => {
            // Use the base_cost directly as the real seller cost
            const realSellerCost = option.base_cost || 0

            return {
              method: option.name || 'Mercado Envios',
              carrier: option.shipping_method_id || 'Mercado Envios',
              price: option.cost || 0, // What customer pays
              sellerCost: realSellerCost, // What seller actually pays (base_cost)
              deliveryTime: option.estimated_delivery_time?.date || '3-7 dias úteis',
              isFreeShipping: option.cost === 0,
              source: 'api_real_cost'
            }
          })
        }
      }

      // Only use fallback if no shipping options were found
      if (freightOptions.length === 0) {
        const estimatedCost = product.shipping?.free_shipping ? 15.00 : 12.00
        freightOptions = [{
          method: product.shipping?.free_shipping ? 'Frete Grátis' : 'Frete Padrão',
          carrier: 'Mercado Envios',
          price: product.shipping?.free_shipping ? 0 : estimatedCost,
          sellerCost: estimatedCost,
          deliveryTime: '3-7 dias úteis',
          isFreeShipping: product.shipping?.free_shipping || false,
          source: 'fallback'
        }]
      }

      return new Response(
        JSON.stringify({ 
          freightOptions,
          zipCode,
          productId,
          hasRealCosts: freightOptions.length > 0 && freightOptions[0].source === 'api_real_cost',
          sellerInfo: product.seller_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in mercadolivre-freight:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
