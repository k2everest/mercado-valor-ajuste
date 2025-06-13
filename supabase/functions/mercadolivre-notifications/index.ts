
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
    console.log('Recebida notificação do Mercado Livre')
    console.log('Method:', req.method)
    console.log('Headers:', Object.fromEntries(req.headers.entries()))
    
    let body = null
    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type')
      
      if (contentType?.includes('application/json')) {
        body = await req.json()
      } else if (contentType?.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData()
        body = Object.fromEntries(formData.entries())
      } else {
        body = await req.text()
      }
    }
    
    console.log('Body:', body)
    
    // Aqui você pode processar as notificações do Mercado Livre
    // Por exemplo: atualizar status de vendas, estoque, etc.
    
    return new Response(
      JSON.stringify({ 
        status: 'ok',
        message: 'Notificação recebida com sucesso',
        timestamp: new Date().toISOString()
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Erro ao processar notificação:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno',
        message: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
