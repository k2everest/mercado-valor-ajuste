
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

      // Try to get seller's shipping preferences first
      const userResponse = await fetch('https://api.mercadolibre.com/users/me', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      let sellerInfo = null
      if (userResponse.ok) {
        sellerInfo = await userResponse.json()
        console.log('Seller info:', sellerInfo)
      }

      // Get seller's shipping preferences to understand their cost structure
      const shippingPrefsResponse = await fetch(`https://api.mercadolibre.com/users/${product.seller_id}/shipping_preferences`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      let sellerShippingPrefs = null
      if (shippingPrefsResponse.ok) {
        sellerShippingPrefs = await shippingPrefsResponse.json()
        console.log('Seller shipping preferences:', sellerShippingPrefs)
      }

      // Try to get actual shipping costs from the seller's perspective
      const sellerShippingResponse = await fetch(`https://api.mercadolibre.com/shipment_preferences`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      let sellerShippingCosts = null
      if (sellerShippingResponse.ok) {
        sellerShippingCosts = await sellerShippingResponse.json()
        console.log('Seller shipping costs:', sellerShippingCosts)
      }

      // Get shipping options for the product (customer view)
      const shippingResponse = await fetch(`https://api.mercadolibre.com/items/${productId}/shipping_options?zip_code=${zipCode}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!shippingResponse.ok) {
        console.log('Shipping options request failed, using fallback calculation')
        
        // Fallback: Use documented seller cost structure
        // According to ML documentation, sellers typically pay:
        // - Standard shipping: ~R$ 15-25 depending on size/weight
        // - Express shipping: ~R$ 25-35
        // - Large items: ~R$ 30-50
        
        const estimatedSellerCost = product.shipping?.dimensions ? 
          (product.shipping.dimensions.includes('large') || 
           parseFloat(product.shipping.dimensions.split(',')[3] || '0') > 1000 ? 35.00 : 25.00) 
          : 25.00

        return new Response(
          JSON.stringify({ 
            freightOptions: [{
              method: product.shipping?.free_shipping ? 'Frete Grátis' : 'Frete Padrão',
              carrier: 'Mercado Envios',
              price: product.shipping?.free_shipping ? 0 : estimatedSellerCost,
              sellerCost: estimatedSellerCost, // Real cost paid by seller
              deliveryTime: '3-7 dias úteis',
              isFreeShipping: product.shipping?.free_shipping || false,
              source: 'estimated'
            }],
            zipCode,
            productId,
            fallback: true
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const shippingData = await shippingResponse.json()
      console.log('Shipping options data:', shippingData)

      // Process shipping options to extract seller costs
      const freightOptions = shippingData.options?.map((option: any) => {
        // For Mercado Envios, try to determine seller cost based on shipping method
        let estimatedSellerCost = 25.00 // Default
        
        // Try to use cost information from seller preferences if available
        if (sellerShippingCosts?.costs) {
          const matchingCost = sellerShippingCosts.costs.find((cost: any) => 
            cost.shipping_method_id === option.shipping_method_id
          )
          if (matchingCost) {
            estimatedSellerCost = matchingCost.cost || estimatedSellerCost
          }
        }
        
        // Adjust based on shipping method type
        if (option.name?.toLowerCase().includes('express') || 
            option.name?.toLowerCase().includes('rápido')) {
          estimatedSellerCost = Math.max(estimatedSellerCost, 30.00)
        }
        
        // For free shipping, seller pays the cost but customer pays 0
        const customerCost = product.shipping?.free_shipping ? 0 : (option.cost || estimatedSellerCost)
        
        return {
          method: option.name || 'Mercado Envios',
          carrier: option.shipping_method_id || 'Mercado Envios',
          price: customerCost, // What customer pays
          sellerCost: estimatedSellerCost, // What seller actually pays
          deliveryTime: option.estimated_delivery_time || '3-7 dias úteis',
          isFreeShipping: product.shipping?.free_shipping || false,
          source: 'api'
        }
      }) || [{
        method: product.shipping?.free_shipping ? 'Frete Grátis' : 'Frete Padrão',
        carrier: 'Mercado Envios',
        price: product.shipping?.free_shipping ? 0 : 25.00,
        sellerCost: 25.00, // Default seller cost
        deliveryTime: '3-7 dias úteis',
        isFreeShipping: product.shipping?.free_shipping || false,
        source: 'default'
      }]

      return new Response(
        JSON.stringify({ 
          freightOptions,
          zipCode,
          productId,
          sellerInfo: sellerInfo?.id || null,
          shippingPreferences: sellerShippingPrefs ? 'available' : 'not_available'
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
