
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
      console.log('Frete grátis do produto:', product.shipping?.free_shipping)

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
            
            // Determine who pays for shipping
            const productHasFreeShipping = product.shipping?.free_shipping === true
            const optionHasFreeShipping = option.cost === 0
            
            console.log('Produto tem frete grátis:', productHasFreeShipping)
            console.log('Opção tem custo zero:', optionHasFreeShipping)
            
            // Calculate the REAL cost based on who pays
            let realCost = 0
            let calculationMethod = ''
            let paidBy = ''
            
            if (productHasFreeShipping || optionHasFreeShipping) {
              // FRETE GRÁTIS - Vendedor paga
              paidBy = 'vendedor'
              
              // Priority order for seller cost calculation
              if (option.discount && typeof option.discount === 'object') {
                if (option.discount.promoted_amount && option.discount.promoted_amount > 0) {
                  const baseAmount = option.list_cost || option.base_cost || option.cost || 0
                  realCost = Math.max(0, baseAmount - option.discount.promoted_amount)
                  calculationMethod = 'base_cost - desconto_promocional'
                  console.log(`VENDEDOR PAGA COM DESCONTO: ${baseAmount} - ${option.discount.promoted_amount} = ${realCost}`)
                } else if (option.discount.rate && option.discount.rate > 0) {
                  const baseAmount = option.list_cost || option.base_cost || option.cost || 0
                  const discountAmount = baseAmount * (option.discount.rate / 100)
                  realCost = Math.max(0, baseAmount - discountAmount)
                  calculationMethod = 'base_cost - desconto_percentual'
                  console.log(`VENDEDOR PAGA COM DESCONTO %: ${baseAmount} - ${discountAmount} = ${realCost}`)
                }
              }
              
              // If no discount calculated, use available cost fields
              if (realCost === 0) {
                if (option.seller_cost !== undefined && option.seller_cost !== null && option.seller_cost > 0) {
                  realCost = option.seller_cost
                  calculationMethod = 'seller_cost_direto'
                } else if (option.base_cost !== undefined && option.base_cost !== null && option.base_cost > 0) {
                  realCost = option.base_cost
                  calculationMethod = 'base_cost_direto'
                } else if (option.list_cost !== undefined && option.list_cost !== null && option.list_cost > 0) {
                  realCost = option.list_cost
                  calculationMethod = 'list_cost_direto'
                } else {
                  // For free shipping, if all else fails, use cost as minimum seller pays
                  realCost = option.cost || 0
                  calculationMethod = 'cost_fallback_vendedor'
                }
              }
            } else {
              // FRETE PAGO PELO COMPRADOR
              paidBy = 'comprador'
              realCost = option.cost || 0
              calculationMethod = 'cost_comprador'
              console.log(`COMPRADOR PAGA: ${realCost}`)
            }
            
            console.log(`CUSTO FINAL: R$ ${realCost} (pago por: ${paidBy}, método: ${calculationMethod})`)
            
            return {
              method: option.name || 'Mercado Envios',
              carrier: option.shipping_method_id || 'Mercado Envios',
              price: option.cost || 0,
              sellerCost: paidBy === 'vendedor' ? realCost : 0,
              buyerCost: paidBy === 'comprador' ? realCost : option.cost || 0,
              deliveryTime: option.estimated_delivery_time?.date || '3-7 dias úteis',
              isFreeShipping: productHasFreeShipping || optionHasFreeShipping,
              paidBy: paidBy,
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
              sellerCost: cost.seller_cost || 0,
              buyerCost: cost.cost || 0,
              deliveryTime: cost.delivery_time || '3-7 dias úteis',
              isFreeShipping: cost.cost === 0,
              paidBy: cost.cost === 0 ? 'vendedor' : 'comprador',
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
        const sellerCostValid = typeof option.sellerCost === 'number' && option.sellerCost >= 0
        const buyerCostValid = typeof option.buyerCost === 'number' && option.buyerCost >= 0
        const priceValid = typeof option.price === 'number' && option.price >= 0
        
        const isValid = sellerCostValid && buyerCostValid && priceValid
        
        if (!isValid) {
          console.warn('Opção filtrada por valores inválidos:', option)
        }
        
        return isValid
      })

      if (validOptions.length === 0) {
        console.error('=== TODAS AS OPÇÕES FORAM FILTRADAS ===')
        throw new Error('Todas as opções de frete retornaram valores inválidos')
      }

      // Prioritize Mercado Envios Padrão, then find the most appropriate option
      const mercadoEnviosPadraoOptions = validOptions.filter(option => option.isMercadoEnviosPadrao)
      let optionsToConsider = mercadoEnviosPadraoOptions.length > 0 ? mercadoEnviosPadraoOptions : validOptions

      console.log(`Considerando ${optionsToConsider.length} opções válidas${mercadoEnviosPadraoOptions.length > 0 ? ' (priorizando Mercado Envios Padrão)' : ''}`)

      // Select the best option based on who pays
      const selectedOption = optionsToConsider.reduce((best: any, current: any) => {
        console.log(`Comparando: ${current.method} (${current.paidBy} paga R$ ${current.paidBy === 'vendedor' ? current.sellerCost : current.buyerCost}) vs ${best.method} (${best.paidBy} paga R$ ${best.paidBy === 'vendedor' ? best.sellerCost : best.buyerCost})`)
        
        // For seller-paid shipping, choose lowest seller cost
        if (current.paidBy === 'vendedor' && best.paidBy === 'vendedor') {
          return current.sellerCost < best.sellerCost ? current : best
        }
        
        // For buyer-paid shipping, choose lowest buyer cost
        if (current.paidBy === 'comprador' && best.paidBy === 'comprador') {
          return current.buyerCost < best.buyerCost ? current : best
        }
        
        // Prefer seller-paid over buyer-paid if costs are similar
        if (current.paidBy === 'vendedor' && best.paidBy === 'comprador') {
          return current
        }
        
        return best
      })

      console.log('=== OPÇÃO FINAL SELECIONADA ===')
      console.log('Método:', selectedOption.method)
      console.log('Preço Cliente:', selectedOption.price)
      console.log('Custo Vendedor:', selectedOption.sellerCost)
      console.log('Custo Comprador:', selectedOption.buyerCost)
      console.log('Pago por:', selectedOption.paidBy)
      console.log('Fonte:', selectedOption.source)
      console.log('É Mercado Envios Padrão:', selectedOption.isMercadoEnviosPadrao)
      console.log('Método de Cálculo:', selectedOption.calculationMethod)

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
