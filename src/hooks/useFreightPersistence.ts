
import { useState, useEffect } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Product } from '@/components/dashboard/types';

interface CalculationData {
  productId: string;
  freightCost: number;
  sellerFreightCost: number;
  freightMethod: string;
  calculatedAt: string;
}

export const useFreightPersistence = () => {
  const { user } = useAuth();
  const [lastZipCode, setLastZipCode] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Carregar últimos cálculos do usuário
  const loadLastCalculations = async (): Promise<Product[]> => {
    if (!user) return [];
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_last_calculations')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao carregar últimos cálculos:', error);
        return [];
      }

      if (data) {
        setLastZipCode(data.zip_code || '');
        return data.calculations as Product[] || [];
      }

      return [];
    } catch (error) {
      console.error('Erro ao carregar cálculos:', error);
      return [];
    } finally {
      setIsLoading(false);
    }
  };

  // Salvar cálculos atuais
  const saveCalculations = async (products: Product[], zipCode: string) => {
    if (!user) return;

    // Filtrar apenas produtos com cálculos de frete
    const calculatedProducts = products.filter(p => 
      p.freightCost !== undefined && p.sellerFreightCost !== undefined
    );

    try {
      const { error } = await supabase
        .from('user_last_calculations')
        .upsert({
          user_id: user.id,
          zip_code: zipCode,
          calculations: calculatedProducts,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id'
        });

      if (error) {
        console.error('Erro ao salvar cálculos:', error);
      } else {
        console.log('✅ Cálculos salvos com sucesso');
      }
    } catch (error) {
      console.error('Erro ao salvar cálculos:', error);
    }
  };

  // Salvar no histórico de frete
  const saveFreightHistory = async (
    productId: string,
    zipCode: string,
    freightCost: number,
    sellerFreightCost: number,
    freightMethod: string
  ) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('freight_history')
        .insert({
          user_id: user.id,
          product_id: productId,
          zip_code: zipCode,
          freight_cost: freightCost,
          seller_freight_cost: sellerFreightCost,
          freight_method: freightMethod,
          calculated_at: new Date().toISOString(),
          is_current: true
        });

      if (error) {
        console.error('Erro ao salvar histórico de frete:', error);
      } else {
        console.log('✅ Histórico de frete salvo');
      }
    } catch (error) {
      console.error('Erro ao salvar histórico:', error);
    }
  };

  // Verificar se existe cálculo atual para um produto/CEP
  const getCurrentFreight = async (productId: string, zipCode: string) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from('freight_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .eq('zip_code', zipCode)
        .eq('is_current', true)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar frete atual:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Erro ao buscar frete atual:', error);
      return null;
    }
  };

  return {
    lastZipCode,
    isLoading,
    loadLastCalculations,
    saveCalculations,
    saveFreightHistory,
    getCurrentFreight
  };
};
