
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
        console.log('Full shipping options response:', JSON.stringify(customerShippingData, null, 2))

        if (customerShippingData?.options && customerShippingData.options.length > 0) {
          freightOptions = customerShippingData.options.map((option: any) => {
            console.log('Processing shipping option:', JSON.stringify(option, null, 2))
            
            // Use the base_cost directly as the real seller cost
            const realSellerCost = option.base_cost || option.cost || 0

            return {
              method: option.name || 'Mercado Envios',
              carrier: option.shipping_method_id || 'Mercado Envios',
              price: option.cost || 0, // What customer pays
              sellerCost: realSellerCost, // What seller actually pays (base_cost)
              deliveryTime: option.estimated_delivery_time?.date || '3-7 dias úteis',
              isFreeShipping: option.cost === 0,
              source: 'api_real_cost',
              rawOption: option // Keep raw data for debugging
            }
          })
        }
      } else {
        console.error('Failed to get shipping options:', customerShippingResponse.status, await customerShippingResponse.text())
      }

      // Try alternative API endpoint if first one failed
      if (freightOptions.length === 0) {
        console.log('Trying alternative shipping calculation method...')
        
        const alternativeResponse = await fetch(`https://api.mercadolibre.com/sites/MLB/shipping_costs?dimensions=20x20x20,1000&zip_code_from=01310100&zip_code_to=${zipCode}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        if (alternativeResponse.ok) {
          const alternativeData = await alternativeResponse.json()
          console.log('Alternative shipping data:', JSON.stringify(alternativeData, null, 2))
          
          if (alternativeData?.costs && alternativeData.costs.length > 0) {
            freightOptions = alternativeData.costs.map((cost: any) => ({
              method: cost.method || 'Mercado Envios',
              carrier: cost.method || 'Mercado Envios',
              price: cost.cost || 0,
              sellerCost: cost.cost || 0, // In this case, seller pays the same
              deliveryTime: '3-7 dias úteis',
              isFreeShipping: false,
              source: 'alternative_api'
            }))
          }
        }
      }

      // Only use manual calculation as absolute last resort
      if (freightOptions.length === 0) {
        console.log('No shipping options found, calculating based on product weight/dimensions')
        
        // Calculate based on product attributes
        const weight = product.attributes?.find((attr: any) => attr.id === 'WEIGHT')?.value_name
        const dimensions = {
          length: product.attributes?.find((attr: any) => attr.id === 'LENGTH')?.value_name,
          width: product.attributes?.find((attr: any) => attr.id === 'WIDTH')?.value_name,
          height: product.attributes?.find((attr: any) => attr.id === 'HEIGHT')?.value_name
        }
        
        console.log('Product weight:', weight, 'Dimensions:', dimensions)
        
        // Basic freight calculation based on weight (in grams) and distance
        let calculatedCost = 8.50 // Base cost
        
        if (weight) {
          const weightInKg = parseFloat(weight.replace(/[^\d.]/g, '')) / 1000
          if (weightInKg > 1) {
            calculatedCost += (weightInKg - 1) * 2.50 // Additional cost per kg
          }
        }
        
        // Add dimension-based cost
        if (dimensions.length || dimensions.width || dimensions.height) {
          calculatedCost += 3.00 // Additional dimensional cost
        }
        
        // Round to nearest 0.50
        calculatedCost = Math.ceil(calculatedCost * 2) / 2
        
        freightOptions = [{
          method: product.shipping?.free_shipping ? 'Frete Grátis' : 'Frete Calculado',
          carrier: 'Mercado Envios',
          price: product.shipping?.free_shipping ? 0 : calculatedCost,
          sellerCost: calculatedCost,
          deliveryTime: '3-7 dias úteis',
          isFreeShipping: product.shipping?.free_shipping || false,
          source: 'calculated',
          calculation: {
            baseCost: 8.50,
            weight: weight,
            dimensions: dimensions,
            finalCost: calculatedCost
          }
        }]
      }

      console.log('Final freight options:', JSON.stringify(freightOptions, null, 2))

      return new Response(
        JSON.stringify({ 
          freightOptions,
          zipCode,
          productId,
          hasRealCosts: freightOptions.length > 0 && freightOptions[0].source === 'api_real_cost',
          sellerInfo: product.seller_id,
          productData: {
            title: product.title,
            price: product.price,
            freeShipping: product.shipping?.free_shipping
          }
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
