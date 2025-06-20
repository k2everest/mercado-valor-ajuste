
import { ProcessedFreightOption } from './types.ts';

export class OptionSelector {
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
    
    // Enhanced logic for selecting best option - prioritize seller-paid options (reputation discounts)
    const sellerPaidOptions = options.filter(option => option.paidBy === 'vendedor');
    const buyerPaidOptions = options.filter(option => option.paidBy === 'comprador');
    
    console.log(`Opções pagas pelo vendedor: ${sellerPaidOptions.length}`);
    console.log(`Opções pagas pelo comprador: ${buyerPaidOptions.length}`);
    
    // PRIORITY 1: Seller-paid options (reputation discounts or free shipping)
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
