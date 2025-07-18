import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { SecureStorage } from '@/utils/secureStorage';
import { toast } from 'sonner';

export const useMercadoLibreAuth = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshMLToken = async (): Promise<string | null> => {
    const tokens = SecureStorage.getMLTokens();
    if (!tokens?.refreshToken) {
      console.log('❌ Nenhum refresh token disponível');
      return null;
    }

    setIsRefreshing(true);
    try {
      console.log('🔄 Renovando token do Mercado Livre...');
      
      const { data, error } = await supabase.functions.invoke('mercadolivre-refresh-token', {
        body: { refreshToken: tokens.refreshToken }
      });

      if (error) {
        console.error('❌ Erro ao renovar token:', error);
        throw new Error(error.message || 'Falha ao renovar token');
      }

      // Save new tokens
      SecureStorage.setMLTokens(
        data.accessToken,
        data.refreshToken || tokens.refreshToken,
        data.expiresIn || 21600 // 6 hours default
      );

      console.log('✅ Token renovado com sucesso');
      return data.accessToken;
    } catch (error: any) {
      console.error('💥 Erro ao renovar token:', error);
      toast.error('Falha ao renovar token. Reconecte-se ao Mercado Livre.');
      
      // Clear invalid tokens
      SecureStorage.removeSecureItem('ml_tokens');
      return null;
    } finally {
      setIsRefreshing(false);
    }
  };

  const getValidMLToken = async (): Promise<string | null> => {
    const tokens = SecureStorage.getMLTokens();
    
    if (!tokens) {
      console.log('❌ Nenhum token encontrado');
      return null;
    }

    // Check if token is expired
    if (SecureStorage.isMLTokenExpired()) {
      console.log('⏰ Token expirado, renovando...');
      return await refreshMLToken();
    }

    return tokens.accessToken;
  };

  const connectMercadoLibre = async () => {
    setIsConnecting(true);
    try {
      const { data, error } = await supabase.functions.invoke('mercadolivre-auth', {
        body: { action: 'getAuthUrl' }
      });

      if (error) {
        throw error;
      }

      // Open authorization window
      window.open(data.authUrl, '_blank');
      toast.success('Redirecionando para autorização do Mercado Livre...');
    } catch (error: any) {
      console.error('Erro ao conectar com Mercado Livre:', error);
      toast.error('Erro ao conectar com Mercado Livre: ' + error.message);
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectMercadoLibre = () => {
    SecureStorage.removeSecureItem('ml_tokens');
    toast.success('Desconectado do Mercado Livre');
  };

  const isConnected = (): boolean => {
    const tokens = SecureStorage.getMLTokens();
    return !!tokens?.accessToken;
  };

  return {
    connectMercadoLibre,
    disconnectMercadoLibre,
    getValidMLToken,
    refreshMLToken,
    isConnecting,
    isRefreshing,
    isConnected: isConnected()
  };
};