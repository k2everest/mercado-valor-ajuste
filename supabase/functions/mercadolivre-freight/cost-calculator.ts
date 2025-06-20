
import { ShippingOption } from './types.ts';

export class CostCalculator {
  static calculateRealCost(
    option: ShippingOption,
    isReallyFreeShipping: boolean,
    hasReputationDiscount: boolean = false
  ): { sellerCost: number; buyerCost: number; calculationMethod: string; paidBy: string } {
    let sellerCost = 0;
    let buyerCost = 0;
    let calculationMethod = '';
    let paidBy = '';
    
    // PRIORITY 1: Handle reputation discount scenarios 
    if (hasReputationDiscount) {
      console.log('🎯 DETECTADO DESCONTO POR REPUTAÇÃO - Calculando custo real do vendedor');
      paidBy = 'vendedor';
      buyerCost = Number(option.cost) || 0; // Customer pays the discounted amount
      
      // CORREÇÃO FUNDAMENTAL: Com desconto por reputação, vendedor paga base_cost MENOS promoted_amount
      // Exemplo: base_cost R$ 46,90 - promoted_amount R$ 23,45 = vendedor paga R$ 23,45
      if (option.discount && option.discount.promoted_amount > 0 && option.base_cost > 0) {
        const realSellerCost = Number(option.base_cost) - Number(option.discount.promoted_amount);
        sellerCost = Math.max(realSellerCost, 0); // Never negative
        calculationMethod = 'desconto_reputacao_base_menos_promoted';
        console.log(`✅ VENDEDOR PAGA (base_cost R$ ${option.base_cost} - promoted_amount R$ ${option.discount.promoted_amount}): R$ ${sellerCost}`);
      } else if (option.base_cost > 0) {
        sellerCost = Number(option.base_cost);
        calculationMethod = 'desconto_reputacao_base_cost_full';
        console.log(`✅ VENDEDOR PAGA BASE_COST COMPLETO: R$ ${sellerCost}`);
      } else {
        sellerCost = Number(option.cost) || 0;
        calculationMethod = 'desconto_reputacao_cost_fallback';
        console.log(`⚠️ VENDEDOR PAGA COST (fallback): R$ ${sellerCost}`);
      }
    }
    // PRIORITY 2: Handle traditional free shipping (product declares it)
    else if (isReallyFreeShipping) {
      console.log('📦 FRETE GRÁTIS TRADICIONAL - Vendedor paga custo normal');
      paidBy = 'vendedor';
      buyerCost = 0; // Customer pays nothing
      
      // Para frete grátis tradicional, usar list_cost (valor real do vendedor)
      if (option.list_cost !== undefined && option.list_cost !== null && option.list_cost > 0) {
        sellerCost = Number(option.list_cost);
        calculationMethod = 'list_cost_frete_gratis_valor_real';
        console.log(`✅ VENDEDOR PAGA LIST_COST (VALOR REAL): R$ ${sellerCost}`);
      } else if (option.seller_cost !== undefined && option.seller_cost !== null && option.seller_cost > 0) {
        sellerCost = Number(option.seller_cost);
        calculationMethod = 'seller_cost_direto';
        console.log(`✅ VENDEDOR PAGA SELLER_COST: R$ ${sellerCost}`);
      } else {
        // Último recurso: estimar baseado no custo que seria cobrado do cliente
        sellerCost = Math.max(Number(option.cost) || 0, 10); // At least R$ 10
        calculationMethod = 'frete_gratis_fallback_estimado';
        console.log(`⚠️ VENDEDOR PAGA VALOR ESTIMADO (sem list_cost disponível): R$ ${sellerCost}`);
      }
    } else {
      // PRIORITY 3: FRETE PAGO PELO COMPRADOR (sem desconto, sem frete grátis)
      paidBy = 'comprador';
      sellerCost = 0; // Seller pays nothing
      buyerCost = Number(option.cost) || 0; // Customer pays the listed cost
      calculationMethod = 'cost_comprador_sem_desconto';
      console.log(`✅ COMPRADOR PAGA (sem desconto): R$ ${buyerCost}`);
    }
    
    console.log(`CUSTO FINAL - Vendedor: R$ ${sellerCost} | Comprador: R$ ${buyerCost} (pago por: ${paidBy}, método: ${calculationMethod})`);
    
    return { sellerCost, buyerCost, calculationMethod, paidBy };
  }
}
