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
    const { action, code, state } = await req.json()
    console.log('Received request:', { action, hasCode: !!code, hasState: !!state })
    
    // Get environment variables
    const ML_CLIENT_ID = Deno.env.get('ML_CLIENT_ID')
    const ML_CLIENT_SECRET = Deno.env.get('ML_CLIENT_SECRET')
    
    if (!ML_CLIENT_ID || !ML_CLIENT_SECRET) {
      console.error('Missing ML credentials')
      throw new Error('Credenciais do Mercado Livre não configuradas')
    }

    console.log('Using Client ID:', ML_CLIENT_ID)

    if (action === 'getAuthUrl') {
      // Use the React route instead of static HTML file
      const REDIRECT_URI = Deno.env.get("ML_REDIRECT_URI") || "https://mercado-valor-ajuste.vercel.app/auth-callback"
      console.log('Redirect URI:', REDIRECT_URI)
      
      const authUrl = `https://auth.mercadolivre.com.br/authorization?response_type=code&client_id=${ML_CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`
      console.log('Generated auth URL:', authUrl)
      
      return new Response(
        JSON.stringify({ authUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (action === 'exchangeCode') {
      console.log('Exchanging code for token...')
      const REDIRECT_URI = Deno.env.get("ML_REDIRECT_URI") || "https://mercado-valor-ajuste.vercel.app/auth-callback"
      
      // Exchange authorization code for access token
      const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: ML_CLIENT_ID,
          client_secret: ML_CLIENT_SECRET,
          code: code,
          redirect_uri: REDIRECT_URI,
        }),
      })

      console.log('Token response status:', tokenResponse.status)
      
      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text()
        console.error('Token exchange failed:', errorText)
        throw new Error(`Falha na troca do código: ${errorText}`)
      }

      const tokenData = await tokenResponse.json()
      console.log('Token exchange successful')
      
      return new Response(
        JSON.stringify(tokenData),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Ação inválida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in mercadolivre-auth:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})