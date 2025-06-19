
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { Calculator, Truck } from "lucide-react";
import { Product } from './types';

interface FreightCalculatorProps {
  products: Product[];
  onFreightCalculated: (productId: string, freightData: {
    freightCost: number;
    sellerFreightCost: number;
    freightMethod: string;
  }) => void;
  loadingFreight: Record<string, boolean>;
  setLoadingFreight: (loading: Record<string, boolean>) => void;
}

export const FreightCalculator = ({ 
  products, 
  onFreightCalculated, 
  loadingFreight, 
  setLoadingFreight 
}: FreightCalculatorProps) => {
  const fetchFreightCosts = async (productId: string) => {
    setLoadingFreight({ ...loadingFreight, [productId]: true });

    try {
      console.log('🚚 INICIANDO CÁLCULO DE FRETE REAL DA API MERCADO LIVRE');
      console.log('📍 Produto ID:', productId);
      console.log('📍 Usando CEP fixo para cálculo do vendedor');
      
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado. Reconecte-se ao Mercado Livre.');
      }

      console.log('🔑 Token encontrado, chamando API com melhorias...');

      const { supabase } = await import("@/integrations/supabase/client");
      const { data, error } = await supabase.functions.invoke('mercadolivre-freight', {
        body: { 
          action: 'getShippingCosts',
          productId,
          zipCode: '01310-100', // Fixed ZIP code for São Paulo center
          accessToken
        }
      });

      if (error) {
        console.error('❌ ERRO DA FUNÇÃO SUPABASE:', error);
        throw new Error(`Erro da API: ${error.message}`);
      }

      console.log('📦 RESPOSTA COMPLETA DA API MELHORADA:', JSON.stringify(data, null, 2));
      
      const selectedOption = data?.selectedOption || data?.freightOptions?.[0];
      
      if (!selectedOption) {
        console.error('❌ NENHUMA OPÇÃO VÁLIDA DE FRETE RETORNADA');
        throw new Error('API do Mercado Livre não retornou opções de frete válidas');
      }

      console.log('🎯 OPÇÃO SELECIONADA (CUSTO REAL DO VENDEDOR):');
      console.log('- Método:', selectedOption.method);
      console.log('- Preço Cliente:', selectedOption.price);
      console.log('- Custo Vendedor:', selectedOption.sellerCost);
      console.log('- Fonte:', selectedOption.source);
      console.log('- Desconto:', selectedOption.discount);

      if (selectedOption.price === undefined || selectedOption.sellerCost === undefined) {
        console.error('❌ VALORES INVÁLIDOS NA RESPOSTA DA API:', selectedOption);
        throw new Error('API retornou valores inválidos para o frete');
      }

      if (typeof selectedOption.price !== 'number' || typeof selectedOption.sellerCost !== 'number') {
        console.error('❌ VALORES NÃO SÃO NUMÉRICOS:', {
          price: typeof selectedOption.price,
          sellerCost: typeof selectedOption.sellerCost
        });
        throw new Error('API retornou valores não numéricos para o frete');
      }

      const finalCustomerCost = Number(selectedOption.price);
      const finalSellerCost = Number(selectedOption.sellerCost);

      console.log('✅ VALORES FINAIS CONFIRMADOS DA API MERCADO LIVRE:');
      console.log('- Custo Final Cliente:', finalCustomerCost);
      console.log('- Custo Final Vendedor:', finalSellerCost);
      console.log('- Método Final:', selectedOption.method);

      onFreightCalculated(productId, {
        freightCost: finalCustomerCost,
        sellerFreightCost: finalSellerCost,
        freightMethod: selectedOption.method
      });

      // Store calculation in localStorage to avoid recalculation
      const calculationCache = JSON.parse(localStorage.getItem('freight_calculations') || '{}');
      calculationCache[productId] = {
        freightCost: finalCustomerCost,
        sellerFreightCost: finalSellerCost,
        freightMethod: selectedOption.method,
        timestamp: Date.now()
      };
      localStorage.setItem('freight_calculations', JSON.stringify(calculationCache));

      const discountInfo = selectedOption.discount ? ` (com desconto: ${selectedOption.discount})` : '';
      
      toast({
        title: "✅ Custo REAL calculado com sucesso!",
        description: `${selectedOption.method}: Cliente R$ ${finalCustomerCost.toFixed(2)} | Vendedor R$ ${finalSellerCost.toFixed(2)}${discountInfo}`,
      });

      console.log('🎉 CÁLCULO FINALIZADO - VALORES REAIS DA API APLICADOS');

    } catch (error: any) {
      console.error('💥 ERRO COMPLETO NO CÁLCULO:', error);
      
      toast({
        title: "❌ Erro ao calcular frete real",
        description: `Erro: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoadingFreight({ ...loadingFreight, [productId]: false });
    }
  };

  const calculateAllFreights = () => {
    const calculationCache = JSON.parse(localStorage.getItem('freight_calculations') || '{}');
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000); // 24 hours cache

    products.forEach(product => {
      if (!loadingFreight[product.id]) {
        // Check if we have a recent calculation
        const cachedCalculation = calculationCache[product.id];
        if (cachedCalculation && cachedCalculation.timestamp > oneDayAgo) {
          console.log(`Using cached calculation for product ${product.id}`);
          onFreightCalculated(product.id, {
            freightCost: cachedCalculation.freightCost,
            sellerFreightCost: cachedCalculation.sellerFreightCost,
            freightMethod: cachedCalculation.freightMethod
          });
        } else {
          fetchFreightCosts(product.id);
        }
      }
    });
  };

  return (
    <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <Calculator className="h-5 w-5" />
          Calculadora de Frete Mercado Livre
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-center">
          <p className="text-blue-100 mb-4">
            Calcule o custo real do frete que você paga como vendedor
          </p>
          <Button
            onClick={calculateAllFreights}
            disabled={Object.values(loadingFreight).some(Boolean)}
            className="flex items-center gap-2 bg-white text-blue-600 hover:bg-blue-50"
          >
            <Truck className="h-4 w-4" />
            {Object.values(loadingFreight).some(Boolean) ? 'Calculando...' : 'Calcular Custo Real'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
