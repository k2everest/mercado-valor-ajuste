import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Input validation schema
const refreshTokenSchema = z.object({
  refreshToken: z.string()
    .min(10, "Invalid refresh token format")
});

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()

    // Validate input
    const validationResult = refreshTokenSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('❌ Validation error:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ 
          error: 'Dados inválidos',
          code: 'VALIDATION_ERROR',
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { refreshToken } = validationResult.data;

    const clientId = Deno.env.get('ML_CLIENT_ID')
    const clientSecret = Deno.env.get('ML_CLIENT_SECRET')

    if (!clientId || !clientSecret) {
      console.error('❌ Credenciais do Mercado Livre não configuradas')
      return new Response(
        JSON.stringify({ 
          error: 'Credenciais do Mercado Livre não configuradas no servidor.',
          code: 'MISSING_CREDENTIALS'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔄 Renovando token do Mercado Livre...')

    const tokenResponse = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
      }),
    })

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text()
      console.error('❌ Erro ao renovar token:', errorText)
      
      return new Response(
        JSON.stringify({ 
          error: 'Falha ao renovar token. Reconecte-se ao Mercado Livre.',
          code: 'TOKEN_REFRESH_FAILED',
          details: errorText
        }),
        { status: tokenResponse.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const tokenData = await tokenResponse.json()
    console.log('✅ Token renovado com sucesso')

    return new Response(
      JSON.stringify({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token || refreshToken, // Keep existing if not provided
        expiresIn: tokenData.expires_in,
        tokenType: tokenData.token_type
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('💥 Erro ao processar renovação de token:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro interno do servidor',
        code: 'INTERNAL_ERROR'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
