
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
      throw new Error('Access token is required')
    }

    console.log(`Fetching user information... (limit: ${limit}, offset: ${offset})`)

    // Get user information first
    const userResponse = await fetch('https://api.mercadolibre.com/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      const errorText = await userResponse.text()
      console.error('User fetch error:', errorText)
      throw new Error(`Failed to get user information: ${userResponse.status}`)
    }

    const userData = await userResponse.json()
    const userId = userData.id
    console.log('User ID:', userId)

    // If limit is -1, we want to load ALL products
    if (limit === -1) {
      console.log('Loading ALL products...')
      
      // First, get the total count
      const countResponse = await fetch(`https://api.mercadolibre.com/users/${userId}/items/search?status=active&limit=1&offset=0`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      if (!countResponse.ok) {
        throw new Error(`Failed to get product count: ${countResponse.status}`)
      }

      const countData = await countResponse.json()
      const totalItems = countData.paging?.total || 0
      console.log('Total items found:', totalItems)

      if (totalItems === 0) {
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
          console.warn(`Failed to fetch batch at offset ${currentOffset}:`, itemsResponse.status)
          break
        }

        const itemsData = await itemsResponse.json()
        allItemIds.push(...itemsData.results)
        currentOffset += batchSize

        console.log(`Fetched batch: ${itemsData.results.length} items (total so far: ${allItemIds.length})`)
        
        // Break if we've got all items or no more items in this batch
        if (itemsData.results.length < batchSize) {
          break
        }
      }

      console.log('Total item IDs collected:', allItemIds.length)

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
            console.warn(`Failed to fetch item ${itemId}:`, itemResponse.status)
          }
        } catch (error) {
          console.warn(`Error fetching item ${itemId}:`, error.message)
        }
      }

      console.log('Successfully processed ALL products:', products.length)

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
    console.log('Fetching user items with pagination...')
    const itemsResponse = await fetch(`https://api.mercadolibre.com/users/${userId}/items/search?status=active&limit=50&offset=${offset}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!itemsResponse.ok) {
      const errorText = await itemsResponse.text()
      console.error('Items fetch error:', errorText)
      throw new Error(`Failed to fetch user items: ${itemsResponse.status}`)
    }

    const itemsData = await itemsResponse.json()
    const itemIds = itemsData.results
    const totalItems = itemsData.paging?.total || itemIds.length
    console.log('Found items:', itemIds.length, 'Total items:', totalItems)

    if (itemIds.length === 0) {
      console.log('No active items found')
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
    console.log('Fetching item details...')
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
          console.warn(`Failed to fetch item ${itemId}:`, itemResponse.status)
        }
      } catch (error) {
        console.warn(`Error fetching item ${itemId}:`, error.message)
      }
    }

    console.log('Successfully processed products:', products.length)

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
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
