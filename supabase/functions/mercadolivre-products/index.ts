
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
    const { accessToken, limit = 20, offset = 0 } = await req.json()

    if (!accessToken) {
      console.error('❌ Access token não fornecido')
      return new Response(
        JSON.stringify({ 
          error: 'Token de acesso é obrigatório. Reconecte-se ao Mercado Livre.',
          code: 'MISSING_TOKEN'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`🔄 Buscando informações do usuário... (limit: ${limit}, offset: ${offset})`)

    // Get user information first with better error handling
    const userResponse = await fetch('https://api.mercadolibre.com/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('❌ Erro ao buscar usuário:', errorText)
      
      if (userResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            error: 'Token de acesso inválido ou expirado. Reconecte-se ao Mercado Livre.',
            code: 'INVALID_TOKEN'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error(`Falha ao obter informações do usuário: ${userResponse.status}`)
    }

    const userData = await userResponse.json()
    const userId = userData.id
    console.log('✅ User ID obtido:', userId)

    // If limit is -1, we want to load ALL products
    if (limit === -1) {
      console.log('📦 Carregando TODOS os produtos...')
      
      // First, get the total count
      const countResponse = await fetch(`https://api.mercadolibre.com/users/${userId}/items/search?status=active&limit=1&offset=0`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!countResponse.ok) {
        if (countResponse.status === 401) {
          return new Response(
            JSON.stringify({ 
              error: 'Token de acesso inválido. Reconecte-se ao Mercado Livre.',
              code: 'INVALID_TOKEN'
            }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
        throw new Error(`Falha ao obter contagem de produtos: ${countResponse.status}`)
      }

      const countData = await countResponse.json()
      const totalItems = countData.paging?.total || 0
      console.log('📊 Total de itens encontrados:', totalItems)

      if (totalItems === 0) {
        console.log('⚠️ Nenhum produto ativo encontrado')
        return new Response(
          JSON.stringify({ 
            products: [], 
            pagination: {
              total: 0,
              offset: 0,
              limit: -1,
              hasMore: false
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get all item IDs in batches (MercadoLibre API limit is 50 per request)
      const allItemIds = []
      const batchSize = 50
      let currentOffset = 0

      while (currentOffset < totalItems) {
        const itemsResponse = await fetch(`https://api.mercadolibre.com/users/${userId}/items/search?status=active&limit=${batchSize}&offset=${currentOffset}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        if (!itemsResponse.ok) {
          if (itemsResponse.status === 401) {
            return new Response(
              JSON.stringify({ 
                error: 'Token de acesso inválido. Reconecte-se ao Mercado Livre.',
                code: 'INVALID_TOKEN'
              }),
              { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            )
          }
          console.warn(`⚠️ Falha ao buscar lote no offset ${currentOffset}:`, itemsResponse.status)
          break
        }

        const itemsData = await itemsResponse.json()
        allItemIds.push(...itemsData.results)
        currentOffset += batchSize

        console.log(`📥 Lote buscado: ${itemsData.results.length} itens (total até agora: ${allItemIds.length})`)
        
        // Break if we've got all items or no more items in this batch
        if (itemsData.results.length < batchSize) {
          break
        }
      }

      console.log('📋 Total de IDs de itens coletados:', allItemIds.length)

      // Get detailed information for all items
      const products = []
      for (const itemId of allItemIds) {
        try {
          const itemResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          })

          if (itemResponse.ok) {
            const item = await itemResponse.json()
            products.push({
              id: item.id,
              title: item.title,
              originalPrice: item.price,
              status: item.status,
              freeShipping: item.shipping?.free_shipping || false,
              permalink: item.permalink,
              thumbnail: item.thumbnail,
              availableQuantity: item.available_quantity,
              soldQuantity: item.sold_quantity,
            })
          } else {
            console.warn(`⚠️ Falha ao buscar item ${itemId}:`, itemResponse.status)
          }
        } catch (error) {
          console.warn(`⚠️ Erro ao buscar item ${itemId}:`, error.message)
        }
      }

      console.log('✅ Processamento de TODOS os produtos concluído:', products.length)

      return new Response(
        JSON.stringify({ 
          products,
          pagination: {
            total: products.length,
            offset: 0,
            limit: -1,
            hasMore: false
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Standard pagination flow (when limit is not -1)
    console.log('📄 Buscando produtos com paginação...')
    const itemsResponse = await fetch(`https://api.mercadolibre.com/users/${userId}/items/search?status=active&limit=50&offset=${offset}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!itemsResponse.ok) {
      const errorText = await itemsResponse.text()
      console.error('❌ Erro ao buscar itens:', errorText)
      
      if (itemsResponse.status === 401) {
        return new Response(
          JSON.stringify({ 
            error: 'Token de acesso inválido. Reconecte-se ao Mercado Livre.',
            code: 'INVALID_TOKEN'
          }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      throw new Error(`Falha ao buscar itens do usuário: ${itemsResponse.status}`)
    }

    const itemsData = await itemsResponse.json()
    const itemIds = itemsData.results
    const totalItems = itemsData.paging?.total || itemIds.length
    console.log('📊 Itens encontrados:', itemIds.length, 'Total de itens:', totalItems)

    if (itemIds.length === 0) {
      console.log('⚠️ Nenhum item ativo encontrado')
      return new Response(
        JSON.stringify({ 
          products: [], 
          pagination: {
            total: totalItems,
            offset,
            limit,
            hasMore: false
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get detailed information for each item individually
    console.log('🔍 Buscando detalhes dos itens...')
    const products = []
    const itemsToProcess = itemIds.slice(0, limit)
    
    for (const itemId of itemsToProcess) {
      try {
        const itemResponse = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        })

        if (itemResponse.ok) {
          const item = await itemResponse.json()
          products.push({
            id: item.id,
            title: item.title,
            originalPrice: item.price,
            status: item.status,
            freeShipping: item.shipping?.free_shipping || false,
            permalink: item.permalink,
            thumbnail: item.thumbnail,
            availableQuantity: item.available_quantity,
            soldQuantity: item.sold_quantity,
          })
        } else {
          console.warn(`⚠️ Falha ao buscar item ${itemId}:`, itemResponse.status)
        }
      } catch (error) {
        console.warn(`⚠️ Erro ao buscar item ${itemId}:`, error.message)
      }
    }

    console.log('✅ Produtos processados com sucesso:', products.length)

    const hasMore = (offset + products.length) < totalItems

    return new Response(
      JSON.stringify({ 
        products,
        pagination: {
          total: totalItems,
          offset,
          limit,
          hasMore
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Erro completo:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
