
import { Product, ShippingOption, ProcessedFreightOption } from './types.ts';
import { CostCalculator } from './cost-calculator.ts';

export class ShippingProcessor {
  static processShippingOptions(
    options: ShippingOption[], 
    product: Product
  ): ProcessedFreightOption[] {
    return options.map((option: any) => {
      const optionName = (option.name || '').toLowerCase();
      const shippingMethodId = String(option.shipping_method_id || '').toLowerCase();
      
      console.log('=== ANÁLISE DA OPÇÃO ===');
      console.log('Nome:', option.name);
      console.log('Shipping Method ID:', option.shipping_method_id);
      console.log('Cost (cliente):', option.cost);
      console.log('Base Cost:', option.base_cost);
      console.log('List Cost:', option.list_cost);
      console.log('Seller Cost:', option.seller_cost);
      console.log('Discount completo:', JSON.stringify(option.discount, null, 2));
      
      // Identify if this is Mercado Envios Padrão (not Flex)
      const isMercadoEnviosPadrao = (
        (optionName.includes('mercado envios') && !optionName.includes('flex')) ||
        (optionName.includes('padrão')) ||
        (shippingMethodId.includes('mercado_envios') && !shippingMethodId.includes('flex')) ||
        (shippingMethodId === '515462') // ID específico do Mercado Envios Padrão
      );
      
      console.log('É Mercado Envios Padrão?', isMercadoEnviosPadrao);
      
      // CORREÇÃO: Improve reputation discount detection
      const productHasFreeShipping = product.shipping?.free_shipping === true;
      const optionCost = Number(option.cost) || 0;
      
      // Enhanced reputation discount detection - check multiple conditions
      const hasReputationDiscount = !!(
        option.discount && (
          // Check if discount exists with promoted_amount
          (option.discount.promoted_amount !== undefined && option.discount.promoted_amount > 0) ||
          // Check if discount has any type defined
          option.discount.type ||
          // Check if there's a rate discount
          (option.discount.rate !== undefined && option.discount.rate > 0) ||
          // Check if base_cost is higher than cost (indicating a discount)
          (option.base_cost !== undefined && option.base_cost > optionCost) ||
          // Check if list_cost is higher than cost (indicating a discount)
          (option.list_cost !== undefined && option.list_cost > optionCost)
        )
      );
      
      // Free shipping if:
      // 1. Product declares it AND option cost is 0, OR
      // 2. There's a reputation discount that reduces cost to 0 (seller absorbs the cost)
      const isReallyFreeShipping = (productHasFreeShipping && optionCost === 0) || 
                                   (hasReputationDiscount && optionCost === 0);
      
      console.log('Produto tem frete grátis:', productHasFreeShipping);
      console.log('Opção tem custo zero:', optionCost === 0);
      console.log('Tem desconto por reputação (MELHORADO):', hasReputationDiscount);
      console.log('Base cost maior que cost?', option.base_cost > optionCost);
      console.log('List cost maior que cost?', option.list_cost > optionCost);
      console.log('É realmente frete grátis?', isReallyFreeShipping);
      
      const costCalculation = CostCalculator.calculateRealCost(
        option, 
        isReallyFreeShipping,
        hasReputationDiscount
      );
      
      return {
        method: option.name || 'Mercado Envios',
        carrier: option.shipping_method_id || 'Mercado Envios',
        price: optionCost, // This is what the customer sees/pays
        sellerCost: costCalculation.sellerCost,
        buyerCost: costCalculation.buyerCost,
        deliveryTime: option.estimated_delivery_time?.date || '3-7 dias úteis',
        isFreeShipping: isReallyFreeShipping,
        paidBy: costCalculation.paidBy,
        source: 'direct_api_detailed',
        rawData: option,
        discount: option.discount || null,
        isMercadoEnviosPadrao: isMercadoEnviosPadrao,
        calculationMethod: costCalculation.calculationMethod
      };
    });
  }

  static processFallbackCosts(costs: any[]): ProcessedFreightOption[] {
    return costs.map((cost: any) => ({
      method: cost.method || 'Mercado Envios',
      carrier: cost.method || 'Mercado Envios',
      price: cost.cost || 0,
      sellerCost: cost.seller_cost || 0,
      buyerCost: cost.cost || 0,
      deliveryTime: cost.delivery_time || '3-7 dias úteis',
      isFreeShipping: cost.cost === 0,
      paidBy: cost.cost === 0 ? 'vendedor' : 'comprador',
      source: 'costs_api_with_seller',
      rawData: cost,
      discount: null,
      isMercadoEnviosPadrao: false,
      calculationMethod: 'fallback_api'
    }));
  }
}
