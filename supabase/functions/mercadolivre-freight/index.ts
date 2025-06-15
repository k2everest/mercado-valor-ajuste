
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

      // Get seller's actual shipping costs using the shipments API
      // This endpoint returns the real costs that sellers pay to Mercado Libre
      const sellerShipmentCostsResponse = await fetch(`https://api.mercadolibre.com/shipment_labels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item_id: productId,
          destination: {
            zip_code: zipCode
          },
          dimensions: product.shipping?.dimensions || null,
          shipment_type: 'forward'
        })
      })

      let realSellerCosts = null
      if (sellerShipmentCostsResponse.ok) {
        realSellerCosts = await sellerShipmentCostsResponse.json()
        console.log('Real seller shipping costs:', realSellerCosts)
      }

      // Try the shipments calculator API for seller costs
      const shipmentCalculatorResponse = await fetch(`https://api.mercadolibre.com/shipments/shipment_option`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          item: {
            id: productId,
            seller_id: product.seller_id
          },
          zip_code_from: product.seller_address?.zip_code || null,
          zip_code_to: zipCode,
          list_cost: product.price,
          category_id: product.category_id,
          shipping_mode: product.shipping?.mode || 'me2',
          item_price: product.price,
          free_shipping: product.shipping?.free_shipping || false
        })
      })

      let calculatorCosts = null
      if (shipmentCalculatorResponse.ok) {
        calculatorCosts = await shipmentCalculatorResponse.json()
        console.log('Shipment calculator costs:', calculatorCosts)
      }

      // Get shipping options for customer (this shows what customer pays)
      const customerShippingResponse = await fetch(`https://api.mercadolibre.com/items/${productId}/shipping_options?zip_code=${zipCode}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      let customerShippingData = null
      if (customerShippingResponse.ok) {
        customerShippingData = await customerShippingResponse.json()
        console.log('Customer shipping options:', customerShippingData)
      }

      // Get seller shipping preferences to understand cost structure
      const sellerPrefsResponse = await fetch(`https://api.mercadolibre.com/users/${product.seller_id}/shipping_preferences`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      let sellerPrefs = null
      if (sellerPrefsResponse.ok) {
        sellerPrefs = await sellerPrefsResponse.json()
        console.log('Seller shipping preferences:', sellerPrefs)
      }

      // Process the real costs data
      let freightOptions = []

      if (customerShippingData?.options) {
        freightOptions = customerShippingData.options.map((option: any) => {
          let realSellerCost = option.base_cost || option.cost || 25.00

          // Try to get the real seller cost from calculator if available
          if (calculatorCosts?.shipment_costs) {
            const matchingCost = calculatorCosts.shipment_costs.find((cost: any) => 
              cost.shipping_method_id === option.shipping_method_id
            )
            if (matchingCost) {
              realSellerCost = matchingCost.seller_cost || matchingCost.cost || realSellerCost
            }
          }

          // Try to get from shipment labels API
          if (realSellerCosts?.costs) {
            const labelCost = realSellerCosts.costs.find((cost: any) => 
              cost.shipping_method_id === option.shipping_method_id
            )
            if (labelCost) {
              realSellerCost = labelCost.seller_amount || labelCost.amount || realSellerCost
            }
          }

          // For free shipping, use base_cost as that's what seller actually pays
          if (product.shipping?.free_shipping && option.cost === 0) {
            realSellerCost = option.base_cost || realSellerCost
          }

          return {
            method: option.name || 'Mercado Envios',
            carrier: option.shipping_method_id || 'Mercado Envios',
            price: option.cost || 0, // What customer pays
            sellerCost: realSellerCost, // What seller actually pays
            deliveryTime: option.estimated_delivery_time?.date || '3-7 dias úteis',
            isFreeShipping: product.shipping?.free_shipping || option.cost === 0,
            source: 'api_real_cost'
          }
        })
      } else {
        // Fallback if no shipping options available
        const estimatedCost = product.shipping?.free_shipping ? 25.00 : 15.00
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
          hasRealCosts: Boolean(calculatorCosts || realSellerCosts),
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
