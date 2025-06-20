
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
        (shippingMethodId.includes('mercado_envios') && !shippingMethodId.includes('flex')) ||
        (shippingMethodId === '515462') // ID específico do Mercado Envios Padrão
      );
      
      console.log('É Mercado Envios Padrão?', isMercadoEnviosPadrao);
      
      // CORREÇÃO FUNDAMENTAL: Determine who pays for shipping
      const productHasFreeShipping = product.shipping?.free_shipping === true;
      const optionCost = Number(option.cost) || 0;
      const hasLoyaltyDiscount = option.discount?.type === 'loyal' && option.discount?.promoted_amount > 0;
      
      // FIXED: Free shipping logic - if product declares free shipping OR customer cost is 0 OR there's loyalty discount
      const isReallyFreeShipping = productHasFreeShipping || optionCost === 0 || hasLoyaltyDiscount;
      
      console.log('Produto tem frete grátis:', productHasFreeShipping);
      console.log('Opção tem custo zero:', optionCost === 0);
      console.log('Tem desconto por reputação:', hasLoyaltyDiscount);
      console.log('É realmente frete grátis?', isReallyFreeShipping);
      
      const costCalculation = this.calculateRealCost(
        option, 
        isReallyFreeShipping
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

  private static calculateRealCost(
    option: ShippingOption,
    isReallyFreeShipping: boolean
  ): { sellerCost: number; buyerCost: number; calculationMethod: string; paidBy: string } {
    let sellerCost = 0;
    let buyerCost = 0;
    let calculationMethod = '';
    let paidBy = '';
    
    if (isReallyFreeShipping) {
      // FRETE GRÁTIS - Seller pays the real cost
      paidBy = 'vendedor';
      buyerCost = 0; // Customer pays nothing
      
      // ENHANCED LOGIC FOR REPUTATION DISCOUNT - Handle different percentages
      if (option.discount?.type === 'loyal' && option.discount?.promoted_amount > 0) {
        console.log('🎯 DETECTADO DESCONTO POR REPUTAÇÃO - Calculando valor correto');
        console.log('Desconto detectado:', option.discount);
        
        const baseCost = Number(option.base_cost) || Number(option.list_cost) || 0;
        const discountAmount = Number(option.discount.promoted_amount) || 0;
        const discountRate = Number(option.discount.rate) || 0;
        
        console.log('Base Cost Original:', baseCost);
        console.log('Discount Amount (promoted_amount):', discountAmount);
        console.log('Discount Rate:', discountRate);
        
        // Calculate seller cost with reputation discount
        if (discountRate > 0 && baseCost > 0) {
          // Calculate discount based on rate percentage
          const calculatedDiscount = baseCost * (discountRate / 100);
          sellerCost = baseCost - calculatedDiscount;
          calculationMethod = `base_cost_menos_${discountRate}%_desconto_reputacao`;
          console.log(`✅ VENDEDOR PAGA COM ${discountRate}% DESCONTO: R$ ${baseCost} - ${discountRate}% = R$ ${sellerCost.toFixed(2)}`);
        } else if (discountAmount > 0 && baseCost > 0) {
          // Use promoted_amount as direct discount
          sellerCost = baseCost - discountAmount;
          calculationMethod = 'base_cost_menos_promoted_amount';
          console.log(`✅ VENDEDOR PAGA COM DESCONTO FIXO: R$ ${baseCost} - R$ ${discountAmount} = R$ ${sellerCost.toFixed(2)}`);
        } else if (baseCost > 0) {
          // Fallback to base cost
          sellerCost = baseCost;
          calculationMethod = 'base_cost_sem_desconto_aplicado';
          console.log(`⚠️ VENDEDOR PAGA BASE_COST (sem desconto aplicado): R$ ${sellerCost}`);
        } else {
          // Last resort
          sellerCost = Number(option.cost) || 0;
          calculationMethod = 'cost_fallback_com_desconto';
          console.log(`⚠️ VENDEDOR PAGA COST (último recurso): R$ ${sellerCost}`);
        }
      } else {
        // NO LOYALTY DISCOUNT - use normal hierarchy
        console.log('📋 SEM DESCONTO POR REPUTAÇÃO - Usando hierarquia normal');
        
        if (option.list_cost !== undefined && option.list_cost !== null && option.list_cost > 0) {
          sellerCost = Number(option.list_cost);
          calculationMethod = 'list_cost_original';
          console.log(`✅ VENDEDOR PAGA LIST_COST: R$ ${sellerCost}`);
        } else if (option.base_cost !== undefined && option.base_cost !== null && option.base_cost > 0) {
          sellerCost = Number(option.base_cost);
          calculationMethod = 'base_cost_fallback';
          console.log(`✅ VENDEDOR PAGA BASE_COST: R$ ${sellerCost}`);
        } else if (option.seller_cost !== undefined && option.seller_cost !== null && option.seller_cost > 0) {
          sellerCost = Number(option.seller_cost);
          calculationMethod = 'seller_cost_direto';
          console.log(`✅ VENDEDOR PAGA SELLER_COST: R$ ${sellerCost}`);
        } else {
          sellerCost = Number(option.cost) || 0;
          calculationMethod = 'cost_last_resort';
          console.log(`⚠️ VENDEDOR PAGA COST (último recurso): R$ ${sellerCost}`);
        }
      }
    } else {
      // FRETE PAGO PELO COMPRADOR
      paidBy = 'comprador';
      sellerCost = 0; // Seller pays nothing
      buyerCost = Number(option.cost) || 0; // Customer pays the listed cost
      calculationMethod = 'cost_comprador';
      console.log(`✅ COMPRADOR PAGA: R$ ${buyerCost}`);
    }
    
    console.log(`CUSTO FINAL - Vendedor: R$ ${sellerCost} | Comprador: R$ ${buyerCost} (pago por: ${paidBy}, método: ${calculationMethod})`);
    
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
    
    // Enhanced logic for selecting best option
    const freeShippingOptions = options.filter(option => option.isFreeShipping);
    const paidShippingOptions = options.filter(option => !option.isFreeShipping);
    
    console.log(`Opções com frete grátis: ${freeShippingOptions.length}`);
    console.log(`Opções com frete pago: ${paidShippingOptions.length}`);
    
    // Prioritize free shipping options
    if (freeShippingOptions.length > 0) {
      console.log('📦 PRIORIZANDO FRETE GRÁTIS');
      
      const mercadoEnviosPadraoFree = freeShippingOptions.filter(option => option.isMercadoEnviosPadrao);
      
      if (mercadoEnviosPadraoFree.length > 0) {
        console.log('✅ Encontrado Mercado Envios Padrão com frete grátis');
        // For free shipping, select the one with HIGHEST seller cost (more realistic for reputation discounts)
        return mercadoEnviosPadraoFree.reduce((best: any, current: any) => {
          console.log(`Comparando ME Padrão Grátis: ${current.method} (vendedor paga R$ ${current.sellerCost}) vs ${best.method} (vendedor paga R$ ${best.sellerCost})`);
          return current.sellerCost > best.sellerCost ? current : best;
        });
      }
      
      // Select free shipping option with HIGHEST seller cost (more realistic)
      return freeShippingOptions.reduce((best: any, current: any) => {
        console.log(`Comparando Grátis: ${current.method} (vendedor paga R$ ${current.sellerCost}) vs ${best.method} (vendedor paga R$ ${best.sellerCost})`);
        return current.sellerCost > best.sellerCost ? current : best;
      });
    }
    
    // For paid shipping, prioritize realistic highest cost
    if (paidShippingOptions.length > 0) {
      console.log('💰 PRODUTOS SEM FRETE GRÁTIS - Priorizando custo maior (mais realista)');
      
      // First, try to find Mercado Envios Padrão
      const mercadoEnviosPadrao = paidShippingOptions.filter(option => option.isMercadoEnviosPadrao);
      
      if (mercadoEnviosPadrao.length > 0) {
        console.log('✅ Encontrado Mercado Envios Padrão pago - usando maior custo');
        const selectedOption = mercadoEnviosPadrao.reduce((best: any, current: any) => {
          console.log(`Comparando ME Padrão: ${current.method} (R$ ${current.buyerCost}) vs ${best.method} (R$ ${best.buyerCost})`);
          return current.buyerCost > best.buyerCost ? current : best;
        });
        console.log(`🎯 SELECIONADO ME PADRÃO: ${selectedOption.method} - Comprador paga R$ ${selectedOption.buyerCost}`);
        return selectedOption;
      }
      
      // If no ME Padrão, get the option with highest cost among all
      const selectedOption = paidShippingOptions.reduce((best: any, current: any) => {
        console.log(`Comparando: ${current.method} (R$ ${current.buyerCost}) vs ${best.method} (R$ ${best.buyerCost})`);
        return current.buyerCost > best.buyerCost ? current : best;
      });
      
      console.log(`🎯 SELECIONADO (maior custo): ${selectedOption.method} - Comprador paga R$ ${selectedOption.buyerCost}`);
      return selectedOption;
    }
    
    // Fallback: return first option if no logic above worked
    console.warn('⚠️ FALLBACK: Usando primeira opção disponível');
    return options[0];
  }
}
