
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { ShoppingCart, Shield, Zap } from "lucide-react";

interface MercadoLibreConnectionProps {
  onConnect: () => void;
}

export const MercadoLibreConnection = ({ onConnect }: MercadoLibreConnectionProps) => {
  const [connecting, setConnecting] = useState(false);
  const { t } = useLanguage();

  const handleConnect = () => {
    setConnecting(true);
    // Simulate OAuth connection
    setTimeout(() => {
      setConnecting(false);
      toast({
        title: "Conexão realizada com sucesso!",
        description: "Sua conta do Mercado Livre foi conectada",
      });
      onConnect();
    }, 2000);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="text-center">
          <div className="mx-auto w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <ShoppingCart className="h-10 w-10 text-yellow-600" />
          </div>
          <CardTitle className="text-2xl">{t('dashboard.connect_ml')}</CardTitle>
          <CardDescription className="text-lg">
            Conecte sua conta para importar seus produtos automaticamente
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4">
            <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
              <Shield className="h-6 w-6 text-blue-600" />
              <div>
                <h4 className="font-medium text-blue-900">Conexão Segura</h4>
                <p className="text-sm text-blue-700">Autenticação OAuth oficial do Mercado Livre</p>
              </div>
            </div>
            <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg">
              <Zap className="h-6 w-6 text-green-600" />
              <div>
                <h4 className="font-medium text-green-900">Importação Automática</h4>
                <p className="text-sm text-green-700">Todos os seus produtos serão importados instantaneamente</p>
              </div>
            </div>
          </div>

          <Button
            onClick={handleConnect}
            disabled={connecting}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-semibold py-6 text-lg"
          >
            {connecting ? "Conectando..." : "Conectar com Mercado Livre"}
          </Button>

          <p className="text-xs text-gray-500 text-center">
            Ao conectar, você autoriza o MercadoValor a acessar suas informações de produtos.
            Nenhuma alteração será feita sem sua confirmação.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
