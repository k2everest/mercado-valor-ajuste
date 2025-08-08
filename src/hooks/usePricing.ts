import { useState, useCallback } from 'react';
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Product {
  id: string;
  sku: string;
  name: string;
  purchase_price: number;
  selling_price?: number;
  category?: string;
  brand?: string;
  supplier?: string;
  weight?: number;
}

interface PricingCalculation {
  id: string;
  product_id: string;
  purchase_cost: number;
  additional_costs: number;
  tax_cost: number;
  total_cost: number;
  current_selling_price?: number;
  suggested_price: number;
  current_markup?: number;
  suggested_markup: number;
  margin_percentage: number;
  calculated_at: string;
}

export const usePricing = () => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const importProducts = useCallback(async (products: any[], additionalCosts: any[] = []) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-csv-import', {
        body: { products, additionalCosts }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "Produtos importados",
        description: `${data.data.summary.totalProducts} produtos importados com sucesso`,
      });

      return data.data;
    } catch (error) {
      console.error('Erro ao importar produtos:', error);
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const importNFE = useCallback(async (xmlContent: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-nfe-xml', {
        body: { xmlContent }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "NFE importada",
        description: `NFE ${data.data.summary.nfeNumber} processada com sucesso`,
      });

      return data.data;
    } catch (error) {
      console.error('Erro ao importar NFE:', error);
      toast({
        title: "Erro na importação NFE",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const calculatePricing = useCallback(async (productIds?: string[], updatePrices: boolean = false) => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-pricing', {
        body: { 
          productIds, 
          includeCosts: true, 
          updatePrices 
        }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      const message = updatePrices 
        ? `Preços atualizados para ${data.data.summary.totalProducts} produtos`
        : `Precificação calculada para ${data.data.summary.totalProducts} produtos`;

      toast({
        title: updatePrices ? "Preços atualizados" : "Precificação calculada",
        description: message,
      });

      return data.data;
    } catch (error) {
      console.error('Erro ao calcular precificação:', error);
      toast({
        title: "Erro no cálculo",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const getProducts = useCallback(async (): Promise<Product[]> => {
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      toast({
        title: "Erro ao carregar produtos",
        description: error.message,
        variant: "destructive",
      });
      return [];
    }
  }, [toast]);

  const getPricingCalculations = useCallback(async (): Promise<PricingCalculation[]> => {
    try {
      const { data, error } = await supabase
        .from('pricing_calculations')
        .select(`
          *,
          products:product_id (
            id,
            sku,
            name,
            purchase_price,
            selling_price,
            category,
            brand
          )
        `)
        .order('calculated_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Erro ao buscar cálculos de precificação:', error);
      toast({
        title: "Erro ao carregar cálculos",
        description: error.message,
        variant: "destructive",
      });
      return [];
    }
  }, [toast]);

  const updateProduct = useCallback(async (productId: string, updates: Partial<Product>) => {
    try {
      const { data, error } = await supabase
        .from('products')
        .update(updates)
        .eq('id', productId)
        .select()
        .single();

      if (error) throw error;

      toast({
        title: "Produto atualizado",
        description: "Produto atualizado com sucesso",
      });

      return data;
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      toast({
        title: "Erro ao atualizar produto",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  const deleteProduct = useCallback(async (productId: string) => {
    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast({
        title: "Produto excluído",
        description: "Produto excluído com sucesso",
      });
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      toast({
        title: "Erro ao excluir produto",
        description: error.message,
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  return {
    isLoading,
    importProducts,
    importNFE,
    calculatePricing,
    getProducts,
    getPricingCalculations,
    updateProduct,
    deleteProduct,
  };
};