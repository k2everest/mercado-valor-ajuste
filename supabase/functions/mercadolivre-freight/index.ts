
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
    console.log('=== INÍCIO DO CÁLCULO DE FRETE ===')
    console.log('Action:', action)
    console.log('Product ID:', productId)
    console.log('ZIP Code:', zipCode)
    
    if (!accessToken) {
      throw new Error('Token de acesso é obrigatório')
    }

    if (action === 'getShippingCosts') {
      if (!productId || !zipCode) {
        throw new Error('Product ID e CEP são obrigatórios')
      }

      // Get product details first
      console.log('Buscando detalhes do produto...')
      const productResponse = await fetch(`https://api.mercadolibre.com/items/${productId}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!productResponse.ok) {
        console.error('Erro ao buscar produto:', productResponse.status)
        throw new Error(`Falha ao buscar produto: ${productResponse.status}`)
      }

      const product = await productResponse.json()
      console.log('Produto encontrado:', product.title)
      console.log('Seller ID:', product.seller_id)

      // Try multiple API endpoints to get real shipping costs
      let freightOptions = []

      // Method 1: Direct shipping options for the item
      console.log('=== TENTATIVA 1: Opções de frete diretas ===')
      const directShippingUrl = `https://api.mercadolibre.com/items/${productId}/shipping_options?zip_code=${zipCode}`
      console.log('URL:', directShippingUrl)
      
      const directShippingResponse = await fetch(directShippingUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (directShippingResponse.ok) {
        const directShippingData = await directShippingResponse.json()
        console.log('Resposta completa da API de frete direto:', JSON.stringify(directShippingData, null, 2))

        if (directShippingData?.options && directShippingData.options.length > 0) {
          console.log('Processando opções de frete diretas...')
          freightOptions = directShippingData.options.map((option: any) => {
            console.log('Opção processada:', {
              name: option.name,
              cost: option.cost,
              base_cost: option.base_cost,
              list_cost: option.list_cost
            })
            
            const sellerCost = option.base_cost || option.list_cost || option.cost || 0
            
            return {
              method: option.name || 'Mercado Envios',
              carrier: option.shipping_method_id || 'Mercado Envios',
              price: option.cost || 0,
              sellerCost: sellerCost,
              deliveryTime: option.estimated_delivery_time?.date || '3-7 dias úteis',
              isFreeShipping: option.cost === 0,
              source: 'direct_api',
              rawData: option
            }
          })
        }
      } else {
        console.error('Falha na API de frete direto:', directShippingResponse.status, await directShippingResponse.text())
      }

      // Method 2: Shipping calculator API
      if (freightOptions.length === 0) {
        console.log('=== TENTATIVA 2: Calculadora de frete ===')
        const calculatorUrl = `https://api.mercadolibre.com/sites/MLB/shipping_calculator`
        console.log('URL:', calculatorUrl)
        
        const calculatorBody = {
          items: [{
            id: productId,
            quantity: 1
          }],
          zip_code_to: zipCode,
          shipping_method: 'custom'
        }
        
        console.log('Body da requisição:', JSON.stringify(calculatorBody, null, 2))
        
        const calculatorResponse = await fetch(calculatorUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(calculatorBody)
        })

        if (calculatorResponse.ok) {
          const calculatorData = await calculatorResponse.json()
          console.log('Resposta da calculadora de frete:', JSON.stringify(calculatorData, null, 2))
          
          if (calculatorData?.costs && calculatorData.costs.length > 0) {
            freightOptions = calculatorData.costs.map((cost: any) => ({
              method: cost.method || 'Mercado Envios',
              carrier: cost.method || 'Mercado Envios',
              price: cost.cost || 0,
              sellerCost: cost.seller_cost || cost.cost || 0,
              deliveryTime: cost.delivery_time || '3-7 dias úteis',
              isFreeShipping: cost.cost === 0,
              source: 'calculator_api',
              rawData: cost
            }))
          }
        } else {
          console.error('Falha na calculadora de frete:', calculatorResponse.status, await calculatorResponse.text())
        }
      }

      // Method 3: Generic shipping costs
      if (freightOptions.length === 0) {
        console.log('=== TENTATIVA 3: Custos genéricos de frete ===')
        const genericUrl = `https://api.mercadolibre.com/sites/MLB/shipping_costs?dimensions=20x20x20,1000&zip_code_from=01310100&zip_code_to=${zipCode}`
        console.log('URL:', genericUrl)
        
        const genericResponse = await fetch(genericUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        if (genericResponse.ok) {
          const genericData = await genericResponse.json()
          console.log('Resposta dos custos genéricos:', JSON.stringify(genericData, null, 2))
          
          if (genericData?.costs && genericData.costs.length > 0) {
            freightOptions = genericData.costs.map((cost: any) => ({
              method: cost.method || 'Mercado Envios',
              carrier: cost.method || 'Mercado Envios',
              price: cost.cost || 0,
              sellerCost: cost.cost || 0,
              deliveryTime: '3-7 dias úteis',
              isFreeShipping: false,
              source: 'generic_api',
              rawData: cost
            }))
          }
        } else {
          console.error('Falha nos custos genéricos:', genericResponse.status, await genericResponse.text())
        }
      }

      if (freightOptions.length === 0) {
        console.error('=== NENHUMA OPÇÃO DE FRETE ENCONTRADA ===')
        throw new Error('Não foi possível obter custos reais de frete da API do Mercado Livre')
      }

      console.log('=== OPÇÕES FINAIS DE FRETE ===')
      console.log('Total de opções encontradas:', freightOptions.length)
      freightOptions.forEach((option, index) => {
        console.log(`Opção ${index + 1}:`, {
          method: option.method,
          price: option.price,
          sellerCost: option.sellerCost,
          source: option.source
        })
      })

      return new Response(
        JSON.stringify({ 
          freightOptions,
          zipCode,
          productId,
          hasRealCosts: true,
          apiSource: freightOptions[0]?.source,
          productData: {
            title: product.title,
            price: product.price,
            freeShipping: product.shipping?.free_shipping,
            sellerId: product.seller_id
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
    console.error('=== ERRO NO CÁLCULO DE FRETE ===')
    console.error('Erro:', error.message)
    console.error('Stack:', error.stack)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
