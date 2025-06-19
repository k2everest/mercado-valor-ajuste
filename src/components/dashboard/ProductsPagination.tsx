
import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, Package, RefreshCw } from "lucide-react";

interface PaginationInfo {
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

interface ProductsPaginationProps {
  pagination: PaginationInfo;
  onLoadMore: (limit: number) => void;
  onLoadAll: () => void;
  loading: boolean;
  currentProductsCount: number;
}

export const ProductsPagination = ({ 
  pagination, 
  onLoadMore, 
  onLoadAll, 
  loading, 
  currentProductsCount 
}: ProductsPaginationProps) => {
  const [customLimit, setCustomLimit] = useState<string>("");

  const handleLoadCustom = () => {
    const limit = parseInt(customLimit);
    if (limit > 0 && limit <= 1000) {
      onLoadMore(limit);
      setCustomLimit("");
    }
  };

  return (
    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-800">
          <Package className="h-5 w-5" />
          Controle de Carregamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status Info */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge className="bg-blue-100 text-blue-800 border-blue-200">
              Carregados: {currentProductsCount} de {pagination.total}
            </Badge>
            {pagination.hasMore && (
              <Badge className="bg-purple-100 text-purple-800 border-purple-200">
                Mais {pagination.total - currentProductsCount} disponíveis
              </Badge>
            )}
          </div>

          {/* Load More Controls */}
          {pagination.hasMore && (
            <div className="space-y-4">
              {/* Quick Load Options */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => onLoadMore(20)}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                  +20
                </Button>
                <Button
                  onClick={() => onLoadMore(50)}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                  +50
                </Button>
                <Button
                  onClick={() => onLoadMore(100)}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                  +100
                </Button>
                <Button
                  onClick={() => onLoadMore(200)}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                  +200
                </Button>
                <Button
                  onClick={onLoadAll}
                  disabled={loading}
                  className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white"
                  size="sm"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />}
                  Todos
                </Button>
              </div>

              {/* Custom Amount Input */}
              <div className="flex items-center gap-2">
                <label htmlFor="custom-limit" className="text-sm font-medium whitespace-nowrap text-gray-700">
                  Quantidade personalizada:
                </label>
                <Input
                  id="custom-limit"
                  type="number"
                  value={customLimit}
                  onChange={(e) => setCustomLimit(e.target.value)}
                  placeholder="Ex: 150"
                  className="w-24 border-blue-200 focus:border-blue-400"
                  min="1"
                  max="1000"
                  disabled={loading}
                />
                <Button
                  onClick={handleLoadCustom}
                  disabled={loading || !customLimit || parseInt(customLimit) <= 0}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2 border-purple-200 text-purple-700 hover:bg-purple-50"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                  Carregar
                </Button>
              </div>
            </div>
          )}

          {!pagination.hasMore && currentProductsCount > 0 && (
            <div className="text-center py-2">
              <Badge className="bg-green-100 text-green-800 border-green-200">
                ✅ Todos os produtos foram carregados
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
