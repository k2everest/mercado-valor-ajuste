import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CSVProduct {
  sku: string;
  name: string;
  purchase_price: number;
  category?: string;
  brand?: string;
  supplier?: string;
  weight?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user ID from auth header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { products, additionalCosts } = await req.json();
    
    console.log('=== PROCESSAMENTO DE IMPORTAÇÃO CSV ===');
    console.log('Usuário:', user.id);
    console.log('Produtos recebidos:', products?.length || 0);
    console.log('Custos adicionais:', additionalCosts?.length || 0);

    if (!products || !Array.isArray(products)) {
      throw new Error('Lista de produtos é obrigatória');
    }

    // Validate and sanitize products
    const validProducts: CSVProduct[] = products
      .filter(p => p.sku && p.name && p.purchase_price)
      .map(p => ({
        sku: String(p.sku).trim(),
        name: String(p.name).trim(),
        purchase_price: parseFloat(String(p.purchase_price)) || 0,
        category: p.category ? String(p.category).trim() : undefined,
        brand: p.brand ? String(p.brand).trim() : undefined,
        supplier: p.supplier ? String(p.supplier).trim() : undefined,
        weight: p.weight ? parseFloat(String(p.weight)) || 0 : undefined,
      }));

    if (validProducts.length === 0) {
      throw new Error('Nenhum produto válido encontrado no arquivo');
    }

    console.log('Produtos válidos após validação:', validProducts.length);

    // Insert products
    const { data: insertedProducts, error: insertError } = await supabase
      .from('products')
      .upsert(
        validProducts.map(p => ({
          user_id: user.id,
          sku: p.sku,
          name: p.name,
          purchase_price: p.purchase_price,
          category: p.category,
          brand: p.brand,
          supplier: p.supplier,
          weight: p.weight,
        })),
        { onConflict: 'user_id,sku' }
      )
      .select();

    if (insertError) {
      console.error('Erro ao inserir produtos:', insertError);
      throw new Error(`Erro ao inserir produtos: ${insertError.message}`);
    }

    console.log('Produtos inseridos:', insertedProducts?.length || 0);

    // Process additional costs if provided
    let insertedCosts = null;
    if (additionalCosts && Array.isArray(additionalCosts)) {
      const validCosts = additionalCosts
        .filter(c => c.name && c.cost_type && c.value !== undefined)
        .map(c => ({
          user_id: user.id,
          name: String(c.name).trim(),
          description: c.description ? String(c.description).trim() : null,
          cost_type: c.cost_type,
          value: parseFloat(String(c.value)) || 0,
          percentage_base: c.percentage_base || null,
          is_active: c.is_active !== false,
        }));

      if (validCosts.length > 0) {
        const { data: costsData, error: costsError } = await supabase
          .from('additional_costs')
          .upsert(validCosts)
          .select();

        if (costsError) {
          console.error('Erro ao inserir custos:', costsError);
        } else {
          insertedCosts = costsData;
          console.log('Custos adicionais inseridos:', insertedCosts?.length || 0);
        }
      }
    }

    const response = {
      success: true,
      message: `${validProducts.length} produtos processados com sucesso`,
      data: {
        products: insertedProducts,
        additionalCosts: insertedCosts,
        summary: {
          totalProducts: validProducts.length,
          totalCosts: insertedCosts?.length || 0,
          totalValue: validProducts.reduce((sum, p) => sum + p.purchase_price, 0),
        }
      }
    };

    console.log('=== IMPORTAÇÃO CONCLUÍDA ===');
    console.log('Produtos processados:', validProducts.length);
    console.log('Valor total:', response.data.summary.totalValue);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== ERRO NO PROCESSAMENTO ===');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro interno do servidor',
        details: 'Verifique os logs da função para mais detalhes'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});