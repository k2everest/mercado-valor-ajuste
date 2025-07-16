import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/hooks/useLanguage";
import { toast } from "@/hooks/use-toast";
import { ShoppingCart, Shield, Zap, AlertCircle, RefreshCw, Unlink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Product, PaginationInfo } from './types';
import { SecureStorage } from '@/utils/secureStorage';
import { InputValidator } from '@/utils/inputValidation';

interface MercadoLibreConnectionProps {
  onConnectionChange: (connected: boolean) => void;
  onConnect: (products: Product[], pagination?: PaginationInfo) => void;
}

export const MercadoLibreConnection = ({ onConnectionChange, onConnect }: MercadoLibreConnectionProps) => {
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const { t } = useLanguage();
  
  // Rate limiter for API calls
  const rateLimiter = InputValidator.createRateLimiter(10, 60000); // 10 requests per minute

  const isConnected = !!SecureStorage.getSecureItem('ml_access_token');

  const handleDisconnect = () => {
    setDisconnecting(true);
    
    try {
      SecureStorage.removeSecureItem('ml_access_token');
      SecureStorage.removeSecureItem('ml_token_timestamp');
      SecureStorage.removeSecureItem('ml_oauth_state');
      
      toast({
        title: "🔌 Desconectado",
        description: "Sua conta foi desconectada do Mercado Livre com sucesso",
      });
      
      onConnectionChange(false);
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

  const loadProducts = async (token: string) => {
    console.log('🔍 Carregando produtos do Mercado Livre...');
    
    // Check rate limit
    if (!rateLimiter.checkLimit()) {
      toast({
        title: "⚠️ Limite de requisições",
        description: `Aguarde ${Math.ceil(rateLimiter.getRemainingTime() / 1000)} segundos antes de tentar novamente`,
        variant: "destructive"
      });
      return false;
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('mercadolivre-products', {
        body: { accessToken: token, limit: 50, offset: 0 }
      });

      if (error) {
        console.error('❌ Erro na API de produtos:', error);
        throw new Error(error.message || 'Erro ao buscar produtos');
      }

      if (!data || data.error) {
        console.error('❌ Resposta inválida da API:', data);
        throw new Error(data?.error || 'Falha ao carregar produtos');
      }

      const products = data.products || [];
      console.log(`✅ Produtos carregados: ${products.length} itens`);

      // Converter produtos para o formato correto
      const formattedProducts = products.map((product: any) => ({
        ...product,
        price: product.originalPrice || product.price
      }));

      onConnect(formattedProducts, data.pagination);
      
      return true;
    } catch (error: any) {
      console.error('❌ Erro ao carregar produtos:', error);
      
      if (error.message?.includes('INVALID_TOKEN') || 
          error.message?.includes('unauthorized') || 
          error.message?.includes('invalid access token')) {
        
        console.log('🗑️ Token inválido, removendo...');
        SecureStorage.removeSecureItem('ml_access_token');
        SecureStorage.removeSecureItem('ml_token_timestamp');
        onConnectionChange(false);
        onConnect([]);
        
        toast({
          title: "🔑 Token Expirado",
          description: "Seu token de acesso expirou. Faça uma nova conexão.",
          variant: "destructive"
        });
        
        return false;
      }
      
      toast({
        title: "❌ Erro ao carregar produtos",
        description: error.message || "Erro ao conectar com o Mercado Livre",
        variant: "destructive"
      });
      
      throw error;
    }
  };

  const handleConnect = async () => {
    if (connecting) {
      console.log('⚠️ Conexão já em andamento...');
      return;
    }
    
    setConnecting(true);
    
    try {
      console.log('🔄 Iniciando processo de conexão...');
      
      // Check rate limit
      if (!rateLimiter.checkLimit()) {
        toast({
          title: "⚠️ Limite de requisições",
          description: `Aguarde ${Math.ceil(rateLimiter.getRemainingTime() / 1000)} segundos antes de tentar novamente`,
          variant: "destructive"
        });
        setConnecting(false);
        return;
      }
      
      // Verificar se já existe um token válido
      const storedToken = SecureStorage.getSecureItem('ml_access_token');
      if (storedToken) {
        console.log('🔑 Token encontrado, testando e carregando produtos...');
        
        try {
          const success = await loadProducts(storedToken);
          if (success) {
            console.log('✅ Reconexão bem-sucedida');
            onConnectionChange(true);
            toast({
              title: "✅ Reconectado com sucesso!",
              description: "Produtos carregados do Mercado Livre",
            });
            return;
          }
        } catch (error) {
          console.log('⚠️ Token existente inválido, iniciando nova autenticação...');
        }
      }
      
      console.log('🔗 Iniciando nova autenticação OAuth...');
      
      // Gerar estado único para OAuth
      const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      SecureStorage.setSecureItem('ml_oauth_state', state);

      // Obter URL de autorização
      const { data: authData, error: authError } = await supabase.functions.invoke('mercadolivre-auth', {
        body: { action: 'getAuthUrl', state }
      });

      if (authError) {
        console.error('❌ Erro ao obter URL de autorização:', authError);
        throw new Error(`Erro na autorização: ${authError.message}`);
      }

      if (!authData?.authUrl) {
        throw new Error('URL de autorização não recebida do servidor');
      }

      console.log('🌐 Abrindo janela de autorização...');

      // Abrir janela de autorização
      const authWindow = window.open(
        authData.authUrl,
        'mercadolivre-auth',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      if (!authWindow) {
        throw new Error('Não foi possível abrir a janela de autorização. Verifique se o popup não foi bloqueado.');
      }

      // Configurar listener para mensagens da janela de autorização
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;

        if (event.data.type === 'MERCADOLIVRE_AUTH_SUCCESS') {
          const { code, state: returnedState } = event.data;
          
          console.log('✅ Autorização recebida com sucesso');
          
          // Validar estado
          const savedState = SecureStorage.getSecureItem('ml_oauth_state');
          if (returnedState !== savedState) {
            throw new Error('Estado de segurança inválido. Tente novamente.');
          }

          try {
            console.log('🔄 Trocando código por token de acesso...');
            
            const { data: tokenData, error: tokenError } = await supabase.functions.invoke('mercadolivre-auth', {
              body: { action: 'exchangeCode', code }
            });

            if (tokenError) {
              throw new Error(`Erro ao obter token: ${tokenError.message}`);
            }

            if (!tokenData?.access_token) {
              throw new Error('Token de acesso não recebido');
            }

            console.log('🔑 Token obtido, salvando e carregando produtos...');
            SecureStorage.setSecureItem('ml_access_token', tokenData.access_token);
            SecureStorage.setSecureItem('ml_token_timestamp', Date.now().toString());
            
            // Carregar produtos com o novo token
            const success = await loadProducts(tokenData.access_token);
            if (success) {
              onConnectionChange(true);
              toast({
                title: "✅ Conectado com sucesso!",
                description: "Produtos importados do Mercado Livre",
              });
            }
            
          } catch (error: any) {
            console.error('❌ Erro no processamento da autorização:', error);
            toast({
              title: "❌ Erro na autorização",
              description: error.message || "Erro ao processar autorização",
              variant: "destructive"
            });
          } finally {
            authWindow?.close();
            window.removeEventListener('message', handleMessage);
            SecureStorage.removeSecureItem('ml_oauth_state');
            setConnecting(false);
          }
        }

        if (event.data.type === 'MERCADOLIVRE_AUTH_ERROR') {
          console.error('❌ Erro na autorização OAuth:', event.data.error);
          toast({
            title: "❌ Erro na autorização",
            description: event.data.error || 'Falha na autenticação com o Mercado Livre',
            variant: "destructive"
          });
          authWindow?.close();
          window.removeEventListener('message', handleMessage);
          SecureStorage.removeSecureItem('ml_oauth_state');
          setConnecting(false);
        }
      };

      window.addEventListener('message', handleMessage);

      // Verificar se a janela foi fechada manualmente
      const checkClosed = setInterval(() => {
        if (authWindow?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', handleMessage);
          SecureStorage.removeSecureItem('ml_oauth_state');
          setConnecting(false);
          
          if (connecting) {
            console.log('⚠️ Janela de autorização fechada pelo usuário');
            toast({
              title: "⚠️ Autorização cancelada",
              description: "A janela de autorização foi fechada",
            });
          }
        }
      }, 1000);

    } catch (error: any) {
      console.error('❌ Erro geral na conexão:', error);
      toast({
        title: "❌ Erro na conexão",
        description: error.message || "Não foi possível conectar com o Mercado Livre",
        variant: "destructive"
      });
    } finally {
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
                    Carregando produtos...
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Recarregar produtos
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
                Conectando e carregando produtos...
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
