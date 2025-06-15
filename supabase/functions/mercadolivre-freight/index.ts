
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
          
          // Process all options and identify Mercado Envios Padrão
          const processedOptions = directShippingData.options.map((option: any) => {
            const optionName = (option.name || '').toLowerCase()
            const shippingMethodId = String(option.shipping_method_id || '').toLowerCase()
            
            console.log('=== ANÁLISE DA OPÇÃO ===')
            console.log('Nome:', option.name)
            console.log('Shipping Method ID:', option.shipping_method_id)
            console.log('Cost (cliente):', option.cost)
            console.log('Base Cost:', option.base_cost)
            console.log('List Cost:', option.list_cost)
            console.log('Seller Cost:', option.seller_cost)
            console.log('Discount:', option.discount)
            
            // Identify if this is Mercado Envios Padrão (not Flex)
            const isMercadoEnviosPadrao = (
              (optionName.includes('mercado envios') && !optionName.includes('flex')) ||
              (optionName.includes('padrão')) ||
              (shippingMethodId.includes('mercado_envios') && !shippingMethodId.includes('flex'))
            )
            
            console.log('É Mercado Envios Padrão?', isMercadoEnviosPadrao)
            
            // Calculate the REAL seller cost based on different scenarios
            let realSellerCost = 0
            let calculationMethod = ''
            
            // Priority 1: If there's a discount, calculate real cost
            if (option.discount && typeof option.discount === 'object') {
              if (option.discount.promoted_amount && option.discount.promoted_amount > 0) {
                // Seller pays base_cost minus ML promotional discount
                const baseAmount = option.list_cost || option.base_cost || option.cost || 0
                realSellerCost = baseAmount - option.discount.promoted_amount
                calculationMethod = 'base_cost - discount_promocional'
                console.log(`CÁLCULO COM DESCONTO: ${baseAmount} - ${option.discount.promoted_amount} = ${realSellerCost}`)
              } else if (option.discount.rate && option.discount.rate > 0) {
                // Percentage discount
                const baseAmount = option.list_cost || option.base_cost || option.cost || 0
                const discountAmount = baseAmount * (option.discount.rate / 100)
                realSellerCost = baseAmount - discountAmount
                calculationMethod = 'base_cost - discount_percentual'
                console.log(`CÁLCULO COM DESCONTO %: ${baseAmount} - ${discountAmount} = ${realSellerCost}`)
              }
            }
            
            // Priority 2: Use seller_cost if available and no discount calculated
            if (realSellerCost === 0 && option.seller_cost !== undefined && option.seller_cost !== null) {
              realSellerCost = option.seller_cost
              calculationMethod = 'seller_cost_direto'
              console.log(`USANDO SELLER COST DIRETO: ${realSellerCost}`)
            }
            
            // Priority 3: Use base_cost if available
            if (realSellerCost === 0 && option.base_cost !== undefined && option.base_cost !== null) {
              realSellerCost = option.base_cost
              calculationMethod = 'base_cost_direto'
              console.log(`USANDO BASE COST: ${realSellerCost}`)
            }
            
            // Priority 4: Use list_cost if available
            if (realSellerCost === 0 && option.list_cost !== undefined && option.list_cost !== null) {
              realSellerCost = option.list_cost
              calculationMethod = 'list_cost_direto'
              console.log(`USANDO LIST COST: ${realSellerCost}`)
            }
            
            // Priority 5: Use cost as last resort
            if (realSellerCost === 0) {
              realSellerCost = option.cost || 0
              calculationMethod = 'cost_fallback'
              console.log(`USANDO COST FALLBACK: ${realSellerCost}`)
            }
            
            console.log(`CUSTO REAL CALCULADO: R$ ${realSellerCost} (método: ${calculationMethod})`)
            
            return {
              method: option.name || 'Mercado Envios',
              carrier: option.shipping_method_id || 'Mercado Envios',
              price: option.cost || 0,
              sellerCost: realSellerCost,
              deliveryTime: option.estimated_delivery_time?.date || '3-7 dias úteis',
              isFreeShipping: option.cost === 0,
              source: 'direct_api_detailed',
              rawData: option,
              discount: option.discount || null,
              isMercadoEnviosPadrao: isMercadoEnviosPadrao,
              calculationMethod: calculationMethod
            }
          })

          // Filter for Mercado Envios Padrão options first
          const mercadoEnviosPadraoOptions = processedOptions.filter(option => option.isMercadoEnviosPadrao)
          
          console.log(`Encontradas ${mercadoEnviosPadraoOptions.length} opções de Mercado Envios Padrão`)
          console.log(`Total de opções processadas: ${processedOptions.length}`)
          
          // Use Mercado Envios Padrão if available, otherwise use all options
          freightOptions = mercadoEnviosPadraoOptions.length > 0 ? mercadoEnviosPadraoOptions : processedOptions
        }
      } else {
        console.error('Falha na API de frete direto:', directShippingResponse.status, await directShippingResponse.text())
      }

      // Method 2: Shipping costs API with seller context (fallback)
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
              rawData: cost,
              calculationMethod: 'fallback_api'
            }))
          }
        } else {
          console.error('Falha na API de custos:', costsResponse.status, await costsResponse.text())
        }
      }

      if (freightOptions.length === 0) {
        console.error('=== NENHUMA OPÇÃO DE FRETE ENCONTRADA ===')
        throw new Error('Não foi possível obter custos reais de frete da API do Mercado Livre')
      }

      // Filter out any options with invalid values
      const validOptions = freightOptions.filter(option => {
        const isValid = typeof option.sellerCost === 'number' && 
                       typeof option.price === 'number' &&
                       option.sellerCost >= 0 &&
                       option.price >= 0 &&
                       option.sellerCost !== null &&
                       option.sellerCost !== undefined
        
        if (!isValid) {
          console.warn('Opção filtrada por valores inválidos:', option)
        }
        
        return isValid
      })

      if (validOptions.length === 0) {
        console.error('=== TODAS AS OPÇÕES FORAM FILTRADAS ===')
        throw new Error('Todas as opções de frete retornaram valores inválidos')
      }

      // Prioritize Mercado Envios Padrão, then find the one with lowest seller cost
      const mercadoEnviosPadraoOptions = validOptions.filter(option => option.isMercadoEnviosPadrao)
      const optionsToConsider = mercadoEnviosPadraoOptions.length > 0 ? mercadoEnviosPadraoOptions : validOptions

      console.log(`Considerando ${optionsToConsider.length} opções válidas${mercadoEnviosPadraoOptions.length > 0 ? ' (priorizando Mercado Envios Padrão)' : ''}`)

      // Find the option with the lowest seller cost among valid options
      const selectedOption = optionsToConsider.reduce((min: any, current: any) => {
        console.log(`Comparando: ${current.method} (R$ ${current.sellerCost}) vs ${min.method} (R$ ${min.sellerCost})`)
        return current.sellerCost < min.sellerCost ? current : min
      })

      console.log('=== OPÇÃO FINAL SELECIONADA ===')
      console.log('Método:', selectedOption.method)
      console.log('Preço Cliente:', selectedOption.price)
      console.log('Custo Vendedor:', selectedOption.sellerCost)
      console.log('Fonte:', selectedOption.source)
      console.log('É Mercado Envios Padrão:', selectedOption.isMercadoEnviosPadrao)
      console.log('Método de Cálculo:', selectedOption.calculationMethod)
      console.log('Desconto aplicado:', selectedOption.discount)

      return new Response(
        JSON.stringify({ 
          freightOptions: validOptions,
          selectedOption: selectedOption,
          zipCode,
          productId,
          hasRealCosts: true,
          apiSource: selectedOption.source,
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
