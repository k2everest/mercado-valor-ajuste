import { supabase } from "@/integrations/supabase/client";
import { SecureStorage } from "./secureStorage";

/**
 * Obtém um token válido do Mercado Livre
 * - Busca do SecureStorage (criptografado)
 * - Valida expiração
 * - Renova automaticamente se necessário
 */
export async function getValidMLToken(): Promise<string | null> {
  const tokens = await SecureStorage.getMLTokens();
  
  if (!tokens) {
    console.log('❌ Nenhum token encontrado');
    return null;
  }

  // If token is expired, try to refresh once
  if (await SecureStorage.isMLTokenExpired()) {
    console.log('⏰ Token expirado, tentando renovar...');
    
    try {
      const { data, error } = await supabase.functions.invoke('mercadolivre-refresh-token', {
        body: { refreshToken: tokens.refreshToken }
      });

      if (error || !data?.accessToken) {
        console.error('❌ Falha ao renovar token:', error);
        SecureStorage.removeSecureItem('ml_tokens');
        return null;
      }

      // Save new tokens
      await SecureStorage.setMLTokens(
        data.accessToken,
        data.refreshToken || tokens.refreshToken,
        data.expiresIn || 21600
      );

      console.log('✅ Token renovado com sucesso');
      return data.accessToken;
    } catch (error: any) {
      console.error('💥 Erro ao renovar token:', error);
      SecureStorage.removeSecureItem('ml_tokens');
      return null;
    }
  }

  return tokens.accessToken;
}
