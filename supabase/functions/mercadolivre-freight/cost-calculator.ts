
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
      console.log('🎯 DETECTADO DESCONTO POR REPUTAÇÃO - Vendedor paga valor COM desconto');
      paidBy = 'vendedor';
      buyerCost = Number(option.cost) || 0; // Customer pays the discounted amount (could be 0)
      
      // CORREÇÃO: Com desconto por reputação, vendedor paga o valor COM desconto (option.cost)
      sellerCost = Number(option.cost) || 0;
      calculationMethod = 'desconto_reputacao_valor_com_desconto';
      console.log(`✅ VENDEDOR PAGA VALOR COM DESCONTO POR REPUTAÇÃO: R$ ${sellerCost}`);
    }
    // PRIORITY 2: Handle traditional free shipping (product declares it)
    else if (isReallyFreeShipping) {
      console.log('📦 FRETE GRÁTIS TRADICIONAL - Vendedor paga custo normal');
      paidBy = 'vendedor';
      buyerCost = 0; // Customer pays nothing
      
      // CORREÇÃO FUNDAMENTAL: Para frete grátis tradicional, usar SEMPRE list_cost (valor real do vendedor)
      // NUNQUER usar base_cost que é valor do Flex!
      if (option.list_cost !== undefined && option.list_cost !== null && option.list_cost > 0) {
        sellerCost = Number(option.list_cost);
        calculationMethod = 'list_cost_frete_gratis_valor_real';
        console.log(`✅ VENDEDOR PAGA LIST_COST (VALOR REAL): R$ ${sellerCost}`);
      } else if (option.seller_cost !== undefined && option.seller_cost !== null && option.seller_cost > 0) {
        sellerCost = Number(option.seller_cost);
        calculationMethod = 'seller_cost_direto';
        console.log(`✅ VENDEDOR PAGA SELLER_COST: R$ ${sellerCost}`);
      } else {
        // ÚLTIMO RECURSO: estimar baseado no custo que seria cobrado do cliente
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
