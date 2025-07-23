
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useFreightCalculation } from "@/hooks/useFreightCalculation";
import { FreightSummaryHeader } from "./FreightSummaryHeader";
import { Calculator, MapPin, Package, DollarSign } from "lucide-react";
import { Product } from './types';
import { InputValidator } from '@/utils/inputValidation';

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
  const [zipCodeError, setZipCodeError] = useState('');
  const { fetchFreightCosts } = useFreightCalculation();

  // Atualizar CEP quando o inicial mudar
  useEffect(() => {
    if (initialZipCode && !zipCode) {
      setZipCode(initialZipCode);
    }
  }, [initialZipCode, zipCode]);

  const handleZipCodeChange = (value: string) => {
    setZipCode(value);
    setZipCodeError('');
    onZipCodeChange?.(value);
  };

  const calculateFreight = async (productId: string) => {
    const result = await fetchFreightCosts(productId, zipCode);
    if (result && typeof result === 'object' && 'freightCost' in result) {
      onFreightCalculated(productId, {
        freightCost: result.freightCost,
        sellerFreightCost: result.sellerFreightCost,
        freightMethod: result.freightMethod
      });
    }
  };

  const calculateAllFreights = async () => {
    // Validate CEP format
    if (!InputValidator.validateCEP(zipCode)) {
      setZipCodeError('CEP deve ter o formato 00000-000 ou 00000000');
      return;
    }
    
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
                className={zipCodeError ? 'border-red-500' : ''}
              />
              {zipCodeError && (
                <p className="text-sm text-red-500 mt-1">{zipCodeError}</p>
              )}
            </div>
            <Button 
              onClick={calculateAllFreights}
              disabled={!zipCode || products.length === 0}
              className="whitespace-nowrap"
            >
              Calcular Todos
            </Button>
          </div>

          {/* Resumo dos cálculos - Nova versão com economia prevista */}
          {productsWithFreight.length > 0 && <FreightSummaryHeader products={productsWithFreight} />}
        </CardContent>
      </Card>

    </div>
  );
};
