import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PricingRequest {
  productIds?: string[];
  includeCosts?: boolean;
  updatePrices?: boolean;
}

interface TaxSettings {
  tax_regime: string;
  simples_percentage: number;
  icms_percentage: number;
  ipi_percentage: number;
  pis_percentage: number;
  cofins_percentage: number;
  operational_cost_monthly: number;
  expected_tickets_monthly: number;
  target_margin_percentage: number;
}

function calculateTaxCost(purchasePrice: number, taxSettings: TaxSettings): number {
  let taxCost = 0;
  
  if (taxSettings.tax_regime === 'simples_nacional') {
    // Simples Nacional - percentual único
    taxCost = purchasePrice * (taxSettings.simples_percentage / 100);
  } else {
    // Lucro Real/Presumido - calcular cada imposto
    taxCost = purchasePrice * (
      (taxSettings.icms_percentage / 100) +
      (taxSettings.ipi_percentage / 100) +
      (taxSettings.pis_percentage / 100) +
      (taxSettings.cofins_percentage / 100)
    );
  }
  
  return taxCost;
}

function calculateOperationalCostPerProduct(
  purchasePrice: number,
  totalSalesValue: number,
  taxSettings: TaxSettings
): number {
  // Rateio proporcional do custo operacional
  const operationalCostPerTicket = taxSettings.operational_cost_monthly / taxSettings.expected_tickets_monthly;
  const proportionalFactor = purchasePrice / totalSalesValue;
  
  return operationalCostPerTicket * proportionalFactor;
}

function calculateSuggestedPrice(
  totalCost: number,
  targetMarginPercentage: number
): number {
  // Preço sugerido = Custo Total / (1 - Margem%)
  return totalCost / (1 - (targetMarginPercentage / 100));
}

function calculateMarkup(sellingPrice: number, cost: number): number {
  if (cost === 0) return 0;
  return ((sellingPrice - cost) / cost) * 100;
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

    const { productIds, includeCosts = true, updatePrices = false }: PricingRequest = await req.json();
    
    console.log('=== CÁLCULO DE PRECIFICAÇÃO ===');
    console.log('Usuário:', user.id);
    console.log('Produtos:', productIds?.length || 'todos');
    console.log('Incluir custos:', includeCosts);
    console.log('Atualizar preços:', updatePrices);

    // Get user tax settings
    const { data: taxSettings, error: taxError } = await supabase
      .from('tax_settings')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (taxError && taxError.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar configurações tributárias: ${taxError.message}`);
    }

    if (!taxSettings) {
      throw new Error('Configurações tributárias não encontradas. Configure primeiro na aba de configurações.');
    }

    // Get products
    let productsQuery = supabase
      .from('products')
      .select('*')
      .eq('user_id', user.id);

    if (productIds && productIds.length > 0) {
      productsQuery = productsQuery.in('id', productIds);
    }

    const { data: products, error: productsError } = await productsQuery;

    if (productsError) {
      throw new Error(`Erro ao buscar produtos: ${productsError.message}`);
    }

    if (!products || products.length === 0) {
      throw new Error('Nenhum produto encontrado');
    }

    console.log('Produtos encontrados:', products.length);

    // Get additional costs if requested
    let additionalCosts = [];
    let totalAdditionalCosts = 0;

    if (includeCosts) {
      const { data: costs, error: costsError } = await supabase
        .from('additional_costs')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (costsError) {
        console.warn('Erro ao buscar custos adicionais:', costsError.message);
      } else {
        additionalCosts = costs || [];
        // Calculate total fixed costs
        totalAdditionalCosts = additionalCosts
          .filter(c => c.cost_type === 'fixed')
          .reduce((sum, c) => sum + c.value, 0);
      }
    }

    console.log('Custos adicionais:', additionalCosts.length);
    console.log('Total custos fixos:', totalAdditionalCosts);

    // Calculate total sales value for proportional distribution
    const totalSalesValue = products.reduce((sum, p) => sum + p.purchase_price, 0);

    // Calculate pricing for each product
    const calculations = [];
    
    for (const product of products) {
      // 1. Purchase cost
      const purchaseCost = product.purchase_price;

      // 2. Calculate tax cost
      const taxCost = calculateTaxCost(purchaseCost, taxSettings);

      // 3. Calculate proportional additional costs
      let productAdditionalCosts = 0;
      
      if (includeCosts) {
        // Proportional distribution of fixed costs
        const proportionalFactor = purchaseCost / totalSalesValue;
        productAdditionalCosts = totalAdditionalCosts * proportionalFactor;
        
        // Add operational cost
        productAdditionalCosts += calculateOperationalCostPerProduct(
          purchaseCost,
          totalSalesValue,
          taxSettings
        );
        
        // Add percentage-based costs
        for (const cost of additionalCosts) {
          if (cost.cost_type === 'percentage') {
            if (cost.percentage_base === 'subtotal') {
              productAdditionalCosts += purchaseCost * (cost.value / 100);
            } else if (cost.percentage_base === 'total') {
              // This will be calculated after we know the total
              productAdditionalCosts += (purchaseCost + taxCost) * (cost.value / 100);
            }
          }
        }
      }

      // 4. Total cost
      const totalCost = purchaseCost + taxCost + productAdditionalCosts;

      // 5. Calculate suggested price
      const suggestedPrice = calculateSuggestedPrice(totalCost, taxSettings.target_margin_percentage);

      // 6. Calculate markups
      const currentMarkup = product.selling_price ? 
        calculateMarkup(product.selling_price, totalCost) : 0;
      const suggestedMarkup = calculateMarkup(suggestedPrice, totalCost);

      // 7. Calculate margin percentage
      const marginPercentage = ((suggestedPrice - totalCost) / suggestedPrice) * 100;

      const calculation = {
        user_id: user.id,
        product_id: product.id,
        purchase_cost: purchaseCost,
        additional_costs: productAdditionalCosts,
        tax_cost: taxCost,
        total_cost: totalCost,
        current_selling_price: product.selling_price,
        suggested_price: suggestedPrice,
        current_markup: currentMarkup,
        suggested_markup: suggestedMarkup,
        margin_percentage: marginPercentage,
      };

      calculations.push(calculation);
    }

    console.log('Cálculos realizados:', calculations.length);

    // Save calculations to database
    const { data: savedCalculations, error: saveError } = await supabase
      .from('pricing_calculations')
      .upsert(calculations, { onConflict: 'user_id,product_id' })
      .select(`
        *,
        products:product_id (
          id,
          sku,
          name,
          purchase_price,
          selling_price,
          category,
          brand
        )
      `);

    if (saveError) {
      console.error('Erro ao salvar cálculos:', saveError);
      throw new Error(`Erro ao salvar cálculos: ${saveError.message}`);
    }

    // Update product selling prices if requested
    if (updatePrices) {
      const priceUpdates = calculations.map(calc => ({
        id: calc.product_id,
        selling_price: calc.suggested_price,
      }));

      const { error: updateError } = await supabase
        .from('products')
        .upsert(priceUpdates, { onConflict: 'id' });

      if (updateError) {
        console.warn('Erro ao atualizar preços:', updateError.message);
      } else {
        console.log('Preços atualizados:', priceUpdates.length);
      }
    }

    const response = {
      success: true,
      message: `Precificação calculada para ${calculations.length} produtos`,
      data: {
        calculations: savedCalculations,
        summary: {
          totalProducts: calculations.length,
          averageMarkup: calculations.reduce((sum, c) => sum + c.suggested_markup, 0) / calculations.length,
          totalCost: calculations.reduce((sum, c) => sum + c.total_cost, 0),
          totalSuggestedRevenue: calculations.reduce((sum, c) => sum + c.suggested_price, 0),
          pricesUpdated: updatePrices,
        },
        taxSettings: {
          regime: taxSettings.tax_regime,
          targetMargin: taxSettings.target_margin_percentage,
          operationalCost: taxSettings.operational_cost_monthly,
        }
      }
    };

    console.log('=== PRECIFICAÇÃO CONCLUÍDA ===');
    console.log('Produtos calculados:', calculations.length);
    console.log('Markup médio:', response.data.summary.averageMarkup.toFixed(2) + '%');
    console.log('Receita sugerida:', response.data.summary.totalSuggestedRevenue.toFixed(2));

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== ERRO NO CÁLCULO DE PRECIFICAÇÃO ===');
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