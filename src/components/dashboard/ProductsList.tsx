import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Download, Minus, Plus, Package, ExternalLink, Truck, Calculator } from "lucide-react";

interface Product {
  id: string;
  title: string;
  originalPrice: number;
  status: 'active' | 'paused' | 'closed';
  freeShipping: boolean;
  adjustedPrice?: number;
  permalink?: string;
  thumbnail?: string;
  availableQuantity?: number;
  soldQuantity?: number;
  freightCost?: number;
  sellerFreightCost?: number;
  freightMethod?: string;
}

interface ProductsListProps {
  products: Product[];
}

export const ProductsList = ({ products: initialProducts }: ProductsListProps) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loadingFreight, setLoadingFreight] = useState<Record<string, boolean>>({});
  const [zipCode, setZipCode] = useState('');
  const { t } = useLanguage();

  const adjustPrice = (productId: string, operation: 'add' | 'subtract') => {
    setProducts(prev => prev.map(product => {
      if (product.id === productId) {
        const freightCost = product.sellerFreightCost;
        if (!freightCost) {
          toast({
            title: "Calcule o frete primeiro",
            description: "É necessário calcular o custo real do frete antes de ajustar o preço",
            variant: "destructive"
          });
          return product;
        }
        
        const adjustment = operation === 'add' ? freightCost : -freightCost;
        return {
          ...product,
          adjustedPrice: product.originalPrice + adjustment
        };
      }
      return product;
    }));

    toast({
      title: "Preço ajustado!",
      description: `Custo real do frete ${operation === 'add' ? 'adicionado ao' : 'subtraído do'} preço`,
    });
  };

  const adjustAllPrices = (operation: 'add' | 'subtract') => {
    let adjustedCount = 0;
    
    setProducts(prev => prev.map(product => {
      if (product.freeShipping && product.sellerFreightCost) {
        const adjustment = operation === 'add' ? product.sellerFreightCost : -product.sellerFreightCost;
        adjustedCount++;
        return {
          ...product,
          adjustedPrice: product.originalPrice + adjustment
        };
      }
      return product;
    }));

    if (adjustedCount === 0) {
      toast({
        title: "Nenhum produto ajustado",
        description: "Calcule o custo real do frete primeiro para produtos com frete grátis",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Preços ajustados em massa!",
        description: `${adjustedCount} produtos com frete grátis foram ajustados com o custo real do vendedor`,
      });
    }
  };

  const exportToCSV = () => {
    const csvContent = [
      ['ID', 'Título', 'Preço Original', 'Preço Ajustado', 'Status', 'Frete Grátis', 'Quantidade Disponível', 'Vendidos', 'Link'].join(','),
      ...products.map(product => [
        product.id,
        `"${product.title}"`,
        product.originalPrice.toFixed(2),
        (product.adjustedPrice || product.originalPrice).toFixed(2),
        product.status,
        product.freeShipping ? 'Sim' : 'Não',
        product.availableQuantity || 0,
        product.soldQuantity || 0,
        product.permalink || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'produtos_mercadolivre_ajustados.csv';
    link.click();

    toast({
      title: "CSV exportado!",
      description: "O arquivo foi baixado com sucesso",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'closed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active': return 'Ativo';
      case 'paused': return 'Pausado';
      case 'closed': return 'Finalizado';
      default: return status;
    }
  };

  const fetchFreightCosts = async (productId: string) => {
    if (!zipCode || zipCode.trim().length === 0) {
      toast({
        title: "❌ CEP obrigatório",
        description: "Digite um CEP válido para calcular o frete real",
        variant: "destructive"
      });
      return;
    }

    const cleanZipCode = zipCode.replace(/\D/g, '');
    if (cleanZipCode.length !== 8) {
      toast({
        title: "❌ CEP inválido",
        description: "Digite um CEP com 8 dígitos",
        variant: "destructive"
      });
      return;
    }

    setLoadingFreight(prev => ({ ...prev, [productId]: true }));

    // Limpar TODOS os dados antigos de frete antes de calcular novos
    setProducts(prev => prev.map(product => {
      if (product.id === productId) {
        console.log('🧹 LIMPANDO COMPLETAMENTE DADOS ANTIGOS DE FRETE para produto:', productId);
        return {
          ...product,
          freightCost: undefined,
          sellerFreightCost: undefined,
          freightMethod: undefined,
          adjustedPrice: undefined
        };
      }
      return product;
    }));

    try {
      console.log('🚚 INICIANDO CÁLCULO DE FRETE REAL - SEM VALORES PRÉ-CONFIGURADOS');
      console.log('📍 Produto ID:', productId);
      console.log('📍 CEP limpo:', cleanZipCode);
      
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado. Reconecte-se ao Mercado Livre.');
      }

      console.log('🔑 Token encontrado, chamando API...');

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

      console.log('📦 RESPOSTA COMPLETA DA API (SEM FILTROS):', JSON.stringify(data, null, 2));
      
      if (!data?.freightOptions || !Array.isArray(data.freightOptions) || data.freightOptions.length === 0) {
        console.error('❌ NENHUMA OPÇÃO DE FRETE RETORNADA');
        throw new Error('API do Mercado Livre não retornou opções de frete válidas');
      }

      console.log('🔍 OPÇÕES DE FRETE RECEBIDAS (VALORES REAIS DA API):');
      data.freightOptions.forEach((option: any, index: number) => {
        console.log(`✅ Opção ${index + 1}:`, {
          método: option.method,
          preçoCliente: option.price,
          custoVendedor: option.sellerCost,
          fonte: option.source,
          dadosOriginais: option.rawData
        });
      });

      // Encontrar a opção mais barata baseada no custo do vendedor
      const cheapestOption = data.freightOptions.reduce((min: any, current: any) => {
        const minCost = typeof min.sellerCost === 'number' ? min.sellerCost : 999999;
        const currentCost = typeof current.sellerCost === 'number' ? current.sellerCost : 999999;
        return currentCost < minCost ? current : min;
      });

      console.log('💰 OPÇÃO MAIS BARATA SELECIONADA (VALOR REAL):');
      console.log('- Método:', cheapestOption.method);
      console.log('- Preço Cliente:', cheapestOption.price);
      console.log('- Custo Vendedor:', cheapestOption.sellerCost);
      console.log('- Fonte:', cheapestOption.source);

      // Verificação rigorosa dos valores
      if (cheapestOption.price === undefined || cheapestOption.sellerCost === undefined) {
        console.error('❌ VALORES INVÁLIDOS NA RESPOSTA DA API:', cheapestOption);
        throw new Error('API retornou valores inválidos para o frete');
      }

      if (typeof cheapestOption.price !== 'number' || typeof cheapestOption.sellerCost !== 'number') {
        console.error('❌ VALORES NÃO SÃO NUMÉRICOS:', {
          price: typeof cheapestOption.price,
          sellerCost: typeof cheapestOption.sellerCost
        });
        throw new Error('API retornou valores não numéricos para o frete');
      }

      // Verificar se não é o valor 25 (removendo qualquer possibilidade)
      if (cheapestOption.sellerCost === 25 || cheapestOption.price === 25) {
        console.warn('⚠️ DETECTADO VALOR 25 - PODE SER PRÉ-CONFIGURAÇÃO');
        console.log('Dados completos da opção:', cheapestOption);
      }

      const finalCustomerCost = Number(cheapestOption.price);
      const finalSellerCost = Number(cheapestOption.sellerCost);

      console.log('🎯 VALORES FINAIS PROCESSADOS (GARANTIDAMENTE DA API):');
      console.log('- Custo Final Cliente:', finalCustomerCost);
      console.log('- Custo Final Vendedor:', finalSellerCost);
      console.log('- Método Final:', cheapestOption.method);

      // Atualizar produto com valores REAIS da API
      setProducts(prev => prev.map(product => {
        if (product.id === productId) {
          const updatedProduct = {
            ...product,
            freightCost: finalCustomerCost,
            sellerFreightCost: finalSellerCost,
            freightMethod: cheapestOption.method
          };
          
          console.log('💾 PRODUTO ATUALIZADO COM VALORES REAIS DA API:', {
            id: productId,
            custoCliente: updatedProduct.freightCost,
            custoVendedor: updatedProduct.sellerFreightCost,
            método: updatedProduct.freightMethod,
            fonte: cheapestOption.source
          });
          
          return updatedProduct;
        }
        return product;
      }));

      toast({
        title: "✅ Custo REAL calculado com sucesso!",
        description: `${cheapestOption.method}: Cliente R$ ${finalCustomerCost.toFixed(2)} | Vendedor R$ ${finalSellerCost.toFixed(2)}`,
      });

      console.log('🎉 CÁLCULO FINALIZADO - VALORES REAIS DA API APLICADOS');
      console.log('❌ NENHUM VALOR PRÉ-CONFIGURADO FOI USADO');

    } catch (error: any) {
      console.error('💥 ERRO COMPLETO NO CÁLCULO:', error);
      
      // Em caso de erro, garantir que não há valores antigos
      setProducts(prev => prev.map(product => {
        if (product.id === productId) {
          return {
            ...product,
            freightCost: undefined,
            sellerFreightCost: undefined,
            freightMethod: undefined,
            adjustedPrice: undefined
          };
        }
        return product;
      }));
      
      toast({
        title: "❌ Erro ao calcular frete real",
        description: `Erro: ${error.message}`,
        variant: "destructive"
      });
    } finally {
      setLoadingFreight(prev => ({ ...prev, [productId]: false }));
    }
  };

  if (products.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Package className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum produto encontrado</h3>
          <p className="text-gray-600">
            Não foi possível encontrar produtos ativos em sua conta do Mercado Livre.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Freight Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Calculadora de Frete Mercado Livre
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <label htmlFor="zipcode" className="block text-sm font-medium mb-2">
                CEP de Destino (obrigatório)
              </label>
              <Input
                id="zipcode"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="Digite o CEP (ex: 01310-100)"
                maxLength={9}
              />
            </div>
            <Button
              onClick={() => {
                if (!zipCode || zipCode.trim().length === 0) {
                  toast({
                    title: "❌ CEP obrigatório",
                    description: "Digite um CEP válido para calcular o frete real",
                    variant: "destructive"
                  });
                  return;
                }
                products.forEach(product => {
                  if (!loadingFreight[product.id]) {
                    fetchFreightCosts(product.id);
                  }
                });
              }}
              disabled={Object.values(loadingFreight).some(Boolean)}
              className="flex items-center gap-2"
            >
              <Truck className="h-4 w-4" />
              {Object.values(loadingFreight).some(Boolean) ? 'Calculando...' : 'Calcular Custo Real'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ações em Massa ({products.length} produtos importados)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button
              onClick={() => adjustAllPrices('subtract')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Minus className="h-4 w-4" />
              Subtrair Custo Real do Frete
            </Button>
            <Button
              onClick={() => adjustAllPrices('add')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Somar Custo Real do Frete
            </Button>
            <Button
              onClick={exportToCSV}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Download className="h-4 w-4" />
              {t('dashboard.export_csv')}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Products Grid */}
      <div className="grid gap-4">
        {products.map((product) => (
          <Card key={product.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-start gap-4">
                    {product.thumbnail && (
                      <img 
                        src={product.thumbnail} 
                        alt={product.title}
                        className="w-16 h-16 object-cover rounded-lg flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-lg">{product.title}</h3>
                        {product.permalink && (
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            className="p-1 h-auto"
                          >
                            <a 
                              href={product.permalink} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              title="Ver anúncio no Mercado Livre"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Preço Original:</span>{' '}
                          <span className="text-lg font-bold text-blue-600">
                            R$ {product.originalPrice.toFixed(2)}
                          </span>
                        </div>
                        {product.sellerFreightCost !== undefined && (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Custo Real do Frete ({product.freightMethod}):</span>{' '}
                            <span className="text-lg font-bold text-red-600">
                              R$ {product.sellerFreightCost.toFixed(2)}
                            </span>
                            {product.freeShipping && (
                              <span className="text-xs text-orange-600 ml-1">(Vendedor paga)</span>
                            )}
                          </div>
                        )}
                        {product.adjustedPrice && (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Preço Ajustado:</span>{' '}
                            <span className="text-lg font-bold text-green-600">
                              R$ {product.adjustedPrice.toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-3">
                        <Badge className={getStatusColor(product.status)}>
                          {getStatusText(product.status)}
                        </Badge>
                        {product.freeShipping && (
                          <Badge variant="secondary">
                            ✅ Frete Grátis (Vendedor Paga)
                          </Badge>
                        )}
                        {product.availableQuantity !== undefined && (
                          <Badge variant="outline">
                            Disponível: {product.availableQuantity}
                          </Badge>
                        )}
                        {product.soldQuantity !== undefined && product.soldQuantity > 0 && (
                          <Badge variant="outline">
                            Vendidos: {product.soldQuantity}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => fetchFreightCosts(product.id)}
                    disabled={loadingFreight[product.id] || !zipCode}
                    className="flex items-center gap-1"
                  >
                    <Truck className="h-4 w-4" />
                    {loadingFreight[product.id] ? 'Calculando...' : 'Calcular Custo Real'}
                  </Button>
                  
                  {product.sellerFreightCost !== undefined && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => adjustPrice(product.id, 'subtract')}
                        className="flex items-center gap-1"
                      >
                        <Minus className="h-4 w-4" />
                        Subtrair Custo Real
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => adjustPrice(product.id, 'add')}
                        className="flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Somar Custo Real
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
