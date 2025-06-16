
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Minus, Plus, Truck } from "lucide-react";
import { Product } from './types';

interface ProductCardProps {
  product: Product;
  onCalculateFreight: (productId: string) => void;
  onAdjustPrice: (productId: string, operation: 'add' | 'subtract') => void;
  loadingFreight: boolean;
  zipCode: string;
}

export const ProductCard = ({ 
  product, 
  onCalculateFreight, 
  onAdjustPrice, 
  loadingFreight, 
  zipCode 
}: ProductCardProps) => {
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
    <Card className="hover:shadow-md transition-shadow">
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
              onClick={() => onCalculateFreight(product.id)}
              disabled={loadingFreight || !zipCode}
              className="flex items-center gap-1"
            >
              <Truck className="h-4 w-4" />
              {loadingFreight ? 'Calculando...' : 'Calcular Custo Real'}
            </Button>
            
            {product.sellerFreightCost !== undefined && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAdjustPrice(product.id, 'subtract')}
                  className="flex items-center gap-1"
                >
                  <Minus className="h-4 w-4" />
                  Subtrair Custo Real
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onAdjustPrice(product.id, 'add')}
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
  );
};
