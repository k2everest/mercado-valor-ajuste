
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
    const { action, productId, zipCode, quantity = 1 } = await req.json()
    console.log('Magento freight request:', { action, productId, zipCode, quantity })
    
    // Get Magento credentials from environment
    const MAGENTO_BASE_URL = Deno.env.get('MAGENTO_BASE_URL')
    const MAGENTO_API_TOKEN = Deno.env.get('MAGENTO_API_TOKEN')
    
    if (!MAGENTO_BASE_URL || !MAGENTO_API_TOKEN) {
      console.error('Missing Magento credentials')
      throw new Error('Credenciais do Magento não configuradas')
    }

    console.log('Using Magento URL:', MAGENTO_BASE_URL)

    if (action === 'getShippingCosts') {
      if (!productId || !zipCode) {
        throw new Error('Product ID e CEP são obrigatórios')
      }

      // Create a quote to calculate shipping
      const quoteResponse = await fetch(`${MAGENTO_BASE_URL}/rest/V1/carts/mine`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MAGENTO_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })

      if (!quoteResponse.ok) {
        throw new Error(`Falha ao criar carrinho: ${quoteResponse.status}`)
      }

      const quoteId = await quoteResponse.json()
      console.log('Quote created:', quoteId)

      // Add product to cart
      const addProductResponse = await fetch(`${MAGENTO_BASE_URL}/rest/V1/carts/mine/items`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MAGENTO_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cartItem: {
            sku: productId,
            qty: quantity,
            quote_id: quoteId
          }
        })
      })

      if (!addProductResponse.ok) {
        throw new Error(`Falha ao adicionar produto ao carrinho: ${addProductResponse.status}`)
      }

      // Get shipping methods
      const shippingResponse = await fetch(`${MAGENTO_BASE_URL}/rest/V1/carts/mine/shipping-methods`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${MAGENTO_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          address: {
            country_id: 'BR',
            postcode: zipCode,
            region_id: 0
          }
        })
      })

      if (!shippingResponse.ok) {
        throw new Error(`Falha ao obter métodos de frete: ${shippingResponse.status}`)
      }

      const shippingMethods = await shippingResponse.json()
      console.log('Shipping methods:', shippingMethods)

      // Transform shipping methods data
      const freightOptions = shippingMethods.map((method: any) => ({
        method: method.method_title,
        carrier: method.carrier_title,
        price: method.price_incl_tax || method.amount,
        deliveryTime: method.extension_attributes?.delivery_time || 'Não informado'
      }))

      return new Response(
        JSON.stringify({ 
          freightOptions,
          zipCode,
          productId
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'getProductInfo') {
      if (!productId) {
        throw new Error('Product ID é obrigatório')
      }

      const productResponse = await fetch(`${MAGENTO_BASE_URL}/rest/V1/products/${productId}`, {
        headers: {
          'Authorization': `Bearer ${MAGENTO_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      })

      if (!productResponse.ok) {
        throw new Error(`Falha ao buscar produto: ${productResponse.status}`)
      }

      const product = await productResponse.json()
      
      return new Response(
        JSON.stringify({
          id: product.id,
          sku: product.sku,
          name: product.name,
          price: product.price,
          weight: product.weight,
          status: product.status
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in magento-freight:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
