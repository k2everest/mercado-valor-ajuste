
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
    const { accessToken } = await req.json()

    if (!accessToken) {
      throw new Error('Access token is required')
    }

    console.log('Fetching user information...')

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

    // Get user's items
    console.log('Fetching user items...')
    const itemsResponse = await fetch(`https://api.mercadolibre.com/users/${userId}/items/search?status=active&limit=50`, {
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
    console.log('Found items:', itemIds.length)

    if (itemIds.length === 0) {
      console.log('No active items found')
      return new Response(
        JSON.stringify({ products: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get detailed information for each item individually to avoid batch request issues
    console.log('Fetching item details...')
    const products = []
    
    for (const itemId of itemIds.slice(0, 20)) { // Limit to 20 items to avoid timeouts
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

    return new Response(
      JSON.stringify({ products }),
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
