
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
    
    // PRIORITY 1: Handle reputation discount scenarios (seller always pays when there's a discount)
    if (hasReputationDiscount) {
      console.log('🎯 DETECTADO DESCONTO POR REPUTAÇÃO DO VENDEDOR - Vendedor sempre paga o custo real');
      paidBy = 'vendedor';
      buyerCost = Number(option.cost) || 0; // Customer pays the discounted amount (could be 0)
      
      // CORREÇÃO: list_cost é o valor REAL que o vendedor paga (não base_cost!)
      if (option.list_cost !== undefined && option.list_cost !== null && option.list_cost > 0) {
        sellerCost = Number(option.list_cost);
        calculationMethod = 'list_cost_valor_real_vendedor';
        console.log(`✅ VENDEDOR PAGA LIST_COST (valor REAL que vendedor paga): R$ ${sellerCost}`);
      } 
      // Se list_cost não disponível, calcular baseado no desconto
      else if (option.discount?.promoted_amount && option.cost !== undefined) {
        sellerCost = Number(option.cost) + Number(option.discount.promoted_amount);
        calculationMethod = 'cost_plus_discount_amount';
        console.log(`✅ VENDEDOR PAGA COST + DESCONTO: R$ ${option.cost} + R$ ${option.discount.promoted_amount} = R$ ${sellerCost}`);
      }
      // Fallback usando base_cost só se não tiver outras opções
      else if (option.base_cost !== undefined && option.base_cost !== null && option.base_cost > 0) {
        sellerCost = Number(option.base_cost);
        calculationMethod = 'base_cost_fallback';
        console.log(`⚠️ VENDEDOR PAGA BASE_COST (fallback - pode ser valor Flex): R$ ${sellerCost}`);
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
      
      // Para frete grátis tradicional, priorizar list_cost (valor real do vendedor)
      if (option.list_cost !== undefined && option.list_cost !== null && option.list_cost > 0) {
        sellerCost = Number(option.list_cost);
        calculationMethod = 'list_cost_frete_gratis';
        console.log(`✅ VENDEDOR PAGA LIST_COST: R$ ${sellerCost}`);
      } else if (option.seller_cost !== undefined && option.seller_cost !== null && option.seller_cost > 0) {
        sellerCost = Number(option.seller_cost);
        calculationMethod = 'seller_cost_direto';
        console.log(`✅ VENDEDOR PAGA SELLER_COST: R$ ${sellerCost}`);
      } else if (option.base_cost !== undefined && option.base_cost !== null && option.base_cost > 0) {
        sellerCost = Number(option.base_cost);
        calculationMethod = 'base_cost_frete_gratis_fallback';
        console.log(`⚠️ VENDEDOR PAGA BASE_COST (pode ser valor Flex): R$ ${sellerCost}`);
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
}
