import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UpdatePriceRequest {
  productId: string;
  newPrice: number;
  accessToken: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== ATUALIZAÇÃO DE PREÇO MERCADO LIVRE ===');
    
    const { productId, newPrice, accessToken }: UpdatePriceRequest = await req.json();
    
    console.log('📦 Product ID:', productId);
    console.log('💰 Novo preço:', newPrice);

    if (!productId || !newPrice || !accessToken) {
      throw new Error('productId, newPrice e accessToken são obrigatórios');
    }

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
