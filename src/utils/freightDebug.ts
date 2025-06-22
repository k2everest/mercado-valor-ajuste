
export interface FreightDebugInfo {
  productId: string;
  value: number;
  source: 'cache' | 'api' | 'calculation';
  timestamp: number;
  cacheAge?: number;
  apiResponse?: any;
  calculationMethod?: string;
  rawData?: any;
}

export class FreightDebugger {
  private static DEBUG_KEY = 'freight_debug_log';
  
  static logFreightCalculation(info: FreightDebugInfo) {
    const debugLog = this.getDebugLog();
    debugLog[info.productId] = {
      ...info,
      timestamp: Date.now()
    };
    
    localStorage.setItem(this.DEBUG_KEY, JSON.stringify(debugLog));
    
    console.log('🔍 FREIGHT DEBUG:', {
      productId: info.productId,
      value: `R$ ${info.value.toFixed(2)}`,
      source: info.source,
      age: info.cacheAge ? `${Math.round(info.cacheAge / (1000 * 60 * 60))}h` : undefined,
      method: info.calculationMethod
    });
  }
  
  static getDebugLog(): Record<string, FreightDebugInfo> {
    try {
      return JSON.parse(localStorage.getItem(this.DEBUG_KEY) || '{}');
    } catch {
      return {};
    }
  }
  
  static getProductDebugInfo(productId: string): FreightDebugInfo | null {
    const log = this.getDebugLog();
    return log[productId] || null;
  }
  
  static clearDebugLog() {
    localStorage.removeItem(this.DEBUG_KEY);
    console.log('🧹 Debug log cleared');
  }
  
  static clearProductCache(productId: string) {
    // Clear freight calculation cache
    const freightCache = JSON.parse(localStorage.getItem('freight_calculations') || '{}');
    delete freightCache[productId];
    localStorage.setItem('freight_calculations', JSON.stringify(freightCache));
    
    // Clear debug log for product
    const debugLog = this.getDebugLog();
    delete debugLog[productId];
    localStorage.setItem(this.DEBUG_KEY, JSON.stringify(debugLog));
    
    console.log(`🧹 Cache cleared for product ${productId}`);
  }
  
  static inspectFreightCache() {
    const cache = JSON.parse(localStorage.getItem('freight_calculations') || '{}');
    console.log('📋 FREIGHT CACHE INSPECTION:', cache);
    return cache;
  }
  
  static inspectProductCache(productId: string) {
    const cache = this.inspectFreightCache();
    const productCache = cache[productId];
    
    if (productCache) {
      const ageHours = Math.round((Date.now() - productCache.timestamp) / (1000 * 60 * 60));
      console.log(`📋 PRODUCT ${productId} CACHE:`, {
        freightCost: productCache.freightCost,
        sellerFreightCost: productCache.sellerFreightCost,
        method: productCache.freightMethod,
        age: `${ageHours}h ago`,
        zipCode: productCache.zipCode,
        timestamp: new Date(productCache.timestamp).toLocaleString()
      });
    } else {
      console.log(`📋 No cache found for product ${productId}`);
    }
    
    return productCache;
  }
}
