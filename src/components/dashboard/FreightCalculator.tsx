
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFreightCalculation } from "@/hooks/useFreightCalculation";
import { Calculator, MapPin, Package, DollarSign } from "lucide-react";
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
  initialZipCode?: string;
  onZipCodeChange?: (zipCode: string) => void;
}

export const FreightCalculator = ({ 
  products, 
  onFreightCalculated, 
  loadingFreight,
  setLoadingFreight,
  initialZipCode = '',
  onZipCodeChange
}: FreightCalculatorProps) => {
  const [zipCode, setZipCode] = useState(initialZipCode);
  const { fetchFreightCosts } = useFreightCalculation();

  // Atualizar CEP quando o inicial mudar
  useEffect(() => {
    if (initialZipCode && !zipCode) {
      setZipCode(initialZipCode);
    }
  }, [initialZipCode, zipCode]);

  const handleZipCodeChange = (value: string) => {
    setZipCode(value);
    onZipCodeChange?.(value);
  };

  const calculateFreight = async (productId: string) => {
    const result = await fetchFreightCosts(productId, zipCode);
    if (result) {
      onFreightCalculated(productId, result);
    }
  };

  const calculateAllFreights = async () => {
    for (const product of products) {
      if (!loadingFreight[product.id]) {
        await calculateFreight(product.id);
        // Pequeno delay entre cálculos para evitar sobrecarga
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
  };

  const productsWithFreight = products.filter(p => 
    p.freightCost !== undefined && p.sellerFreightCost !== undefined
  );

  const totalFreightCost = productsWithFreight.reduce((sum, p) => 
    sum + (p.freightCost || 0), 0
  );

  const totalSellerFreight = productsWithFreight.reduce((sum, p) => 
    sum + (p.sellerFreightCost || 0), 0
  );

  return (
    <div className="space-y-6">
      {/* Header com resumo */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-6 w-6" />
            Calculadora de Frete
          </CardTitle>
          <CardDescription>
            Calcule os custos de frete para seus produtos do Mercado Livre
            {initialZipCode && (
              <span className="block text-sm text-green-600 mt-1">
                📋 CEP da sessão anterior carregado: {initialZipCode}
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-4 items-end">
            <div className="flex-1">
              <Label htmlFor="zipcode">CEP de Destino</Label>
              <Input
                id="zipcode"
                placeholder="00000-000"
                value={zipCode}
                onChange={(e) => handleZipCodeChange(e.target.value)}
                maxLength={9}
              />
            </div>
            <Button 
              onClick={calculateAllFreights}
              disabled={!zipCode || products.length === 0}
              className="whitespace-nowrap"
            >
              Calcular Todos
            </Button>
          </div>

          {/* Resumo dos cálculos */}
          {productsWithFreight.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {productsWithFreight.length}
                </div>
                <div className="text-sm text-gray-600">Produtos Calculados</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  R$ {totalFreightCost.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Frete Cliente</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">
                  R$ {totalSellerFreight.toFixed(2)}
                </div>
                <div className="text-sm text-gray-600">Custo Vendedor</div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de produtos */}
      <div className="grid gap-4">
        {products.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Package className="h-12 w-12 text-gray-400 mb-4" />
              <p className="text-gray-500 text-center">
                Nenhum produto encontrado.<br />
                Conecte-se ao Mercado Livre primeiro.
              </p>
            </CardContent>
          </Card>
        ) : (
          products.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardContent className="p-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex-1">
                    <div className="flex items-start gap-4">
                      {product.thumbnail && (
                        <img 
                          src={product.thumbnail} 
                          alt={product.title}
                          className="w-16 h-16 object-cover rounded-lg"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-2 line-clamp-2">
                          {product.title}
                        </h3>
                        <div className="flex items-center gap-4 mb-3">
                          <Badge variant="outline">
                            <DollarSign className="h-3 w-3 mr-1" />
                            R$ {(product.price || product.originalPrice)?.toFixed(2)}
                          </Badge>
                          <Badge variant="secondary">
                            ID: {product.id}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Resultado do frete */}
                    {product.freightCost !== undefined && (
                      <div className="mt-4 p-4 bg-green-50 rounded-lg">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <div className="text-sm text-gray-600">Frete Cliente</div>
                            <div className="text-lg font-semibold text-green-700">
                              R$ {product.freightCost.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Custo Vendedor</div>
                            <div className="text-lg font-semibold text-orange-700">
                              R$ {product.sellerFreightCost?.toFixed(2)}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-gray-600">Método</div>
                            <div className="text-sm font-medium">
                              {product.freightMethod}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <Button
                      onClick={() => calculateFreight(product.id)}
                      disabled={!zipCode || loadingFreight[product.id]}
                      size="sm"
                    >
                      {loadingFreight[product.id] ? (
                        <>
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                          Calculando...
                        </>
                      ) : (
                        <>
                          <MapPin className="h-4 w-4 mr-2" />
                          Calcular
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};
