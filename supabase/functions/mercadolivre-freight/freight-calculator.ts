
import { Product, ShippingOption, ProcessedFreightOption } from './types.ts';

export class FreightCalculator {
  static processShippingOptions(
    options: ShippingOption[], 
    product: Product
  ): ProcessedFreightOption[] {
    console.log('🔄 Processando opções de frete...');
    
    return options.map((option: any, index: number) => {
      console.log(`\n=== PROCESSANDO OPÇÃO ${index + 1} ===`);
      console.log('Nome:', option.name);
      console.log('Shipping Method ID:', option.shipping_method_id);
      console.log('Cost (preço para cliente):', option.cost);
      console.log('List Cost (custo real):', option.list_cost);
      
      const optionName = (option.name || '').toLowerCase();
      const methodId = String(option.shipping_method_id || '').toLowerCase();
      
      // Identificar se é Mercado Envios
      const isMercadoEnvios = (
        optionName.includes('mercado envios') ||
        methodId.includes('mercado_envios') ||
        optionName.includes('me2') ||
        methodId === '515462'
      );
      
      console.log('É Mercado Envios?', isMercadoEnvios);
      
      // Determinar custos baseado na documentação oficial
      const customerPrice = Number(option.cost) || 0;
      const realCost = Number(option.list_cost) || customerPrice;
      
      // Lógica simplificada: se produto tem frete grátis E o cost é 0, então é frete grátis
      const productHasFreeShipping = product.shipping?.free_shipping === true;
      const isFreeShipping = productHasFreeShipping && customerPrice === 0;
      
      console.log('Produto declara frete grátis:', productHasFreeShipping);
      console.log('Preço para cliente é zero:', customerPrice === 0);
      console.log('É realmente frete grátis?', isFreeShipping);
      
      let sellerCost: number;
      let buyerCost: number;
      let paidBy: string;
      let calculationMethod: string;
      
      if (isFreeShipping) {
        // Frete grátis: vendedor paga o custo real
        sellerCost = realCost;
        buyerCost = 0;
        paidBy = 'vendedor';
        calculationMethod = 'frete_gratis_vendedor_paga';
        console.log(`💰 FRETE GRÁTIS: Vendedor paga R$ ${sellerCost}`);
      } else {
        // Frete pago: comprador paga o preço mostrado
        sellerCost = 0;
        buyerCost = customerPrice;
        paidBy = 'comprador';
        calculationMethod = 'frete_pago_comprador';
        console.log(`💳 FRETE PAGO: Comprador paga R$ ${buyerCost}`);
      }
      
      return {
        method: option.name || 'Mercado Envios',
        carrier: option.shipping_method_id || 'Mercado Envios',
        price: customerPrice,
        sellerCost,
        buyerCost,
        deliveryTime: option.estimated_delivery_time?.date || '3-7 dias úteis',
        isFreeShipping,
        paidBy,
        source: 'shipping_options_api',
        rawData: option,
        discount: option.discount || null,
        calculationMethod
      };
    });
  }

  static filterValidOptions(options: ProcessedFreightOption[]): ProcessedFreightOption[] {
    const validOptions = options.filter(option => {
      const isValid = (
        typeof option.sellerCost === 'number' && option.sellerCost >= 0 &&
        typeof option.buyerCost === 'number' && option.buyerCost >= 0 &&
        typeof option.price === 'number' && option.price >= 0
      );
      
      if (!isValid) {
        console.warn('❌ Opção inválida filtrada:', option.method);
      }
      
      return isValid;
    });
    
    console.log(`✅ ${validOptions.length} opções válidas após filtragem`);
    return validOptions;
  }

  static selectBestOption(options: ProcessedFreightOption[]): ProcessedFreightOption {
    console.log(`🎯 Selecionando melhor opção entre ${options.length} disponíveis`);
    
    if (options.length === 0) {
      throw new Error('Nenhuma opção válida para seleção');
    }
    
    // Priorizar frete grátis
    const freeOptions = options.filter(opt => opt.isFreeShipping);
    if (freeOptions.length > 0) {
      console.log('🆓 Priorizando frete grátis');
      // Para frete grátis, pegar o com maior custo real (mais realista)
      const selected = freeOptions.reduce((best, current) => 
        current.sellerCost > best.sellerCost ? current : best
      );
      console.log(`✅ Selecionado frete grátis: ${selected.method} (vendedor paga R$ ${selected.sellerCost})`);
      return selected;
    }
    
    // Se não há frete grátis, pegar o com maior custo (mais realista)
    const selected = options.reduce((best, current) => 
      current.buyerCost > best.buyerCost ? current : best
    );
    
    console.log(`✅ Selecionado frete pago: ${selected.method} (R$ ${selected.buyerCost})`);
    return selected;
  }
}
