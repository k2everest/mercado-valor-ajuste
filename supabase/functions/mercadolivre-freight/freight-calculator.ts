
import { Product, ShippingOption, ProcessedFreightOption } from './types.ts';
import { ShippingProcessor } from './shipping-processor.ts';
import { OptionSelector } from './option-selector.ts';

export class FreightCalculator {
  static processShippingOptions(
    options: ShippingOption[], 
    product: Product
  ): ProcessedFreightOption[] {
    return ShippingProcessor.processShippingOptions(options, product);
  }

  static processFallbackCosts(costs: any[]): ProcessedFreightOption[] {
    return ShippingProcessor.processFallbackCosts(costs);
  }

  static filterValidOptions(options: ProcessedFreightOption[]): ProcessedFreightOption[] {
    return OptionSelector.filterValidOptions(options);
  }

  static selectBestOption(options: ProcessedFreightOption[]): ProcessedFreightOption {
    return OptionSelector.selectBestOption(options);
  }
}
