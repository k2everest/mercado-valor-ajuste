import { useState, useEffect } from 'react';
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Package, DollarSign, Calculator } from "lucide-react";
import { Product } from './types';

interface FreightSummaryHeaderProps {
  products: Product[];
}

interface UserSettings {
  stock_sales_percentage: number;
  predicted_savings_enabled: boolean;
  standard_deviation_enabled: boolean;
}

export const FreightSummaryHeader = ({ products }: FreightSummaryHeaderProps) => {
  const { user } = useAuth();
  const [settings, setSettings] = useState<UserSettings>({
    stock_sales_percentage: 10.0,
    predicted_savings_enabled: true,
    standard_deviation_enabled: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      
      try {
        const { data } = await supabase
          .from('user_settings')
          .select('stock_sales_percentage, predicted_savings_enabled, standard_deviation_enabled')
          .eq('user_id', user.id)
          .single();

        if (data) {
          setSettings({
            stock_sales_percentage: data.stock_sales_percentage || 10.0,
            predicted_savings_enabled: data.predicted_savings_enabled ?? true,
            standard_deviation_enabled: data.standard_deviation_enabled ?? true
          });
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, [user]);

  // Calculate metrics
  const totalFreightCost = products.reduce((sum, p) => sum + (p.freightCost || 0), 0);
  const totalSellerFreight = products.reduce((sum, p) => sum + (p.sellerFreightCost || 0), 0);
  const totalSavings = totalSellerFreight - totalFreightCost;
  
  // Calculate predicted savings based on stock percentage
  const stockUsageMultiplier = settings.stock_sales_percentage / 100;
  const predictedSavings = totalSavings * stockUsageMultiplier;
  
  // Calculate standard deviation for products with sales data
  const productsWithSales = products.filter(p => p.soldQuantity !== undefined && p.soldQuantity > 0);
  const salesData = productsWithSales.map(p => p.soldQuantity || 0);
  const meanSales = salesData.length > 0 ? salesData.reduce((a, b) => a + b, 0) / salesData.length : 0;
  const variance = salesData.length > 0 ? 
    salesData.reduce((acc, val) => acc + Math.pow(val - meanSales, 2), 0) / salesData.length : 0;
  const standardDeviation = Math.sqrt(variance);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="animate-pulse bg-gray-300 h-8 w-16 mx-auto rounded mb-2"></div>
          <div className="text-sm text-gray-600">Carregando...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Main metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gradient-to-r from-blue-50 to-green-50 rounded-lg border border-blue-200">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Package className="h-5 w-5 text-blue-600 mr-1" />
          </div>
          <div className="text-2xl font-bold text-blue-600">
            {products.length}
          </div>
          <div className="text-sm text-gray-600">Produtos Calculados</div>
        </div>
        
        {settings.predicted_savings_enabled ? (
          <div className="text-center">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-5 w-5 text-green-600 mr-1" />
            </div>
            <div className="text-2xl font-bold text-green-600">
              R$ {predictedSavings.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">
              Economia Prevista ({settings.stock_sales_percentage}% vendas)
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              R$ {totalFreightCost.toFixed(2)}
            </div>
            <div className="text-sm text-gray-600">Frete Cliente</div>
          </div>
        )}
        
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <DollarSign className="h-5 w-5 text-orange-600 mr-1" />
          </div>
          <div className="text-2xl font-bold text-orange-600">
            R$ {totalSellerFreight.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Custo Vendedor Total</div>
        </div>
        
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <Calculator className="h-5 w-5 text-purple-600 mr-1" />
          </div>
          <div className="text-2xl font-bold text-purple-600">
            R$ {totalSavings.toFixed(2)}
          </div>
          <div className="text-sm text-gray-600">Economia Total Possível</div>
        </div>
      </div>

      {/* Standard deviation analysis */}
      {settings.standard_deviation_enabled && productsWithSales.length > 0 && (
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-900 mb-2">📊 Análise Estatística de Vendas</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Produtos com histórico:</span>
              <span className="font-semibold ml-2">{productsWithSales.length}</span>
            </div>
            <div>
              <span className="text-gray-600">Vendas médias:</span>
              <span className="font-semibold ml-2">{meanSales.toFixed(1)} unidades</span>
            </div>
            <div>
              <span className="text-gray-600">Desvio padrão:</span>
              <span className="font-semibold ml-2">±{standardDeviation.toFixed(1)} unidades</span>
            </div>
          </div>
          <p className="text-xs text-blue-700 mt-2">
            💡 Produtos com vendas consistentes (baixo desvio padrão) são melhores candidatos para otimização de frete
          </p>
        </div>
      )}
    </div>
  );
};