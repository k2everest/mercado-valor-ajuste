import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Calculator, Save, AlertCircle, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface TaxSettings {
  id?: string;
  user_id?: string;
  tax_regime: string;
  cnpj?: string;
  state_ie?: string;
  simples_percentage: number;
  icms_percentage: number;
  ipi_percentage: number;
  pis_percentage: number;
  cofins_percentage: number;
  operational_cost_monthly: number;
  expected_tickets_monthly: number;
  target_margin_percentage: number;
  created_at?: string;
  updated_at?: string;
}

export const TaxSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<TaxSettings>({
    tax_regime: 'simples_nacional',
    cnpj: '',
    state_ie: '',
    simples_percentage: 6.0,
    icms_percentage: 18.0,
    ipi_percentage: 0.0,
    pis_percentage: 1.65,
    cofins_percentage: 7.6,
    operational_cost_monthly: 0,
    expected_tickets_monthly: 100,
    target_margin_percentage: 30.0,
  });

  const [isLoading, setIsLoading] = useState(false);
  const [hasSettings, setHasSettings] = useState(false);
  const { toast } = useToast();

  const loadSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('tax_settings')
        .select('*')
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (data) {
        setSettings(data);
        setHasSettings(true);
      }
    } catch (error) {
      console.error('Erro ao carregar configurações:', error);
    }
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { error } = await supabase
        .from('tax_settings')
        .upsert([{ ...settings, user_id: undefined }], { onConflict: 'user_id' });

      if (error) throw error;

      setHasSettings(true);
      toast({
        title: "Configurações salvas",
        description: "Configurações tributárias atualizadas com sucesso",
      });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      toast({
        title: "Erro ao salvar configurações",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [settings, toast]);

  const handleInputChange = useCallback((field: keyof TaxSettings, value: string | number) => {
    setSettings(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const getSimplesTaxRate = (percentage: number) => {
    // Simulação das alíquotas do Simples Nacional baseadas no faturamento
    if (percentage <= 4.0) return "Anexo III - Serviços";
    if (percentage <= 6.0) return "Anexo I - Comércio";
    if (percentage <= 8.5) return "Anexo II - Indústria";
    return "Anexo IV/V - Serviços";
  };

  const calculateMonthlyTaxBurden = () => {
    const operationalCost = settings.operational_cost_monthly;
    const expectedRevenue = operationalCost / (settings.target_margin_percentage / 100);
    
    if (settings.tax_regime === 'simples_nacional') {
      return expectedRevenue * (settings.simples_percentage / 100);
    } else {
      return expectedRevenue * (
        (settings.icms_percentage / 100) +
        (settings.ipi_percentage / 100) +
        (settings.pis_percentage / 100) +
        (settings.cofins_percentage / 100)
      );
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Configurações Tributárias
        </CardTitle>
        <CardDescription>
          Configure o regime tributário e parâmetros para cálculo de impostos
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Informações da Empresa */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Informações da Empresa</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cnpj">CNPJ</Label>
                <Input
                  id="cnpj"
                  value={settings.cnpj || ''}
                  onChange={(e) => handleInputChange('cnpj', e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state_ie">Inscrição Estadual</Label>
                <Input
                  id="state_ie"
                  value={settings.state_ie || ''}
                  onChange={(e) => handleInputChange('state_ie', e.target.value)}
                  placeholder="123.456.789.012"
                />
              </div>
            </div>
          </div>

          {/* Regime Tributário */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Regime Tributário</h3>
            <div className="space-y-2">
              <Label htmlFor="tax_regime">Regime Tributário *</Label>
              <Select
                value={settings.tax_regime}
                onValueChange={(value: 'simples_nacional' | 'lucro_real' | 'lucro_presumido') => 
                  handleInputChange('tax_regime', value)
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples_nacional">Simples Nacional</SelectItem>
                  <SelectItem value="lucro_real">Lucro Real</SelectItem>
                  <SelectItem value="lucro_presumido">Lucro Presumido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Alíquotas de Impostos */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Alíquotas de Impostos (%)</h3>
            
            {settings.tax_regime === 'simples_nacional' ? (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="simples_percentage">Alíquota do Simples Nacional (%)</Label>
                  <Input
                    id="simples_percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="30"
                    value={settings.simples_percentage}
                    onChange={(e) => handleInputChange('simples_percentage', parseFloat(e.target.value) || 0)}
                    required
                  />
                  <p className="text-sm text-muted-foreground">
                    {getSimplesTaxRate(settings.simples_percentage)}
                  </p>
                </div>
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    No Simples Nacional, a alíquota única engloba todos os impostos federais, estaduais e municipais.
                  </AlertDescription>
                </Alert>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="icms_percentage">ICMS (%)</Label>
                  <Input
                    id="icms_percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="30"
                    value={settings.icms_percentage}
                    onChange={(e) => handleInputChange('icms_percentage', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ipi_percentage">IPI (%)</Label>
                  <Input
                    id="ipi_percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="20"
                    value={settings.ipi_percentage}
                    onChange={(e) => handleInputChange('ipi_percentage', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pis_percentage">PIS (%)</Label>
                  <Input
                    id="pis_percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    value={settings.pis_percentage}
                    onChange={(e) => handleInputChange('pis_percentage', parseFloat(e.target.value) || 0)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cofins_percentage">COFINS (%)</Label>
                  <Input
                    id="cofins_percentage"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={settings.cofins_percentage}
                    onChange={(e) => handleInputChange('cofins_percentage', parseFloat(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Custos Operacionais */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Custos Operacionais</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="operational_cost_monthly">Custo Operacional Mensal (R$)</Label>
                <Input
                  id="operational_cost_monthly"
                  type="number"
                  step="0.01"
                  min="0"
                  value={settings.operational_cost_monthly}
                  onChange={(e) => handleInputChange('operational_cost_monthly', parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                />
                <p className="text-sm text-muted-foreground">
                  Soma de todos os custos fixos mensais (aluguel, funcionários, etc.)
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expected_tickets_monthly">Vendas Esperadas/Mês</Label>
                <Input
                  id="expected_tickets_monthly"
                  type="number"
                  min="1"
                  value={settings.expected_tickets_monthly}
                  onChange={(e) => handleInputChange('expected_tickets_monthly', parseInt(e.target.value) || 1)}
                  placeholder="100"
                />
                <p className="text-sm text-muted-foreground">
                  Quantidade de vendas esperadas por mês
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="target_margin_percentage">Margem Desejada (%)</Label>
                <Input
                  id="target_margin_percentage"
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={settings.target_margin_percentage}
                  onChange={(e) => handleInputChange('target_margin_percentage', parseFloat(e.target.value) || 0)}
                  placeholder="30.0"
                />
                <p className="text-sm text-muted-foreground">
                  Margem de lucro desejada sobre o preço final
                </p>
              </div>
            </div>
          </div>

          {/* Resumo Fiscal */}
          {settings.operational_cost_monthly > 0 && (
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Resumo Fiscal Estimado</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      R$ {(settings.operational_cost_monthly / settings.expected_tickets_monthly).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">Custo Operacional por Venda</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      R$ {calculateMonthlyTaxBurden().toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">Carga Tributária Mensal Estimada</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-2xl font-bold">
                      {settings.tax_regime === 'simples_nacional' 
                        ? settings.simples_percentage.toFixed(2)
                        : (settings.icms_percentage + settings.ipi_percentage + settings.pis_percentage + settings.cofins_percentage).toFixed(2)
                      }%
                    </div>
                    <p className="text-xs text-muted-foreground">Alíquota Total</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <Button type="submit" disabled={isLoading}>
              <Save className="h-4 w-4 mr-2" />
              {isLoading ? 'Salvando...' : hasSettings ? 'Atualizar Configurações' : 'Salvar Configurações'}
            </Button>
          </div>
        </form>

        <Alert className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Importante:</strong> Estas configurações afetarão todos os cálculos de precificação. 
            Consulte seu contador para definir as alíquotas corretas conforme sua atividade e localização.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};