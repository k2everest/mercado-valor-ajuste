
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

    // Get user information first
    const userResponse = await fetch('https://api.mercadolibre.com/users/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!userResponse.ok) {
      throw new Error('Failed to get user information')
    }

    const userData = await userResponse.json()
    const userId = userData.id

    // Get user's items
    const itemsResponse = await fetch(`https://api.mercadolibre.com/users/${userId}/items/search?status=active&limit=50`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!itemsResponse.ok) {
      throw new Error('Failed to fetch products')
    }

    const itemsData = await itemsResponse.json()
    const itemIds = itemsData.results

    if (itemIds.length === 0) {
      return new Response(
        JSON.stringify({ products: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get detailed information for each item (batch request)
    const detailsResponse = await fetch(`https://api.mercadolibre.com/items?ids=${itemIds.join(',')}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!detailsResponse.ok) {
      throw new Error('Failed to fetch product details')
    }

    const detailsData = await detailsResponse.json()
    
    // Transform the data to match our frontend interface
    const products = detailsData.map((item: any) => {
      if (item.code === 200 && item.body) {
        const product = item.body
        return {
          id: product.id,
          title: product.title,
          originalPrice: product.price,
          status: product.status,
          freeShipping: product.shipping?.free_shipping || false,
          permalink: product.permalink,
          thumbnail: product.thumbnail,
          availableQuantity: product.available_quantity,
          soldQuantity: product.sold_quantity,
        }
      }
      return null
    }).filter(Boolean)

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
