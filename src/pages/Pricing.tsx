import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calculator, Upload, Settings, BarChart3, DollarSign, TrendingUp } from "lucide-react";
import { DataImportPanel } from "@/components/pricing/DataImportPanel";
import { CostManagementPanel } from "@/components/pricing/CostManagementPanel";
import { TaxSettingsPanel } from "@/components/pricing/TaxSettingsPanel";
import { PricingDashboard } from "@/components/pricing/PricingDashboard";

export default function Pricing() {
  const [activeTab, setActiveTab] = useState('dashboard');

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Sistema de Precificação</h1>
        <p className="text-muted-foreground">
          Gerencie custos, impostos e calcule preços otimizados para seus produtos
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Importação
          </TabsTrigger>
          <TabsTrigger value="costs" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Custos
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="space-y-6">
          <PricingDashboard />
        </TabsContent>

        <TabsContent value="import" className="space-y-6">
          <DataImportPanel />
          
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Como Funciona a Precificação
              </CardTitle>
              <CardDescription>
                Entenda como o sistema calcula os preços sugeridos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold">1</span>
                      </div>
                      <h4 className="font-medium">Custo Base</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Preço de compra do produto + impostos calculados conforme regime tributário
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold">2</span>
                      </div>
                      <h4 className="font-medium">Custos Adicionais</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Rateio proporcional de custos fixos + custos operacionais + custos percentuais
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold">3</span>
                      </div>
                      <h4 className="font-medium">Preço Final</h4>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Custo Total ÷ (1 - Margem Desejada%) = Preço de Venda Sugerido
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="bg-muted/50 p-4 rounded-lg">
                <h4 className="font-medium mb-2">Fórmula de Cálculo:</h4>
                <div className="space-y-2 text-sm">
                  <div><strong>Custo Total</strong> = Preço Compra + Impostos + Custos Adicionais + Custo Operacional Rateado</div>
                  <div><strong>Preço Sugerido</strong> = Custo Total ÷ (1 - Margem Desejada / 100)</div>
                  <div><strong>Markup</strong> = ((Preço Venda - Custo Total) ÷ Custo Total) × 100</div>
                  <div><strong>Margem</strong> = ((Preço Venda - Custo Total) ÷ Preço Venda) × 100</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-6">
          <CostManagementPanel />
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <TaxSettingsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}