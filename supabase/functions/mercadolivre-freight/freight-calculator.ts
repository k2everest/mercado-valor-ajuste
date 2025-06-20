
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
      
      const costCalculation = this.calculateRealCost(
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

  private static calculateRealCost(
    option: ShippingOption,
    isReallyFreeShipping: boolean,
    hasReputationDiscount: boolean = false
  ): { sellerCost: number; buyerCost: number; calculationMethod: string; paidBy: string } {
    let sellerCost = 0;
    let buyerCost = 0;
    let calculationMethod = '';
    let paidBy = '';
    
    // PRIORITY 1: Handle reputation discount scenarios (seller always pays when there's a discount)
    if (hasReputationDiscount) {
      console.log('🎯 DETECTADO DESCONTO POR REPUTAÇÃO DO VENDEDOR - Vendedor sempre paga o custo real');
      paidBy = 'vendedor';
      buyerCost = Number(option.cost) || 0; // Customer pays the discounted amount (could be 0)
      
      // ALWAYS prioritize base_cost when there's a reputation discount
      if (option.base_cost !== undefined && option.base_cost !== null && option.base_cost > 0) {
        sellerCost = Number(option.base_cost);
        calculationMethod = 'base_cost_com_desconto_reputacao';
        console.log(`✅ VENDEDOR PAGA BASE_COST (valor real antes do desconto por reputação): R$ ${sellerCost}`);
      } 
      // If base_cost is not available, try to calculate from other fields
      else if (option.list_cost !== undefined && option.list_cost !== null && option.list_cost > Number(option.cost)) {
        sellerCost = Number(option.list_cost);
        calculationMethod = 'list_cost_com_desconto_reputacao';
        console.log(`✅ VENDEDOR PAGA LIST_COST (valor antes do desconto): R$ ${sellerCost}`);
      }
      // Calculate from cost + discount amount if available
      else if (option.discount?.promoted_amount && option.cost !== undefined) {
        sellerCost = Number(option.cost) + Number(option.discount.promoted_amount);
        calculationMethod = 'cost_plus_discount_amount';
        console.log(`✅ VENDEDOR PAGA COST + DESCONTO REPUTAÇÃO: R$ ${option.cost} + R$ ${option.discount.promoted_amount} = R$ ${sellerCost}`);
      }
      // LAST RESORT: use a reasonable estimate based on cost
      else {
        sellerCost = Math.max(Number(option.cost) || 0, 10); // At least R$ 10 or current cost
        calculationMethod = 'desconto_reputacao_fallback_minimo';
        console.log(`⚠️ VENDEDOR PAGA VALOR ESTIMADO (desconto reputação): R$ ${sellerCost}`);
      }
    }
    // PRIORITY 2: Handle traditional free shipping (product declares it)
    else if (isReallyFreeShipping) {
      console.log('📦 FRETE GRÁTIS TRADICIONAL - Vendedor paga custo normal');
      paidBy = 'vendedor';
      buyerCost = 0; // Customer pays nothing
      
      if (option.list_cost !== undefined && option.list_cost !== null && option.list_cost > 0) {
        sellerCost = Number(option.list_cost);
        calculationMethod = 'list_cost_frete_gratis';
        console.log(`✅ VENDEDOR PAGA LIST_COST: R$ ${sellerCost}`);
      } else if (option.base_cost !== undefined && option.base_cost !== null && option.base_cost > 0) {
        sellerCost = Number(option.base_cost);
        calculationMethod = 'base_cost_frete_gratis';
        console.log(`✅ VENDEDOR PAGA BASE_COST: R$ ${sellerCost}`);
      } else if (option.seller_cost !== undefined && option.seller_cost !== null && option.seller_cost > 0) {
        sellerCost = Number(option.seller_cost);
        calculationMethod = 'seller_cost_direto';
        console.log(`✅ VENDEDOR PAGA SELLER_COST: R$ ${sellerCost}`);
      } else {
        sellerCost = Math.max(Number(option.cost) || 0, 10); // At least R$ 10
        calculationMethod = 'frete_gratis_fallback';
        console.log(`⚠️ VENDEDOR PAGA VALOR ESTIMADO: R$ ${sellerCost}`);
      }
    } else {
      // PRIORITY 3: FRETE PAGO PELO COMPRADOR (sem desconto)
      paidBy = 'comprador';
      sellerCost = 0; // Seller pays nothing
      buyerCost = Number(option.cost) || 0; // Customer pays the listed cost
      calculationMethod = 'cost_comprador_sem_desconto';
      console.log(`✅ COMPRADOR PAGA (sem desconto): R$ ${buyerCost}`);
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
    
    // Enhanced logic for selecting best option - prioritize seller-paid options (loyalty discounts)
    const sellerPaidOptions = options.filter(option => option.paidBy === 'vendedor');
    const buyerPaidOptions = options.filter(option => option.paidBy === 'comprador');
    
    console.log(`Opções pagas pelo vendedor: ${sellerPaidOptions.length}`);
    console.log(`Opções pagas pelo comprador: ${buyerPaidOptions.length}`);
    
    // PRIORITY 1: Seller-paid options (loyalty discounts or free shipping)
    if (sellerPaidOptions.length > 0) {
      console.log('💎 PRIORIZANDO OPÇÕES PAGAS PELO VENDEDOR (desconto/frete grátis)');
      
      const mercadoEnviosPadraoSeller = sellerPaidOptions.filter(option => option.isMercadoEnviosPadrao);
      
      if (mercadoEnviosPadraoSeller.length > 0) {
        console.log('✅ Encontrado Mercado Envios Padrão pago pelo vendedor');
        // For seller-paid, select the one with HIGHEST seller cost (most realistic)
        return mercadoEnviosPadraoSeller.reduce((best: any, current: any) => {
          console.log(`Comparando ME Padrão Vendedor: ${current.method} (vendedor paga R$ ${current.sellerCost}) vs ${best.method} (vendedor paga R$ ${best.sellerCost})`);
          return current.sellerCost > best.sellerCost ? current : best;
        });
      }
      
      // Select seller-paid option with HIGHEST seller cost (more realistic for discounts)
      return sellerPaidOptions.reduce((best: any, current: any) => {
        console.log(`Comparando Vendedor paga: ${current.method} (R$ ${current.sellerCost}) vs ${best.method} (R$ ${best.sellerCost})`);
        return current.sellerCost > best.sellerCost ? current : best;
      });
    }
    
    // PRIORITY 2: For buyer-paid shipping, prioritize realistic highest cost
    if (buyerPaidOptions.length > 0) {
      console.log('💰 PRODUTOS SEM FRETE GRÁTIS - Priorizando custo maior (mais realista)');
      
      // First, try to find Mercado Envios Padrão
      const mercadoEnviosPadrao = buyerPaidOptions.filter(option => option.isMercadoEnviosPadrao);
      
      if (mercadoEnviosPadrao.length > 0) {
        console.log('✅ Encontrado Mercado Envios Padrão pago pelo comprador');
        const selectedOption = mercadoEnviosPadrao.reduce((best: any, current: any) => {
          console.log(`Comparando ME Padrão Comprador: ${current.method} (R$ ${current.buyerCost}) vs ${best.method} (R$ ${best.buyerCost})`);
          return current.buyerCost > best.buyerCost ? current : best;
        });
        console.log(`🎯 SELECIONADO ME PADRÃO: ${selectedOption.method} - Comprador paga R$ ${selectedOption.buyerCost}`);
        return selectedOption;
      }
      
      // If no ME Padrão, get the option with highest cost among all
      const selectedOption = buyerPaidOptions.reduce((best: any, current: any) => {
        console.log(`Comparando Comprador: ${current.method} (R$ ${current.buyerCost}) vs ${best.method} (R$ ${best.buyerCost})`);
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
