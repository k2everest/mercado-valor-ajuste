
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { ShoppingCart, Shield, Zap, AlertCircle } from "lucide-react";
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
      console.log('Iniciando conexão com Mercado Livre...');
      
      // Generate a random state for security
      const state = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('ml_oauth_state', state);

      // Get authorization URL from edge function
      console.log('Solicitando URL de autorização...');
      const { data: authData, error: authError } = await supabase.functions.invoke('mercadolivre-auth', {
        body: { action: 'getAuthUrl', state }
      });

      if (authError) {
        console.error('Erro ao obter URL de autorização:', authError);
        throw new Error(`Erro na autorização: ${authError.message}`);
      }

      if (!authData?.authUrl) {
        throw new Error('URL de autorização não recebida');
      }

      console.log('URL de autorização recebida, abrindo janela...');

      // Open authorization window
      const authWindow = window.open(
        authData.authUrl,
        'mercadolivre-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!authWindow) {
        throw new Error('Não foi possível abrir a janela de autorização. Verifique se o popup não foi bloqueado.');
      }

      // Listen for the callback
      const handleMessage = async (event: MessageEvent) => {
        console.log('Mensagem recebida:', event.data);
        
        if (event.origin !== window.location.origin) {
          console.log('Origem inválida, ignorando mensagem');
          return;
        }

        if (event.data.type === 'MERCADOLIVRE_AUTH_SUCCESS') {
          const { code, state: returnedState } = event.data;
          
          console.log('Autorização bem-sucedida, trocando código...');
          
          // Verify state parameter
          const savedState = localStorage.getItem('ml_oauth_state');
          if (returnedState !== savedState) {
            throw new Error('Parâmetro de estado inválido - possível ataque de segurança');
          }

          try {
            // Exchange code for access token
            const { data: tokenData, error: tokenError } = await supabase.functions.invoke('mercadolivre-auth', {
              body: { action: 'exchangeCode', code }
            });

            if (tokenError) {
              console.error('Erro na troca do código:', tokenError);
              throw new Error(`Erro ao obter token: ${tokenError.message}`);
            }

            console.log('Token obtido com sucesso, buscando produtos...');

            // Store access token securely
            localStorage.setItem('ml_access_token', tokenData.access_token);
            
            // Fetch products
            const { data: productsData, error: productsError } = await supabase.functions.invoke('mercadolivre-products', {
              body: { accessToken: tokenData.access_token }
            });

            if (productsError) {
              console.error('Erro ao buscar produtos:', productsError);
              throw new Error(`Erro ao buscar produtos: ${productsError.message}`);
            }

            console.log('Produtos obtidos:', productsData.products?.length || 0);

            toast({
              title: "Conexão realizada com sucesso!",
              description: `${productsData.products?.length || 0} produtos importados do Mercado Livre`,
            });

            onConnect(productsData.products || []);
            
          } catch (error: any) {
            console.error('Erro no processamento:', error);
            toast({
              title: "Erro na conexão",
              description: error.message || "Erro ao processar autenticação",
              variant: "destructive"
            });
          } finally {
            authWindow?.close();
            window.removeEventListener('message', handleMessage);
            localStorage.removeItem('ml_oauth_state');
            setConnecting(false);
          }
        }

        if (event.data.type === 'MERCADOLIVRE_AUTH_ERROR') {
          console.error('Erro na autorização:', event.data.error);
          toast({
            title: "Erro na conexão",
            description: event.data.error || 'Falha na autenticação',
            variant: "destructive"
          });
          authWindow?.close();
          window.removeEventListener('message', handleMessage);
          localStorage.removeItem('ml_oauth_state');
          setConnecting(false);
        }
      };

      window.addEventListener('message', handleMessage);

      // Check if window was closed manually
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          console.log('Janela fechada pelo usuário');
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          localStorage.removeItem('ml_oauth_state');
          setConnecting(false);
        }
      }, 1000);

    } catch (error: any) {
      console.error('Erro na conexão:', error);
      toast({
        title: "Erro na conexão",
        description: error.message || "Não foi possível conectar com o Mercado Livre",
        variant: "destructive"
      });
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
            <div className="flex items-center space-x-3 p-4 bg-orange-50 rounded-lg">
              <AlertCircle className="h-6 w-6 text-orange-600" />
              <div>
                <h4 className="font-medium text-orange-900">Importante</h4>
                <p className="text-sm text-orange-700">Permita pop-ups para completar a autenticação</p>
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
