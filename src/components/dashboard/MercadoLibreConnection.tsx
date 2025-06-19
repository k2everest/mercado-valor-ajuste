import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { ShoppingCart, Shield, Zap, AlertCircle, RefreshCw, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MercadoLibreConnectionProps {
  onConnect: (products: any[]) => void;
}

export const MercadoLibreConnection = ({ onConnect }: MercadoLibreConnectionProps) => {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { t } = useLanguage();

  const isConnected = !!localStorage.getItem('ml_access_token');

  const handleDisconnect = () => {
    setDisconnecting(true);
    
    try {
      localStorage.removeItem('ml_access_token');
      localStorage.removeItem('ml_token_timestamp');
      localStorage.removeItem('ml_oauth_state');
      
      toast({
        title: "🔌 Desconectado",
        description: "Sua conta foi desconectada do Mercado Livre com sucesso",
      });
      
      onConnect([]);
      
    } catch (error) {
      console.error('Erro ao desconectar:', error);
      toast({
        title: "❌ Erro",
        description: "Erro ao desconectar da conta",
        variant: "destructive"
      });
    } finally {
      setDisconnecting(false);
    }
  };

  const testTokenAndLoadProducts = async (token: string) => {
    console.log('🔍 Testando token e carregando produtos...');
    
    try {
      const { data: productsData, error: productsError } = await supabase.functions.invoke('mercadolivre-products', {
        body: { accessToken: token, limit: 1, offset: 0 }
      });

      if (productsError) {
        console.error('❌ Erro ao testar token:', productsError);
        throw new Error(productsError.message);
      }

      console.log('✅ Token válido, carregando todos os produtos...');
      
      const { data: allProductsData, error: allProductsError } = await supabase.functions.invoke('mercadolivre-products', {
        body: { accessToken: token, limit: 50, offset: 0 }
      });

      if (allProductsError) {
        throw new Error(`Erro ao buscar produtos: ${allProductsError.message}`);
      }

      toast({
        title: "✅ Reconectado com sucesso!",
        description: `${allProductsData.products?.length || 0} produtos importados do Mercado Livre`,
      });

      onConnect(allProductsData.products || []);
      return true;

    } catch (error: any) {
      console.error('❌ Token inválido ou erro:', error);
      
      if (error.message?.includes('INVALID_TOKEN') || error.message?.includes('unauthorized')) {
        console.log('🗑️ Removendo token inválido...');
        localStorage.removeItem('ml_access_token');
        localStorage.removeItem('ml_token_timestamp');
        return false;
      }
      
      throw error;
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    
    try {
      console.log('🔄 Iniciando conexão com Mercado Livre...');
      
      const storedToken = localStorage.getItem('ml_access_token');
      if (storedToken) {
        console.log('🔑 Token encontrado, testando validade...');
        
        const isValid = await testTokenAndLoadProducts(storedToken);
        if (isValid) {
          setConnecting(false);
          return;
        }
      }
      
      console.log('🔗 Iniciando nova autenticação OAuth...');
      
      const state = Math.random().toString(36).substring(2, 15);
      localStorage.setItem('ml_oauth_state', state);

      const { data: authData, error: authError } = await supabase.functions.invoke('mercadolivre-auth', {
        body: { action: 'getAuthUrl', state }
      });

      if (authError) {
        console.error('❌ Erro ao obter URL de autorização:', authError);
        throw new Error(`Erro na autorização: ${authError.message}`);
      }

      if (!authData?.authUrl) {
        throw new Error('URL de autorização não recebida');
      }

      console.log('🌐 Abrindo janela de autorização...');

      const authWindow = window.open(
        authData.authUrl,
        'mercadolivre-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!authWindow) {
        throw new Error('Não foi possível abrir a janela de autorização. Verifique se o popup não foi bloqueado.');
      }

      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'MERCADOLIVRE_AUTH_SUCCESS') {
          const { code, state: returnedState } = event.data;
          
          console.log('✅ Autorização bem-sucedida');
          
          const savedState = localStorage.getItem('ml_oauth_state');
          if (returnedState !== savedState) {
            throw new Error('Parâmetro de estado inválido');
          }

          try {
            const { data: tokenData, error: tokenError } = await supabase.functions.invoke('mercadolivre-auth', {
              body: { action: 'exchangeCode', code }
            });

            if (tokenError) {
              throw new Error(`Erro ao obter token: ${tokenError.message}`);
            }

            console.log('🔑 Token obtido, salvando e testando...');
            localStorage.setItem('ml_access_token', tokenData.access_token);
            localStorage.setItem('ml_token_timestamp', Date.now().toString());
            
            await testTokenAndLoadProducts(tokenData.access_token);
            
          } catch (error: any) {
            console.error('❌ Erro no processamento:', error);
            toast({
              title: "❌ Erro na conexão",
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
          console.error('❌ Erro na autorização:', event.data.error);
          toast({
            title: "❌ Erro na conexão",
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

      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          localStorage.removeItem('ml_oauth_state');
          setConnecting(false);
        }
      }, 1000);

    } catch (error: any) {
      console.error('❌ Erro na conexão:', error);
      toast({
        title: "❌ Erro na conexão",
        description: error.message || "Não foi possível conectar com o Mercado Livre",
        variant: "destructive"
      });
      setConnecting(false);
    }
  };

  if (isConnected) {
    return (
      <div className="max-w-2xl mx-auto">
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center">
            <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <ShoppingCart className="h-10 w-10 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-700">Conectado ao Mercado Livre</CardTitle>
            <CardDescription className="text-lg">
              Sua conta está conectada e sincronizada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <Button
                onClick={handleConnect}
                disabled={connecting}
                variant="outline"
                className="flex-1"
              >
                {connecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Reconectando...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reconectar
                  </>
                )}
              </Button>
              
              <Button
                onClick={handleDisconnect}
                disabled={disconnecting}
                variant="destructive"
                className="flex-1"
              >
                {disconnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Desconectando...
                  </>
                ) : (
                  <>
                    <Unlink className="h-4 w-4 mr-2" />
                    Desconectar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

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
            {connecting ? (
              <>
                <RefreshCw className="h-5 w-5 mr-2 animate-spin" />
                Conectando...
              </>
            ) : (
              "Conectar com Mercado Livre"
            )}
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
