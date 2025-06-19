
import { useState } from 'react';
import { Button } from "@/components/ui/button";
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
  const [selectedLimit, setSelectedLimit] = useState<string>("50"); // Changed from 20 to 50

  const handleLoadMore = () => {
    const limit = parseInt(selectedLimit);
    onLoadMore(limit);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Controle de Carregamento
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Status Info */}
          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">
              Carregados: {currentProductsCount} de {pagination.total}
            </Badge>
            {pagination.hasMore && (
              <Badge variant="secondary">
                Mais {pagination.total - currentProductsCount} disponíveis
              </Badge>
            )}
          </div>

          {/* Load More Controls */}
          {pagination.hasMore && (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex items-center gap-2">
                <label htmlFor="limit-select" className="text-sm font-medium whitespace-nowrap">
                  Carregar mais:
                </label>
                <Select 
                  value={selectedLimit} 
                  onValueChange={setSelectedLimit}
                  disabled={loading}
                >
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex gap-2">
                <Button
                  onClick={handleLoadMore}
                  disabled={loading}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  Carregar +{selectedLimit}
                </Button>
                
                <Button
                  onClick={onLoadAll}
                  disabled={loading}
                  className="flex items-center gap-2"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Package className="h-4 w-4" />
                  )}
                  Carregar Todos
                </Button>
              </div>
            </div>
          )}

          {!pagination.hasMore && currentProductsCount > 0 && (
            <div className="text-center py-2">
              <Badge variant="secondary">
                ✅ Todos os produtos foram carregados
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
