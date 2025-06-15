
import { Product, ShippingOption, ProcessedFreightOption } from './types.ts';

export class FreightCalculator {
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
      console.log('Discount:', option.discount);
      
      // Identify if this is Mercado Envios Padrão (not Flex)
      const isMercadoEnviosPadrao = (
        (optionName.includes('mercado envios') && !optionName.includes('flex')) ||
        (optionName.includes('padrão')) ||
        (shippingMethodId.includes('mercado_envios') && !shippingMethodId.includes('flex'))
      );
      
      console.log('É Mercado Envios Padrão?', isMercadoEnviosPadrao);
      
      // Determine who pays for shipping
      const productHasFreeShipping = product.shipping?.free_shipping === true;
      const optionHasFreeShipping = option.cost === 0;
      
      console.log('Produto tem frete grátis:', productHasFreeShipping);
      console.log('Opção tem custo zero:', optionHasFreeShipping);
      
      const costCalculation = this.calculateRealCost(
        option, 
        productHasFreeShipping, 
        optionHasFreeShipping
      );
      
      return {
        method: option.name || 'Mercado Envios',
        carrier: option.shipping_method_id || 'Mercado Envios',
        price: option.cost || 0,
        sellerCost: costCalculation.paidBy === 'vendedor' ? costCalculation.realCost : 0,
        buyerCost: costCalculation.paidBy === 'comprador' ? costCalculation.realCost : option.cost || 0,
        deliveryTime: option.estimated_delivery_time?.date || '3-7 dias úteis',
        isFreeShipping: productHasFreeShipping || optionHasFreeShipping,
        paidBy: costCalculation.paidBy,
        source: 'direct_api_detailed',
        rawData: option,
        discount: option.discount || null,
        isMercadoEnviosPadrao: isMercadoEnviosPadrao,
        calculationMethod: costCalculation.calculationMethod
      };
    });
  }

  private static calculateRealCost(
    option: ShippingOption,
    productHasFreeShipping: boolean,
    optionHasFreeShipping: boolean
  ): { realCost: number; calculationMethod: string; paidBy: string } {
    let realCost = 0;
    let calculationMethod = '';
    let paidBy = '';
    
    if (productHasFreeShipping || optionHasFreeShipping) {
      // FRETE GRÁTIS - Vendedor paga
      paidBy = 'vendedor';
      
      // Priority order for seller cost calculation
      if (option.discount && typeof option.discount === 'object') {
        if (option.discount.promoted_amount && option.discount.promoted_amount > 0) {
          const baseAmount = option.list_cost || option.base_cost || option.cost || 0;
          realCost = Math.max(0, baseAmount - option.discount.promoted_amount);
          calculationMethod = 'base_cost - desconto_promocional';
          console.log(`VENDEDOR PAGA COM DESCONTO: ${baseAmount} - ${option.discount.promoted_amount} = ${realCost}`);
        } else if (option.discount.rate && option.discount.rate > 0) {
          const baseAmount = option.list_cost || option.base_cost || option.cost || 0;
          const discountAmount = baseAmount * (option.discount.rate / 100);
          realCost = Math.max(0, baseAmount - discountAmount);
          calculationMethod = 'base_cost - desconto_percentual';
          console.log(`VENDEDOR PAGA COM DESCONTO %: ${baseAmount} - ${discountAmount} = ${realCost}`);
        }
      }
      
      // If no discount calculated, use available cost fields
      if (realCost === 0) {
        if (option.seller_cost !== undefined && option.seller_cost !== null && option.seller_cost > 0) {
          realCost = option.seller_cost;
          calculationMethod = 'seller_cost_direto';
        } else if (option.base_cost !== undefined && option.base_cost !== null && option.base_cost > 0) {
          realCost = option.base_cost;
          calculationMethod = 'base_cost_direto';
        } else if (option.list_cost !== undefined && option.list_cost !== null && option.list_cost > 0) {
          realCost = option.list_cost;
          calculationMethod = 'list_cost_direto';
        } else {
          // For free shipping, if all else fails, use cost as minimum seller pays
          realCost = option.cost || 0;
          calculationMethod = 'cost_fallback_vendedor';
        }
      }
    } else {
      // FRETE PAGO PELO COMPRADOR
      paidBy = 'comprador';
      realCost = option.cost || 0;
      calculationMethod = 'cost_comprador';
      console.log(`COMPRADOR PAGA: ${realCost}`);
    }
    
    console.log(`CUSTO FINAL: R$ ${realCost} (pago por: ${paidBy}, método: ${calculationMethod})`);
    
    return { realCost, calculationMethod, paidBy };
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

  static filterValidOptions(options: ProcessedFreightOption[]): ProcessedFreightOption[] {
    return options.filter(option => {
      const sellerCostValid = typeof option.sellerCost === 'number' && option.sellerCost >= 0;
      const buyerCostValid = typeof option.buyerCost === 'number' && option.buyerCost >= 0;
      const priceValid = typeof option.price === 'number' && option.price >= 0;
      
      const isValid = sellerCostValid && buyerCostValid && priceValid;
      
      if (!isValid) {
        console.warn('Opção filtrada por valores inválidos:', option);
      }
      
      return isValid;
    });
  }

  static selectBestOption(options: ProcessedFreightOption[]): ProcessedFreightOption {
    // Prioritize Mercado Envios Padrão, then find the most appropriate option
    const mercadoEnviosPadraoOptions = options.filter(option => option.isMercadoEnviosPadrao);
    const optionsToConsider = mercadoEnviosPadraoOptions.length > 0 ? mercadoEnviosPadraoOptions : options;

    console.log(`Considerando ${optionsToConsider.length} opções válidas${mercadoEnviosPadraoOptions.length > 0 ? ' (priorizando Mercado Envios Padrão)' : ''}`);

    // Select the best option based on who pays
    return optionsToConsider.reduce((best: any, current: any) => {
      console.log(`Comparando: ${current.method} (${current.paidBy} paga R$ ${current.paidBy === 'vendedor' ? current.sellerCost : current.buyerCost}) vs ${best.method} (${best.paidBy} paga R$ ${best.paidBy === 'vendedor' ? best.sellerCost : best.buyerCost})`);
      
      // For seller-paid shipping, choose lowest seller cost
      if (current.paidBy === 'vendedor' && best.paidBy === 'vendedor') {
        return current.sellerCost < best.sellerCost ? current : best;
      }
      
      // For buyer-paid shipping, choose lowest buyer cost
      if (current.paidBy === 'comprador' && best.paidBy === 'comprador') {
        return current.buyerCost < best.buyerCost ? current : best;
      }
      
      // Prefer seller-paid over buyer-paid if costs are similar
      if (current.paidBy === 'vendedor' && best.paidBy === 'comprador') {
        return current;
      }
      
      return best;
    });
  }
}
