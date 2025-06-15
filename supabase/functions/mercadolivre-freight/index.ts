
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

      // Get seller information for reputation details
      console.log('Buscando informações do vendedor...')
      const sellerResponse = await fetch(`https://api.mercadolibre.com/users/${product.seller_id}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      let sellerData = null
      if (sellerResponse.ok) {
        sellerData = await sellerResponse.json()
        console.log('Seller reputation:', sellerData.seller_reputation)
      }

      // Try multiple API endpoints to get real shipping costs
      let freightOptions = []

      // Method 1: Direct shipping options for the item with detailed cost breakdown
      console.log('=== TENTATIVA 1: Opções de frete diretas com breakdown ===')
      const directShippingUrl = `https://api.mercadolibre.com/items/${productId}/shipping_options?zip_code=${zipCode}&include_dimensions=true`
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
              list_cost: option.list_cost,
              seller_cost: option.seller_cost,
              discount: option.discount
            })
            
            // Calculate real seller cost based on discount information
            let realSellerCost = 0
            
            if (option.discount && option.discount.promoted_amount > 0) {
              // When there's a discount, the seller pays the base_cost minus the discount covered by ML
              const baseCost = option.base_cost || option.list_cost || option.cost || 0
              const mlDiscount = option.discount.promoted_amount || 0
              realSellerCost = baseCost - mlDiscount
              
              console.log('=== CÁLCULO COM DESCONTO MERCADO LIVRE ===')
              console.log('Base cost:', baseCost)
              console.log('Desconto ML:', mlDiscount)
              console.log('Custo real vendedor (base - desconto ML):', realSellerCost)
            } else {
              // No discount, use priority: seller_cost > base_cost > list_cost > cost
              if (option.seller_cost !== undefined && option.seller_cost !== null) {
                realSellerCost = option.seller_cost
                console.log('Usando seller_cost:', realSellerCost)
              } else if (option.base_cost !== undefined && option.base_cost !== null) {
                realSellerCost = option.base_cost
                console.log('Usando base_cost:', realSellerCost)
              } else if (option.list_cost !== undefined && option.list_cost !== null) {
                realSellerCost = option.list_cost
                console.log('Usando list_cost:', realSellerCost)
              } else {
                realSellerCost = option.cost || 0
                console.log('Usando cost padrão:', realSellerCost)
              }
            }
            
            return {
              method: option.name || 'Mercado Envios',
              carrier: option.shipping_method_id || 'Mercado Envios',
              price: option.cost || 0,
              sellerCost: realSellerCost,
              deliveryTime: option.estimated_delivery_time?.date || '3-7 dias úteis',
              isFreeShipping: option.cost === 0,
              source: 'direct_api_detailed',
              rawData: option,
              discount: option.discount || null
            }
          })
        }
      } else {
        console.error('Falha na API de frete direto:', directShippingResponse.status, await directShippingResponse.text())
      }

      // Method 2: Shipping costs API with seller context
      if (freightOptions.length === 0) {
        console.log('=== TENTATIVA 2: API de custos de frete com contexto do vendedor ===')
        const costsUrl = `https://api.mercadolibre.com/sites/MLB/shipping_costs?dimensions=20x20x20,1000&zip_code_from=${product.seller_id}&zip_code_to=${zipCode}&item_id=${productId}`
        console.log('URL:', costsUrl)
        
        const costsResponse = await fetch(costsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        if (costsResponse.ok) {
          const costsData = await costsResponse.json()
          console.log('Resposta da API de custos:', JSON.stringify(costsData, null, 2))
          
          if (costsData?.costs && costsData.costs.length > 0) {
            freightOptions = costsData.costs.map((cost: any) => ({
              method: cost.method || 'Mercado Envios',
              carrier: cost.method || 'Mercado Envios',
              price: cost.cost || 0,
              sellerCost: cost.seller_cost || cost.cost || 0,
              deliveryTime: cost.delivery_time || '3-7 dias úteis',
              isFreeShipping: cost.cost === 0,
              source: 'costs_api_with_seller',
              rawData: cost
            }))
          }
        } else {
          console.error('Falha na API de custos:', costsResponse.status, await costsResponse.text())
        }
      }

      // Method 3: Shipping calculator API with item context
      if (freightOptions.length === 0) {
        console.log('=== TENTATIVA 3: Calculadora de frete com contexto do item ===')
        const calculatorUrl = `https://api.mercadolibre.com/sites/MLB/shipping_calculator`
        console.log('URL:', calculatorUrl)
        
        const calculatorBody = {
          items: [{
            id: productId,
            quantity: 1
          }],
          zip_code_to: zipCode,
          zip_code_from: product.location?.city?.id || '1',
          shipping_method: 'custom',
          include_seller_costs: true
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
              sellerCost: cost.seller_cost || cost.base_cost || cost.cost || 0,
              deliveryTime: cost.delivery_time || '3-7 dias úteis',
              isFreeShipping: cost.cost === 0,
              source: 'calculator_api_with_context',
              rawData: cost
            }))
          }
        } else {
          console.error('Falha na calculadora de frete:', calculatorResponse.status, await calculatorResponse.text())
        }
      }

      // Method 4: Generic shipping costs as last resort
      if (freightOptions.length === 0) {
        console.log('=== TENTATIVA 4: Custos genéricos de frete (último recurso) ===')
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
              source: 'generic_api_fallback',
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

      // Filter out any options with suspicious values
      const validOptions = freightOptions.filter(option => {
        const isValid = typeof option.sellerCost === 'number' && 
                       typeof option.price === 'number' &&
                       option.sellerCost >= 0 &&
                       option.price >= 0 &&
                       option.sellerCost !== 25 &&
                       option.price !== 25
        
        if (!isValid) {
          console.warn('Opção filtrada por valores suspeitos:', option)
        }
        
        return isValid
      })

      if (validOptions.length === 0) {
        console.error('=== TODAS AS OPÇÕES FORAM FILTRADAS ===')
        throw new Error('Todas as opções de frete retornaram valores suspeitos')
      }

      // Find the cheapest option based on seller cost
      const cheapestOption = validOptions.reduce((min: any, current: any) => {
        return current.sellerCost < min.sellerCost ? current : min
      })

      console.log('=== OPÇÃO FINAL SELECIONADA ===')
      console.log('Método:', cheapestOption.method)
      console.log('Preço Cliente:', cheapestOption.price)
      console.log('Custo Vendedor:', cheapestOption.sellerCost)
      console.log('Fonte:', cheapestOption.source)
      console.log('Desconto aplicado:', cheapestOption.discount)

      return new Response(
        JSON.stringify({ 
          freightOptions: validOptions,
          selectedOption: cheapestOption,
          zipCode,
          productId,
          hasRealCosts: true,
          apiSource: cheapestOption.source,
          productData: {
            title: product.title,
            price: product.price,
            freeShipping: product.shipping?.free_shipping,
            sellerId: product.seller_id
          },
          sellerData: sellerData ? {
            reputation: sellerData.seller_reputation,
            level: sellerData.seller_reputation?.level_id
          } : null
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
