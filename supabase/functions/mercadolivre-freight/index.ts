
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

      // Get product details first to get shipping information
      const productResponse = await fetch(`https://api.mercadolibre.com/items/${productId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!productResponse.ok) {
        throw new Error(`Falha ao buscar produto: ${productResponse.status}`)
      }

      const product = await productResponse.json()
      console.log('Product shipping info:', product.shipping)

      // Get shipping options for the product
      const shippingResponse = await fetch(`https://api.mercadolibre.com/items/${productId}/shipping_options?zip_code=${zipCode}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!shippingResponse.ok) {
        console.log('Shipping options request failed, trying alternative method')
        
        // Alternative: use the shipping calculator endpoint
        const calcResponse = await fetch(`https://api.mercadolibre.com/sites/MLB/shipping_preferences/calculate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            dimensions: product.shipping?.dimensions || "10x10x10,100",
            zip_code_from: product.seller_address?.zip_code || "01310100",
            zip_code_to: zipCode,
            category_id: product.category_id,
            listing_type_id: product.listing_type_id,
            quantity: 1
          })
        })

        if (!calcResponse.ok) {
          // If all else fails, provide a basic calculation based on free shipping status
          const baseFreight = product.shipping?.free_shipping ? 0 : 25.00
          
          return new Response(
            JSON.stringify({ 
              freightOptions: [{
                method: product.shipping?.free_shipping ? 'Frete Grátis' : 'Frete Padrão',
                carrier: 'Mercado Livre',
                price: baseFreight,
                deliveryTime: '5-7 dias úteis'
              }],
              zipCode,
              productId,
              fallback: true
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        const calcData = await calcResponse.json()
        console.log('Shipping calculation result:', calcData)

        const freightOptions = calcData.options?.map((option: any) => ({
          method: option.name || 'Frete Padrão',
          carrier: option.shipping_method_id || 'Mercado Livre',
          price: option.cost || 25.00,
          deliveryTime: option.estimated_delivery_time || 'Não informado'
        })) || [{
          method: 'Frete Padrão',
          carrier: 'Mercado Livre',
          price: 25.00,
          deliveryTime: '5-7 dias úteis'
        }]

        return new Response(
          JSON.stringify({ 
            freightOptions,
            zipCode,
            productId
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const shippingData = await shippingResponse.json()
      console.log('Shipping options:', shippingData)

      // Transform shipping options data
      const freightOptions = shippingData.options?.map((option: any) => ({
        method: option.name || 'Frete Padrão',
        carrier: option.shipping_method_id || 'Mercado Livre',
        price: option.cost || (product.shipping?.free_shipping ? 0 : 25.00),
        deliveryTime: option.estimated_delivery_time || 'Não informado'
      })) || [{
        method: product.shipping?.free_shipping ? 'Frete Grátis' : 'Frete Padrão',
        carrier: 'Mercado Livre',
        price: product.shipping?.free_shipping ? 0 : 25.00,
        deliveryTime: '5-7 dias úteis'
      }]

      return new Response(
        JSON.stringify({ 
          freightOptions,
          zipCode,
          productId
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
