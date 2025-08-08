import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  AlertTriangle,
  RefreshCw,
  Download,
  Eye,
  BarChart3
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface PricingCalculation {
  id: string;
  product_id: string;
  purchase_cost: number;
  additional_costs: number;
  tax_cost: number;
  total_cost: number;
  current_selling_price?: number;
  suggested_price: number;
  current_markup?: number;
  suggested_markup: number;
  margin_percentage: number;
  calculated_at: string;
  products: {
    id: string;
    sku: string;
    name: string;
    purchase_price: number;
    selling_price?: number;
    category?: string;
    brand?: string;
  };
}

interface DashboardSummary {
  totalProducts: number;
  averageMarkup: number;
  totalCost: number;
  totalSuggestedRevenue: number;
  profitabilityScore: number;
  underperformingProducts: number;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export const PricingDashboard: React.FC = () => {
  const [calculations, setCalculations] = useState<PricingCalculation[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'markup' | 'margin' | 'cost' | 'name'>('margin');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const { toast } = useToast();

  const loadPricingData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('pricing_calculations')
        .select(`
          *,
          products:product_id (
            id,
            sku,
            name,
            purchase_price,
            selling_price,
            category,
            brand
          )
        `)
        .order('calculated_at', { ascending: false });

      if (error) throw error;

      setCalculations(data || []);
      
      // Calculate summary
      if (data && data.length > 0) {
        const totalProducts = data.length;
        const averageMarkup = data.reduce((sum, calc) => sum + calc.suggested_markup, 0) / totalProducts;
        const totalCost = data.reduce((sum, calc) => sum + calc.total_cost, 0);
        const totalSuggestedRevenue = data.reduce((sum, calc) => sum + calc.suggested_price, 0);
        const underperformingProducts = data.filter(calc => calc.margin_percentage < 20).length;
        const profitabilityScore = ((totalSuggestedRevenue - totalCost) / totalSuggestedRevenue) * 100;

        setSummary({
          totalProducts,
          averageMarkup,
          totalCost,
          totalSuggestedRevenue,
          profitabilityScore,
          underperformingProducts,
        });
      }

    } catch (error) {
      console.error('Erro ao carregar dados de precificação:', error);
      toast({
        title: "Erro ao carregar dados",
        description: "Não foi possível carregar os dados de precificação",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  const calculateNewPricing = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-pricing', {
        body: { includeCosts: true, updatePrices: false }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "Precificação recalculada",
        description: `${data.data.summary.totalProducts} produtos atualizados`,
      });

      await loadPricingData();

    } catch (error) {
      console.error('Erro ao recalcular precificação:', error);
      toast({
        title: "Erro ao recalcular",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, loadPricingData]);

  const updateProductPrices = useCallback(async () => {
    if (!confirm('Tem certeza que deseja atualizar todos os preços com as sugestões calculadas?')) {
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('calculate-pricing', {
        body: { includeCosts: true, updatePrices: true }
      });

      if (error) throw error;
      if (!data.success) throw new Error(data.error);

      toast({
        title: "Preços atualizados",
        description: `Preços atualizados para ${data.data.summary.totalProducts} produtos`,
      });

      await loadPricingData();

    } catch (error) {
      console.error('Erro ao atualizar preços:', error);
      toast({
        title: "Erro ao atualizar preços",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast, loadPricingData]);

  useEffect(() => {
    loadPricingData();
  }, [loadPricingData]);

  // Filter and sort calculations
  const filteredCalculations = calculations
    .filter(calc => {
      const matchesCategory = selectedCategory === 'all' || calc.products?.category === selectedCategory;
      const matchesSearch = searchTerm === '' || 
        calc.products?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        calc.products?.sku.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      let aValue: number | string, bValue: number | string;
      
      switch (sortBy) {
        case 'markup':
          aValue = a.suggested_markup;
          bValue = b.suggested_markup;
          break;
        case 'margin':
          aValue = a.margin_percentage;
          bValue = b.margin_percentage;
          break;
        case 'cost':
          aValue = a.total_cost;
          bValue = b.total_cost;
          break;
        case 'name':
          aValue = a.products?.name || '';
          bValue = b.products?.name || '';
          break;
        default:
          aValue = a.margin_percentage;
          bValue = b.margin_percentage;
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      } else {
        return sortOrder === 'asc' ? (aValue as number) - (bValue as number) : (bValue as number) - (aValue as number);
      }
    });

  // Get unique categories
  const categories = Array.from(new Set(
    calculations
      .map(calc => calc.products?.category)
      .filter(Boolean)
  ));

  // Prepare chart data
  const markupDistribution = [
    { name: '0-20%', count: filteredCalculations.filter(c => c.suggested_markup <= 20).length },
    { name: '21-50%', count: filteredCalculations.filter(c => c.suggested_markup > 20 && c.suggested_markup <= 50).length },
    { name: '51-100%', count: filteredCalculations.filter(c => c.suggested_markup > 50 && c.suggested_markup <= 100).length },
    { name: '100%+', count: filteredCalculations.filter(c => c.suggested_markup > 100).length },
  ];

  const categoryData = categories.map(category => ({
    name: category,
    products: calculations.filter(c => c.products?.category === category).length,
    averageMargin: calculations
      .filter(c => c.products?.category === category)
      .reduce((sum, c, _, arr) => sum + c.margin_percentage / arr.length, 0),
  }));

  const getMarginColor = (margin: number) => {
    if (margin >= 30) return 'bg-green-500';
    if (margin >= 20) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getMarginBadgeVariant = (margin: number) => {
    if (margin >= 30) return 'default';
    if (margin >= 20) return 'secondary';
    return 'destructive';
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Produtos</p>
                  <p className="text-2xl font-bold">{summary.totalProducts}</p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Markup Médio</p>
                  <p className="text-2xl font-bold">{summary.averageMarkup.toFixed(1)}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Receita Sugerida</p>
                  <p className="text-2xl font-bold">R$ {summary.totalSuggestedRevenue.toFixed(0)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Score de Rentabilidade</p>
                  <p className="text-2xl font-bold">{summary.profitabilityScore.toFixed(1)}%</p>
                </div>
                <BarChart3 className="h-8 w-8 text-muted-foreground" />
              </div>
              <Progress value={summary.profitabilityScore} className="mt-2" />
            </CardContent>
          </Card>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2">
        <Button onClick={calculateNewPricing} disabled={isLoading}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Recalcular Precificação
        </Button>
        <Button onClick={updateProductPrices} disabled={isLoading} variant="outline">
          <TrendingUp className="h-4 w-4 mr-2" />
          Aplicar Preços Sugeridos
        </Button>
        <Button disabled={isLoading} variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Exportar Relatório
        </Button>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Distribuição de Markup</CardTitle>
            <CardDescription>Quantidade de produtos por faixa de markup</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={markupDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Produtos por Categoria</CardTitle>
            <CardDescription>Margem média por categoria</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="products"
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Table */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div>
              <CardTitle>Análise de Precificação</CardTitle>
              <CardDescription>Detalhamento por produto com custos e margens</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48"
              />
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas categorias</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={(value: 'markup' | 'margin' | 'cost' | 'name') => setSortBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="margin">Margem</SelectItem>
                  <SelectItem value="markup">Markup</SelectItem>
                  <SelectItem value="cost">Custo</SelectItem>
                  <SelectItem value="name">Nome</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {filteredCalculations.length === 0 ? (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Nenhum dado de precificação encontrado. Execute o cálculo de precificação primeiro.
              </AlertDescription>
            </Alert>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Custo Total</TableHead>
                  <TableHead>Preço Atual</TableHead>
                  <TableHead>Preço Sugerido</TableHead>
                  <TableHead>Markup</TableHead>
                  <TableHead>Margem</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCalculations.map((calc) => (
                  <TableRow key={calc.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{calc.products?.name}</div>
                        <div className="text-sm text-muted-foreground">
                          SKU: {calc.products?.sku}
                          {calc.products?.category && (
                            <Badge variant="outline" className="ml-2">
                              {calc.products.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <div>R$ {calc.total_cost.toFixed(2)}</div>
                        <div className="text-muted-foreground">
                          Compra: R$ {calc.purchase_cost.toFixed(2)}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {calc.current_selling_price ? (
                        <div>R$ {calc.current_selling_price.toFixed(2)}</div>
                      ) : (
                        <span className="text-muted-foreground">Não definido</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">R$ {calc.suggested_price.toFixed(2)}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{calc.suggested_markup.toFixed(1)}%</div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={getMarginBadgeVariant(calc.margin_percentage)}>
                        {calc.margin_percentage.toFixed(1)}%
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div 
                          className={`w-3 h-3 rounded-full ${getMarginColor(calc.margin_percentage)}`}
                        />
                        {calc.margin_percentage < 20 && (
                          <AlertTriangle className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
};