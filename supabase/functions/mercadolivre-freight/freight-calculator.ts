
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
      
      // Identify shipping method types
      const isMercadoEnviosPadrao = (
        shippingMethodId === '515462' || // ID específico do Mercado Envios Padrão
        (optionName.includes('mercado envios') && !optionName.includes('flex') && !optionName.includes('priorit'))
      );
      
      const isPrioritario = (
        shippingMethodId === '512746' || // ID específico do Prioritário
        optionName.includes('priorit')
      );
      
      const isNormal = (
        shippingMethodId === '100009' || // ID específico do Normal/Standard
        optionName.includes('normal')
      );
      
      console.log('É Mercado Envios Padrão?', isMercadoEnviosPadrao);
      console.log('É Prioritário?', isPrioritario);
      console.log('É Normal?', isNormal);
      
      // FIXED: Correct free shipping detection - only when customer pays 0
      const optionCost = Number(option.cost) || 0;
      const isFreeShipping = optionCost === 0; // Customer pays nothing
      
      // Separate reputation discount detection
      const hasReputationDiscount = option.discount?.type === 'loyal' && 
                                   (option.discount?.rate > 0 || option.discount?.promoted_amount > 0);
      
      console.log('Custo da opção (cliente):', optionCost);
      console.log('É frete grátis (cliente paga 0):', isFreeShipping);
      console.log('Tem desconto por reputação (vendedor):', hasReputationDiscount);
      
      const costCalculation = this.calculateRealCost(option, isFreeShipping, hasReputationDiscount);
      
      return {
        method: option.name || 'Mercado Envios',
        carrier: option.shipping_method_id || 'Mercado Envios',
        price: optionCost, // Customer cost
        sellerCost: costCalculation.sellerCost,
        buyerCost: costCalculation.buyerCost,
        deliveryTime: option.estimated_delivery_time?.date || '3-7 dias úteis',
        isFreeShipping: isFreeShipping,
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
    isFreeShipping: boolean,
    hasReputationDiscount: boolean
  ): { sellerCost: number; buyerCost: number; calculationMethod: string; paidBy: string } {
    let sellerCost = 0;
    let buyerCost = 0;
    let calculationMethod = '';
    let paidBy = '';
    
    const optionCost = Number(option.cost) || 0;
    
    if (isFreeShipping) {
      // FREE SHIPPING - Customer pays 0, seller pays the real cost
      paidBy = 'vendedor';
      buyerCost = 0; // Customer pays nothing
      
      console.log('🆓 FRETE GRÁTIS - Cliente paga R$ 0');
      
      if (hasReputationDiscount) {
        // Seller has reputation discount on the freight cost
        console.log('🎯 VENDEDOR TEM DESCONTO POR REPUTAÇÃO');
        console.log('Desconto detectado:', option.discount);
        
        const baseCost = Number(option.base_cost) || Number(option.list_cost) || 0;
        const discountRate = Number(option.discount.rate) || 0;
        
        console.log('Base Cost para desconto:', baseCost);
        console.log('Discount Rate (%):', discountRate);
        
        if (discountRate > 0 && baseCost > 0) {
          // Apply percentage discount: base_cost - (base_cost * rate / 100)
          const discountAmount = baseCost * (discountRate / 100);
          sellerCost = baseCost - discountAmount;
          calculationMethod = `base_cost_com_${discountRate}%_desconto_reputacao`;
          console.log(`✅ VENDEDOR PAGA COM ${discountRate}% DESCONTO: R$ ${baseCost} - R$ ${discountAmount.toFixed(2)} = R$ ${sellerCost.toFixed(2)}`);
        } else {
          // Fallback to base cost
          sellerCost = baseCost;
          calculationMethod = 'base_cost_sem_desconto_aplicado';
          console.log(`⚠️ VENDEDOR PAGA BASE_COST (sem desconto aplicado): R$ ${sellerCost}`);
        }
      } else {
        // NO REPUTATION DISCOUNT - use cost hierarchy for seller
        console.log('📋 SEM DESCONTO POR REPUTAÇÃO - Vendedor paga valor real');
        
        if (option.base_cost !== undefined && option.base_cost !== null && option.base_cost > 0) {
          sellerCost = Number(option.base_cost);
          calculationMethod = 'base_cost_frete_gratis';
          console.log(`✅ VENDEDOR PAGA BASE_COST: R$ ${sellerCost}`);
        } else if (option.list_cost !== undefined && option.list_cost !== null && option.list_cost > 0) {
          sellerCost = Number(option.list_cost);
          calculationMethod = 'list_cost_frete_gratis';
          console.log(`✅ VENDEDOR PAGA LIST_COST: R$ ${sellerCost}`);
        } else if (option.seller_cost !== undefined && option.seller_cost !== null && option.seller_cost > 0) {
          sellerCost = Number(option.seller_cost);
          calculationMethod = 'seller_cost_direto';
          console.log(`✅ VENDEDOR PAGA SELLER_COST: R$ ${sellerCost}`);
        } else {
          // Last resort for free shipping - estimate minimum cost
          sellerCost = Math.max(optionCost, 10); // Minimum realistic cost
          calculationMethod = 'estimativa_minima_frete_gratis';
          console.log(`⚠️ VENDEDOR PAGA ESTIMATIVA MÍNIMA: R$ ${sellerCost}`);
        }
      }
    } else {
      // PAID SHIPPING - Customer pays, seller usually pays nothing
      paidBy = 'comprador';
      buyerCost = optionCost; // Customer pays the listed cost
      
      if (hasReputationDiscount) {
        // Even with paid shipping, seller might have some discount benefits
        console.log('💰 FRETE PAGO COM DESCONTO DE REPUTAÇÃO PARA VENDEDOR');
        sellerCost = 0; // Usually seller pays nothing when customer pays
        calculationMethod = 'frete_pago_comprador_com_desconto_vendedor';
      } else {
        sellerCost = 0; // Seller pays nothing
        calculationMethod = 'frete_pago_comprador';
      }
      
      console.log(`💰 COMPRADOR PAGA: R$ ${buyerCost}`);
    }
    
    console.log(`CUSTO FINAL - Vendedor: R$ ${sellerCost.toFixed(2)} | Comprador: R$ ${buyerCost.toFixed(2)} (pago por: ${paidBy}, método: ${calculationMethod})`);
    
    return { sellerCost, buyerCost, calculationMethod, paidBy };
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
    console.log(`🔍 SELECIONANDO MELHOR OPÇÃO ENTRE ${options.length} opções válidas`);
    
    const freeShippingOptions = options.filter(option => option.isFreeShipping);
    const paidShippingOptions = options.filter(option => !option.isFreeShipping);
    
    console.log(`Opções com frete grátis (cliente paga 0): ${freeShippingOptions.length}`);
    console.log(`Opções com frete pago (cliente paga): ${paidShippingOptions.length}`);
    
    // FIXED: Prioritize free shipping options (customer pays 0)
    if (freeShippingOptions.length > 0) {
      console.log('🆓 PRIORIZANDO FRETE GRÁTIS (cliente não paga)');
      
      // First, try to find Mercado Envios Padrão with free shipping
      const mercadoEnviosPadraoFree = freeShippingOptions.filter(option => option.isMercadoEnviosPadrao);
      
      if (mercadoEnviosPadraoFree.length > 0) {
        console.log('✅ Encontrado Mercado Envios Padrão com frete grátis');
        // Select the one with LOWEST seller cost (better for seller)
        const selected = mercadoEnviosPadraoFree.reduce((best: any, current: any) => {
          console.log(`Comparando ME Padrão: ${current.method} (vendedor paga R$ ${current.sellerCost}) vs ${best.method} (vendedor paga R$ ${best.sellerCost})`);
          return current.sellerCost <= best.sellerCost ? current : best;
        });
        console.log(`🎯 SELECIONADO ME PADRÃO GRÁTIS: ${selected.method} - Vendedor paga R$ ${selected.sellerCost.toFixed(2)}`);
        return selected;
      }
      
      // If no ME Padrão, select free shipping option with LOWEST seller cost
      const selected = freeShippingOptions.reduce((best: any, current: any) => {
        console.log(`Comparando Grátis: ${current.method} (vendedor paga R$ ${current.sellerCost}) vs ${best.method} (vendedor paga R$ ${best.sellerCost})`);
        return current.sellerCost <= best.sellerCost ? current : best;
      });
      console.log(`🎯 SELECIONADO FRETE GRÁTIS: ${selected.method} - Vendedor paga R$ ${selected.sellerCost.toFixed(2)}`);
      return selected;
    }
    
    // For paid shipping, prioritize lower cost for customer
    if (paidShippingOptions.length > 0) {
      console.log('💰 SEM FRETE GRÁTIS - Priorizando menor custo para cliente');
      
      // First, try to find Mercado Envios Padrão
      const mercadoEnviosPadrao = paidShippingOptions.filter(option => option.isMercadoEnviosPadrao);
      
      if (mercadoEnviosPadrao.length > 0) {
        console.log('✅ Encontrado Mercado Envios Padrão pago');
        const selected = mercadoEnviosPadrao.reduce((best: any, current: any) => {
          console.log(`Comparando ME Padrão: ${current.method} (cliente paga R$ ${current.buyerCost}) vs ${best.method} (cliente paga R$ ${best.buyerCost})`);
          return current.buyerCost <= best.buyerCost ? current : best;
        });
        console.log(`🎯 SELECIONADO ME PADRÃO: ${selected.method} - Cliente paga R$ ${selected.buyerCost.toFixed(2)}`);
        return selected;
      }
      
      // Select the option with lowest buyer cost
      const selected = paidShippingOptions.reduce((best: any, current: any) => {
        console.log(`Comparando: ${current.method} (cliente paga R$ ${current.buyerCost}) vs ${best.method} (cliente paga R$ ${best.buyerCost})`);
        return current.buyerCost <= best.buyerCost ? current : best;
      });
      
      console.log(`🎯 SELECIONADO (menor custo cliente): ${selected.method} - Cliente paga R$ ${selected.buyerCost.toFixed(2)}`);
      return selected;
    }
    
    // Fallback: return first option
    console.warn('⚠️ FALLBACK: Usando primeira opção disponível');
    return options[0];
  }
}
