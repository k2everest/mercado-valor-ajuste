
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
      
      // FIXED: Better free shipping detection
      const optionCost = Number(option.cost) || 0;
      const hasReputationDiscount = option.discount?.type === 'loyal' && 
                                   (option.discount?.rate > 0 || option.discount?.promoted_amount > 0);
      
      // Free shipping occurs when cost is 0 OR when there's reputation discount
      const isFreeShipping = optionCost === 0 || hasReputationDiscount;
      
      console.log('Custo da opção:', optionCost);
      console.log('Tem desconto por reputação:', hasReputationDiscount);
      console.log('É frete grátis:', isFreeShipping);
      
      const costCalculation = this.calculateRealCost(option, isFreeShipping);
      
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
    isFreeShipping: boolean
  ): { sellerCost: number; buyerCost: number; calculationMethod: string; paidBy: string } {
    let sellerCost = 0;
    let buyerCost = 0;
    let calculationMethod = '';
    let paidBy = '';
    
    if (isFreeShipping) {
      // FREE SHIPPING - Seller pays the real cost
      paidBy = 'vendedor';
      buyerCost = 0; // Customer pays nothing
      
      // FIXED: Correct reputation discount calculation
      if (option.discount?.type === 'loyal') {
        console.log('🎯 CALCULANDO DESCONTO POR REPUTAÇÃO');
        console.log('Desconto detectado:', option.discount);
        
        const baseCost = Number(option.base_cost) || Number(option.list_cost) || 0;
        const discountRate = Number(option.discount.rate) || 0;
        const promotedAmount = Number(option.discount.promoted_amount) || 0;
        
        console.log('Base Cost:', baseCost);
        console.log('Discount Rate (%):', discountRate);
        console.log('Promoted Amount:', promotedAmount);
        
        if (discountRate > 0 && baseCost > 0) {
          // Apply percentage discount: base_cost - (base_cost * rate / 100)
          const discountAmount = baseCost * (discountRate / 100);
          sellerCost = baseCost - discountAmount;
          calculationMethod = `base_cost_com_${discountRate}%_desconto_reputacao`;
          console.log(`✅ VENDEDOR PAGA COM ${discountRate}% DESCONTO: R$ ${baseCost} - R$ ${discountAmount.toFixed(2)} = R$ ${sellerCost.toFixed(2)}`);
        } else if (promotedAmount > 0) {
          // Use promoted amount as the discounted price
          sellerCost = promotedAmount;
          calculationMethod = 'promoted_amount_desconto_reputacao';
          console.log(`✅ VENDEDOR PAGA PROMOTED_AMOUNT: R$ ${sellerCost.toFixed(2)}`);
        } else if (baseCost > 0) {
          // Fallback to base cost without discount
          sellerCost = baseCost;
          calculationMethod = 'base_cost_sem_desconto_aplicado';
          console.log(`⚠️ VENDEDOR PAGA BASE_COST (sem desconto): R$ ${sellerCost}`);
        } else {
          // Last resort
          sellerCost = Number(option.cost) || 0;
          calculationMethod = 'cost_fallback_desconto_reputacao';
          console.log(`⚠️ VENDEDOR PAGA COST (último recurso): R$ ${sellerCost}`);
        }
      } else {
        // NO REPUTATION DISCOUNT - use cost hierarchy
        console.log('📋 SEM DESCONTO POR REPUTAÇÃO - Usando hierarquia de custos');
        
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
          // Last resort for free shipping
          sellerCost = Math.max(Number(option.cost) || 0, 10); // Minimum realistic cost
          calculationMethod = 'estimativa_minima_frete_gratis';
          console.log(`⚠️ VENDEDOR PAGA ESTIMATIVA MÍNIMA: R$ ${sellerCost}`);
        }
      }
    } else {
      // PAID SHIPPING - Customer pays
      paidBy = 'comprador';
      sellerCost = 0; // Seller pays nothing
      buyerCost = Number(option.cost) || 0; // Customer pays the listed cost
      calculationMethod = 'frete_pago_comprador';
      console.log(`✅ COMPRADOR PAGA: R$ ${buyerCost}`);
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
    
    console.log(`Opções com frete grátis: ${freeShippingOptions.length}`);
    console.log(`Opções com frete pago: ${paidShippingOptions.length}`);
    
    // FIXED: Prioritize free shipping options with better logic
    if (freeShippingOptions.length > 0) {
      console.log('📦 PRIORIZANDO FRETE GRÁTIS');
      
      // First, try to find Mercado Envios Padrão with free shipping
      const mercadoEnviosPadraoFree = freeShippingOptions.filter(option => option.isMercadoEnviosPadrao);
      
      if (mercadoEnviosPadraoFree.length > 0) {
        console.log('✅ Encontrado Mercado Envios Padrão com frete grátis');
        // Select the one with highest seller cost (most realistic)
        const selected = mercadoEnviosPadraoFree.reduce((best: any, current: any) => {
          console.log(`Comparando ME Padrão: ${current.method} (vendedor paga R$ ${current.sellerCost}) vs ${best.method} (vendedor paga R$ ${best.sellerCost})`);
          return current.sellerCost >= best.sellerCost ? current : best;
        });
        console.log(`🎯 SELECIONADO ME PADRÃO GRÁTIS: ${selected.method} - Vendedor paga R$ ${selected.sellerCost.toFixed(2)}`);
        return selected;
      }
      
      // If no ME Padrão, select free shipping option with highest seller cost
      const selected = freeShippingOptions.reduce((best: any, current: any) => {
        console.log(`Comparando Grátis: ${current.method} (vendedor paga R$ ${current.sellerCost}) vs ${best.method} (vendedor paga R$ ${best.sellerCost})`);
        return current.sellerCost >= best.sellerCost ? current : best;
      });
      console.log(`🎯 SELECIONADO FRETE GRÁTIS: ${selected.method} - Vendedor paga R$ ${selected.sellerCost.toFixed(2)}`);
      return selected;
    }
    
    // For paid shipping, prioritize higher cost (more realistic)
    if (paidShippingOptions.length > 0) {
      console.log('💰 PRODUTOS SEM FRETE GRÁTIS - Priorizando custo maior');
      
      // First, try to find Mercado Envios Padrão
      const mercadoEnviosPadrao = paidShippingOptions.filter(option => option.isMercadoEnviosPadrao);
      
      if (mercadoEnviosPadrao.length > 0) {
        console.log('✅ Encontrado Mercado Envios Padrão pago');
        const selected = mercadoEnviosPadrao.reduce((best: any, current: any) => {
          console.log(`Comparando ME Padrão: ${current.method} (R$ ${current.buyerCost}) vs ${best.method} (R$ ${best.buyerCost})`);
          return current.buyerCost >= best.buyerCost ? current : best;
        });
        console.log(`🎯 SELECIONADO ME PADRÃO: ${selected.method} - Comprador paga R$ ${selected.buyerCost.toFixed(2)}`);
        return selected;
      }
      
      // Select the option with highest buyer cost
      const selected = paidShippingOptions.reduce((best: any, current: any) => {
        console.log(`Comparando: ${current.method} (R$ ${current.buyerCost}) vs ${best.method} (R$ ${best.buyerCost})`);
        return current.buyerCost >= best.buyerCost ? current : best;
      });
      
      console.log(`🎯 SELECIONADO (maior custo): ${selected.method} - Comprador paga R$ ${selected.buyerCost.toFixed(2)}`);
      return selected;
    }
    
    // Fallback: return first option
    console.warn('⚠️ FALLBACK: Usando primeira opção disponível');
    return options[0];
  }
}
