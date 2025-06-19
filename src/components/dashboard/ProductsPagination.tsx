
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
  const [selectedLimit, setSelectedLimit] = useState<string>("50");
  const [customLimit, setCustomLimit] = useState<string>("");

  const handleLoadMore = () => {
    const limit = parseInt(selectedLimit);
    onLoadMore(limit);
  };

  const handleLoadCustom = () => {
    const limit = parseInt(customLimit);
    if (limit > 0 && limit <= 1000) {
      onLoadMore(limit);
      setCustomLimit("");
    }
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
            <div className="space-y-4">
              {/* Quick Load Options */}
              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={() => onLoadMore(20)}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                  +20
                </Button>
                <Button
                  onClick={() => onLoadMore(50)}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                  +50
                </Button>
                <Button
                  onClick={() => onLoadMore(100)}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                  +100
                </Button>
                <Button
                  onClick={() => onLoadMore(200)}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                  +200
                </Button>
                <Button
                  onClick={onLoadAll}
                  disabled={loading}
                  className="flex items-center gap-2"
                  size="sm"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Package className="h-3 w-3" />}
                  Todos
                </Button>
              </div>

              {/* Custom Amount Input */}
              <div className="flex items-center gap-2">
                <label htmlFor="custom-limit" className="text-sm font-medium whitespace-nowrap">
                  Quantidade personalizada:
                </label>
                <Input
                  id="custom-limit"
                  type="number"
                  value={customLimit}
                  onChange={(e) => setCustomLimit(e.target.value)}
                  placeholder="Ex: 150"
                  className="w-24"
                  min="1"
                  max="1000"
                  disabled={loading}
                />
                <Button
                  onClick={handleLoadCustom}
                  disabled={loading || !customLimit || parseInt(customLimit) <= 0}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                  Carregar
                </Button>
              </div>

              {/* Dropdown Selection (Alternative) */}
              <div className="flex items-center gap-2">
                <label htmlFor="limit-select" className="text-sm font-medium whitespace-nowrap">
                  Ou selecione:
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
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleLoadMore}
                  disabled={loading}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  {loading ? <RefreshCw className="h-3 w-3 animate-spin" /> : <ChevronDown className="h-3 w-3" />}
                  Carregar
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
