
import { useState } from 'react';
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export const useFreightCalculation = () => {
  const [loadingFreight, setLoadingFreight] = useState<Record<string, boolean>>({});

  const fetchFreightCosts = async (productId: string, zipCode: string) => {
    if (!zipCode || zipCode.trim().length === 0) {
      toast({
        title: "❌ CEP obrigatório",
        description: "Digite um CEP válido para calcular o frete real",
        variant: "destructive"
      });
      return null;
    }

    const cleanZipCode = zipCode.replace(/\D/g, '');
    if (cleanZipCode.length !== 8) {
      toast({
        title: "❌ CEP inválido",
        description: "Digite um CEP com 8 dígitos",
        variant: "destructive"
      });
      return null;
    }

    setLoadingFreight(prev => ({ ...prev, [productId]: true }));

    try {
      console.log('🚚 INICIANDO CÁLCULO DE FRETE REAL DA API MERCADO LIVRE');
      console.log('📍 Produto ID:', productId);
      console.log('📍 CEP limpo:', cleanZipCode);
      
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado. Reconecte-se ao Mercado Livre.');
      }

      console.log('🔑 Token encontrado, chamando API com melhorias...');

      const { data, error } = await supabase.functions.invoke('mercadolivre-freight', {
        body: { 
          action: 'getShippingCosts',
          productId,
          zipCode: cleanZipCode,
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

      const discountInfo = selectedOption.discount ? ` (com desconto: ${selectedOption.discount})` : '';
      
      toast({
        title: "✅ Custo REAL calculado com sucesso!",
        description: `${selectedOption.method}: Cliente R$ ${finalCustomerCost.toFixed(2)} | Vendedor R$ ${finalSellerCost.toFixed(2)}${discountInfo}`,
      });

      console.log('🎉 CÁLCULO FINALIZADO - VALORES REAIS DA API APLICADOS');

      return {
        freightCost: finalCustomerCost,
        sellerFreightCost: finalSellerCost,
        freightMethod: selectedOption.method
      };

    } catch (error: any) {
      console.error('💥 ERRO COMPLETO NO CÁLCULO:', error);
      
      toast({
        title: "❌ Erro ao calcular frete real",
        description: `Erro: ${error.message}`,
        variant: "destructive"
      });
      return null;
    } finally {
      setLoadingFreight(prev => ({ ...prev, [productId]: false }));
    }
  };

  return {
    loadingFreight,
    setLoadingFreight,
    fetchFreightCosts
  };
};
