
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { Settings, Save } from "lucide-react";

export const SettingsPanel = () => {
  const [shippingCost, setShippingCost] = useState(25.00);
  const { t } = useLanguage();

  const handleSave = () => {
    toast({
      title: "Configurações salvas!",
      description: `Custo de frete definido como R$ ${shippingCost.toFixed(2)}`,
    });
  };

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
        </div>

        <div className="flex justify-end">
          <Button onClick={handleSave} className="flex items-center gap-2">
            <Save className="h-4 w-4" />
            Salvar Configurações
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
