
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { ShoppingCart, Shield, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MercadoLibreConnectionProps {
  onConnect: (products: any[]) => void;
}

export const MercadoLibreConnection = ({ onConnect }: MercadoLibreConnectionProps) => {
  const [connecting, setConnecting] = useState(false);
  const { t } = useLanguage();

  const handleConnect = async () => {
    setConnecting(true);
    
    try {
      // Generate a random state for security
      const state = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('ml_oauth_state', state);

      // Get authorization URL from edge function
      const { data: authData, error: authError } = await supabase.functions.invoke('mercadolivre-auth', {
        body: { action: 'getAuthUrl', state }
      });

      if (authError) {
        throw new Error(authError.message);
      }

      // Open authorization window
      const authWindow = window.open(
        authData.authUrl,
        'mercadolivre-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for the callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'MERCADOLIVRE_AUTH_SUCCESS') {
          const { code, state: returnedState } = event.data;
          
          // Verify state parameter
          const savedState = localStorage.getItem('ml_oauth_state');
          if (returnedState !== savedState) {
            throw new Error('Invalid state parameter');
          }

          // Exchange code for access token
          const { data: tokenData, error: tokenError } = await supabase.functions.invoke('mercadolivre-auth', {
            body: { action: 'exchangeCode', code }
          });

          if (tokenError) {
            throw new Error(tokenError.message);
          }

          // Store access token securely
          localStorage.setItem('ml_access_token', tokenData.access_token);
          
          // Fetch products
          const { data: productsData, error: productsError } = await supabase.functions.invoke('mercadolivre-products', {
            body: { accessToken: tokenData.access_token }
          });

          if (productsError) {
            throw new Error(productsError.message);
          }

          toast({
            title: "Conexão realizada com sucesso!",
            description: `${productsData.products.length} produtos importados do Mercado Livre`,
          });

          onConnect(productsData.products);
          authWindow?.close();
          window.removeEventListener('message', handleMessage);
          localStorage.removeItem('ml_oauth_state');
        }

        if (event.data.type === 'MERCADOLIVRE_AUTH_ERROR') {
          throw new Error(event.data.error || 'Falha na autenticação');
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if window was closed manually
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          setConnecting(false);
          localStorage.removeItem('ml_oauth_state');
        }
      }, 1000);

    } catch (error: any) {
      console.error('Connection error:', error);
      toast({
        title: "Erro na conexão",
        description: error.message || "Falha ao conectar com o Mercado Livre",
        variant: "destructive"
      });
    } finally {
      setConnecting(false);
    }
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
                <p className="text-sm text-green-700">Todos os seus produtos ativos serão importados</p>
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
