
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { Download, Minus, Plus, Package } from "lucide-react";

interface Product {
  id: string;
  title: string;
  originalPrice: number;
  status: 'active' | 'paused' | 'closed';
  freeShipping: boolean;
  adjustedPrice?: number;
}

// Mock data
const mockProducts: Product[] = [
  {
    id: '1',
    title: 'iPhone 13 128GB - Azul',
    originalPrice: 3299.99,
    status: 'active',
    freeShipping: true
  },
  {
    id: '2',
    title: 'Notebook Dell Inspiron 15 3000',
    originalPrice: 2899.90,
    status: 'active',
    freeShipping: true
  },
  {
    id: '3',
    title: 'Smart TV Samsung 43" UHD 4K',
    originalPrice: 1899.99,
    status: 'paused',
    freeShipping: false
  },
  {
    id: '4',
    title: 'Fone de Ouvido Sony WH-1000XM4',
    originalPrice: 1299.99,
    status: 'active',
    freeShipping: true
  }
];

export const ProductsList = () => {
  const [products, setProducts] = useState<Product[]>(mockProducts);
  const [shippingCost] = useState(25.00); // Default shipping cost
  const { t } = useLanguage();

  const adjustPrice = (productId: string, operation: 'add' | 'subtract') => {
    setProducts(prev => prev.map(product => {
      if (product.id === productId) {
        const adjustment = operation === 'add' ? shippingCost : -shippingCost;
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
        const adjustment = operation === 'add' ? shippingCost : -shippingCost;
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
      ['ID', 'Título', 'Preço Original', 'Preço Ajustado', 'Status', 'Frete Grátis'].join(','),
      ...products.map(product => [
        product.id,
        `"${product.title}"`,
        product.originalPrice.toFixed(2),
        (product.adjustedPrice || product.originalPrice).toFixed(2),
        product.status,
        product.freeShipping ? 'Sim' : 'Não'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'produtos_ajustados.csv';
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

  return (
    <div className="space-y-6">
      {/* Action Buttons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Ações em Massa
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
                  <h3 className="font-semibold text-lg mb-2">{product.title}</h3>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Preço Original:</span>{' '}
                      <span className="text-lg font-bold text-blue-600">
                        R$ {product.originalPrice.toFixed(2)}
                      </span>
                    </div>
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
                  </div>
                </div>

                {product.freeShipping && (
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adjustPrice(product.id, 'subtract')}
                      className="flex items-center gap-1"
                    >
                      <Minus className="h-4 w-4" />
                      Subtrair Frete
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => adjustPrice(product.id, 'add')}
                      className="flex items-center gap-1"
                    >
                      <Plus className="h-4 w-4" />
                      Somar Frete
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
