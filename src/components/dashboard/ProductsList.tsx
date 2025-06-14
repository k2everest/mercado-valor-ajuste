
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
        const freightCost = product.freightCost || 25.00; // Fallback para valor padrão
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
      description: `Frete ${operation === 'add' ? 'adicionado ao' : 'subtraído do'} preço`,
    });
  };

  const adjustAllPrices = (operation: 'add' | 'subtract') => {
    setProducts(prev => prev.map(product => {
      if (product.freeShipping) {
        const freightCost = product.freightCost || 25.00; // Fallback para valor padrão
        const adjustment = operation === 'add' ? freightCost : -freightCost;
        return {
          ...product,
          adjustedPrice: product.originalPrice + adjustment
        };
      }
      return product;
    }));

    const freeShippingCount = products.filter(p => p.freeShipping).length;
    toast({
      title: "Preços ajustados em massa!",
      description: `${freeShippingCount} produtos com frete grátis foram ajustados`,
    });
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
    if (!zipCode) {
      toast({
        title: "CEP necessário",
        description: "Digite um CEP para calcular o frete",
        variant: "destructive"
      });
      return;
    }

    setLoadingFreight(prev => ({ ...prev, [productId]: true }));

    try {
      console.log('Buscando custos de frete para produto:', productId);
      
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado. Reconecte-se ao Mercado Livre.');
      }

      const { data, error } = await supabase.functions.invoke('mercadolivre-freight', {
        body: { 
          action: 'getShippingCosts',
          productId,
          zipCode: zipCode.replace(/\D/g, ''), // Remove caracteres não numéricos
          accessToken
        }
      });

      if (error) {
        console.error('Erro ao buscar frete:', error);
        throw new Error(error.message);
      }

      console.log('Opções de frete recebidas:', data.freightOptions);

      // Encontrar a opção de frete mais barata
      const cheapestFreight = data.freightOptions.reduce((min: any, current: any) => 
        current.price < min.price ? current : min
      );

      // Atualizar o produto com o valor do frete
      setProducts(prev => prev.map(product => {
        if (product.id === productId) {
          return {
            ...product,
            freightCost: cheapestFreight.price,
            freightMethod: cheapestFreight.method
          };
        }
        return product;
      }));

      toast({
        title: "Frete calculado!",
        description: `${cheapestFreight.method}: R$ ${cheapestFreight.price.toFixed(2)}`,
      });

    } catch (error: any) {
      console.error('Erro ao calcular frete:', error);
      toast({
        title: "Erro ao calcular frete",
        description: error.message || "Não foi possível calcular o frete via Mercado Livre",
        variant: "destructive"
      });
    } finally {
      setLoadingFreight(prev => ({ ...prev, [productId]: false }));
    }
  };

  const adjustPriceWithFreight = (productId: string, operation: 'add' | 'subtract') => {
    setProducts(prev => prev.map(product => {
      if (product.id === productId) {
        const freightCost = product.freightCost || 25.00; // Fallback para valor padrão
        const adjustment = operation === 'add' ? freightCost : -freightCost;
        return {
          ...product,
          adjustedPrice: product.originalPrice + adjustment
        };
      }
      return product;
    }));

    toast({
      title: "Preço ajustado com frete!",
      description: `Frete ${operation === 'add' ? 'adicionado ao' : 'subtraído do'} preço`,
    });
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
                CEP de Destino
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
              {Object.values(loadingFreight).some(Boolean) ? 'Calculando...' : 'Calcular Frete'}
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
              Subtrair Frete de Todos
            </Button>
            <Button
              onClick={() => adjustAllPrices('add')}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Plus className="h-4 w-4" />
              Somar Frete a Todos
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
                        {product.freightCost && (
                          <div className="text-sm text-gray-600">
                            <span className="font-medium">Frete ({product.freightMethod}):</span>{' '}
                            <span className="text-lg font-bold text-orange-600">
                              R$ {product.freightCost.toFixed(2)}
                            </span>
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
                            ✅ Frete Grátis
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
                    {loadingFreight[product.id] ? 'Calculando...' : 'Calcular Frete'}
                  </Button>
                  
                  {product.freightCost && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => adjustPriceWithFreight(product.id, 'subtract')}
                        className="flex items-center gap-1"
                      >
                        <Minus className="h-4 w-4" />
                        Subtrair Frete
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => adjustPriceWithFreight(product.id, 'add')}
                        className="flex items-center gap-1"
                      >
                        <Plus className="h-4 w-4" />
                        Somar Frete
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
