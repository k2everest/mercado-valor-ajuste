
import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Settings, Save, TrendingUp, BarChart3 } from "lucide-react";

export const SettingsPanel = () => {
  const [shippingCost, setShippingCost] = useState(25.00);
  const [stockSalesPercentage, setStockSalesPercentage] = useState(10.0);
  const [predictedSavingsEnabled, setPredictedSavingsEnabled] = useState(true);
  const [standardDeviationEnabled, setStandardDeviationEnabled] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  
  const { t } = useLanguage();
  const { user } = useAuth();

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      if (!user) return;
      
      try {
        const { data, error } = await supabase
          .from('user_settings')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error loading settings:', error);
          return;
        }

        if (data) {
          setShippingCost(data.shipping_cost || 25.00);
          setStockSalesPercentage(data.stock_sales_percentage || 10.0);
          setPredictedSavingsEnabled(data.predicted_savings_enabled ?? true);
          setStandardDeviationEnabled(data.standard_deviation_enabled ?? true);
        }
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };

    loadSettings();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          shipping_cost: shippingCost,
          stock_sales_percentage: stockSalesPercentage,
          predicted_savings_enabled: predictedSavingsEnabled,
          standard_deviation_enabled: standardDeviationEnabled,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "✅ Configurações salvas!",
        description: `Suas preferências foram atualizadas com sucesso`,
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: "❌ Erro ao salvar",
        description: error.message || "Erro desconhecido",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (loadingSettings) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Carregando configurações...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          {t('dashboard.settings')}
        </CardTitle>
        <CardDescription>
          Configure as preferências para cálculo dos ajustes de preço
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-6">
          {/* Basic Settings */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900">Configurações Básicas</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shipping-cost">{t('dashboard.shipping_cost')}</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    R$
                  </span>
                  <Input
                    id="shipping-cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                    className="pl-10"
                    placeholder="25.00"
                  />
                </div>
                <p className="text-sm text-gray-500">
                  Valor estimado do frete que será usado nos cálculos
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="stock-percentage">Percentual de Vendas do Estoque</Label>
                <div className="relative">
                  <Input
                    id="stock-percentage"
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={stockSalesPercentage}
                    onChange={(e) => setStockSalesPercentage(parseFloat(e.target.value) || 0)}
                    className="pr-8"
                    placeholder="10.0"
                  />
                  <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
                    %
                  </span>
                </div>
                <p className="text-sm text-gray-500">
                  Que percentual do seu estoque você espera vender (para cálculos de economia)
                </p>
              </div>
            </div>
          </div>

          {/* Advanced Settings */}
          <div className="space-y-4 pt-4 border-t border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Configurações Avançadas</h3>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    <Label htmlFor="predicted-savings">Mostrar Economia Prevista</Label>
                  </div>
                  <p className="text-sm text-gray-500">
                    Exibir economia estimada no cabeçalho em vez do total de frete
                  </p>
                </div>
                <Switch
                  id="predicted-savings"
                  checked={predictedSavingsEnabled}
                  onCheckedChange={setPredictedSavingsEnabled}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                    <Label htmlFor="standard-deviation">Análise de Desvio Padrão</Label>
                  </div>
                  <p className="text-sm text-gray-500">
                    Incluir análise estatística baseada no histórico de vendas
                  </p>
                </div>
                <Switch
                  id="standard-deviation"
                  checked={standardDeviationEnabled}
                  onCheckedChange={setStandardDeviationEnabled}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-gray-200">
          <Button 
            onClick={handleSave} 
            disabled={loading}
            className="flex items-center gap-2"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Salvar Configurações
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
