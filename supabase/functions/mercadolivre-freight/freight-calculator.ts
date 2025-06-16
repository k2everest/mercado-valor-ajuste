
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
      
      // If product has free shipping AND option cost is 0, then seller pays
      // If product doesn't have free shipping OR option cost > 0, then buyer pays
      const isReallyFreeShipping = productHasFreeShipping && optionCost === 0;
      
      console.log('Produto tem frete grátis:', productHasFreeShipping);
      console.log('Opção tem custo zero:', optionCost === 0);
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
      
      // CORREÇÃO CRUCIAL PARA DESCONTO POR REPUTAÇÃO
      // When there's a loyalty discount, seller ALWAYS pays the base_cost (pre-discount value)
      if (option.discount?.type === 'loyal' && option.discount?.promoted_amount > 0) {
        console.log('🎯 DETECTADO DESCONTO POR REPUTAÇÃO - Usando base_cost');
        
        // PRIORITY 1: base_cost (real value seller pays before discount)
        if (option.base_cost !== undefined && option.base_cost !== null && option.base_cost > 0) {
          sellerCost = Number(option.base_cost);
          calculationMethod = 'base_cost_com_desconto_reputacao';
          console.log(`VENDEDOR PAGA BASE_COST (valor real antes do desconto): R$ ${sellerCost}`);
        } 
        // FALLBACK: If no base_cost, use list_cost
        else if (option.list_cost !== undefined && option.list_cost !== null && option.list_cost > 0) {
          sellerCost = Number(option.list_cost);
          calculationMethod = 'list_cost_com_desconto_reputacao';
          console.log(`VENDEDOR PAGA LIST_COST (fallback): R$ ${sellerCost}`);
        } 
        // LAST RESORT: use cost even with discount
        else {
          sellerCost = Number(option.cost) || 0;
          calculationMethod = 'cost_fallback_com_desconto';
          console.log(`VENDEDOR PAGA COST (último recurso): R$ ${sellerCost}`);
        }
      } else {
        // NO LOYALTY DISCOUNT - use normal hierarchy
        console.log('📋 SEM DESCONTO POR REPUTAÇÃO - Usando hierarquia normal');
        
        if (option.list_cost !== undefined && option.list_cost !== null && option.list_cost > 0) {
          sellerCost = Number(option.list_cost);
          calculationMethod = 'list_cost_original';
          console.log(`VENDEDOR PAGA LIST_COST: R$ ${sellerCost}`);
        } else if (option.base_cost !== undefined && option.base_cost !== null && option.base_cost > 0) {
          sellerCost = Number(option.base_cost);
          calculationMethod = 'base_cost_fallback';
          console.log(`VENDEDOR PAGA BASE_COST: R$ ${sellerCost}`);
        } else if (option.seller_cost !== undefined && option.seller_cost !== null && option.seller_cost > 0) {
          sellerCost = Number(option.seller_cost);
          calculationMethod = 'seller_cost_direto';
          console.log(`VENDEDOR PAGA SELLER_COST: R$ ${sellerCost}`);
        } else {
          sellerCost = Number(option.cost) || 0;
          calculationMethod = 'cost_last_resort';
          console.log(`VENDEDOR PAGA COST (último recurso): R$ ${sellerCost}`);
        }
      }
    } else {
      // FRETE PAGO PELO COMPRADOR
      paidBy = 'comprador';
      sellerCost = 0; // Seller pays nothing
      buyerCost = Number(option.cost) || 0; // Customer pays the listed cost
      calculationMethod = 'cost_comprador';
      console.log(`COMPRADOR PAGA: R$ ${buyerCost}`);
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
    // Prioritize Mercado Envios Padrão first
    const mercadoEnviosPadraoOptions = options.filter(option => option.isMercadoEnviosPadrao);
    
    console.log(`Opções Mercado Envios Padrão encontradas: ${mercadoEnviosPadraoOptions.length}`);
    
    if (mercadoEnviosPadraoOptions.length > 0) {
      console.log('Priorizando Mercado Envios Padrão');
      
      // Among Mercado Envios Padrão options, select the one with lowest cost for the payer
      return mercadoEnviosPadraoOptions.reduce((best: any, current: any) => {
        console.log(`Comparando ME Padrão: ${current.method} (vendedor: R$ ${current.sellerCost}, comprador: R$ ${current.buyerCost}) vs ${best.method} (vendedor: R$ ${best.sellerCost}, comprador: R$ ${best.buyerCost})`);
        
        if (current.paidBy === 'vendedor' && best.paidBy === 'vendedor') {
          return current.sellerCost < best.sellerCost ? current : best;
        }
        
        if (current.paidBy === 'comprador' && best.paidBy === 'comprador') {
          return current.buyerCost < best.buyerCost ? current : best;
        }
        
        // Prefer seller-paid over buyer-paid
        return current.paidBy === 'vendedor' ? current : best;
      });
    }
    
    // If no Mercado Envios Padrão, select from all options
    console.log(`Selecionando entre todas as ${options.length} opções`);
    
    return options.reduce((best: any, current: any) => {
      console.log(`Comparando: ${current.method} (vendedor: R$ ${current.sellerCost}, comprador: R$ ${current.buyerCost}) vs ${best.method} (vendedor: R$ ${best.sellerCost}, comprador: R$ ${best.buyerCost})`);
      
      // For seller-paid shipping, choose lowest seller cost
      if (current.paidBy === 'vendedor' && best.paidBy === 'vendedor') {
        return current.sellerCost < best.sellerCost ? current : best;
      }
      
      // For buyer-paid shipping, choose lowest buyer cost
      if (current.paidBy === 'comprador' && best.paidBy === 'comprador') {
        return current.buyerCost < best.buyerCost ? current : best;
      }
      
      // Prefer seller-paid over buyer-paid
      if (current.paidBy === 'vendedor' && best.paidBy === 'comprador') {
        return current;
      }
      
      return best;
    });
  }
}
