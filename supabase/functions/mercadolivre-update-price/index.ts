import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const updatePriceSchema = z.object({
  productId: z.string()
    .min(1, "Product ID is required")
    .regex(/^[A-Z]{3}\d+$/, "Invalid Mercado Livre product ID format"),
  newPrice: z.number()
    .positive("Price must be positive")
    .max(999999, "Price cannot exceed 999,999"),
  accessToken: z.string()
    .min(10, "Invalid access token")
});

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== ATUALIZAÇÃO DE PREÇO MERCADO LIVRE ===');
    
    const body = await req.json();
    
    // Validate input
    const validationResult = updatePriceSchema.safeParse(body);
    if (!validationResult.success) {
      console.error('❌ Validation error:', validationResult.error.errors);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Dados inválidos',
          details: validationResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    const { productId, newPrice, accessToken } = validationResult.data;
    
    console.log('📦 Product ID:', productId);
    console.log('💰 Novo preço:', newPrice);

    // Atualizar o preço no Mercado Livre
    const updateUrl = `https://api.mercadolibre.com/items/${productId}`;
    
    console.log('🔄 Atualizando preço na API do ML...');
    console.log('🌐 URL:', updateUrl);
    
    const updateResponse = await fetch(updateUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        price: newPrice
      })
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      console.error('❌ Erro na API do ML:', updateResponse.status, errorText);
      throw new Error(`Erro ao atualizar preço: ${updateResponse.status} - ${errorText}`);
    }

    const updatedProduct = await updateResponse.json();
    console.log('✅ Preço atualizado com sucesso:', updatedProduct.price);

    return new Response(
      JSON.stringify({
        success: true,
        productId: updatedProduct.id,
        oldPrice: updatedProduct.price,
        newPrice: newPrice,
        message: 'Preço atualizado com sucesso no Mercado Livre'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('=== ERRO NA ATUALIZAÇÃO DE PREÇO ===');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
