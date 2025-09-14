
import { useEffect } from 'react';

const AuthCallback = () => {
  useEffect(() => {
    console.log('🚀 AuthCallback React component iniciado');
    console.log('🌐 URL atual:', window.location.href);
    
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const state = urlParams.get('state');
      const error = urlParams.get('error');

      console.log('🔍 Parâmetros recebidos:', { code: !!code, state: !!state, error });

      if (error) {
        console.error('❌ Erro OAuth recebido:', error);
        
        if (window.opener) {
          console.log('📤 Enviando erro para janela pai...');
          window.opener.postMessage({
            type: 'MERCADOLIVRE_AUTH_ERROR',
            error: error
          }, '*');
        }
        
        setTimeout(() => {
          console.log('🚪 Fechando janela...');
          window.close();
        }, 1000);
        return;
      }

      if (code) {
        console.log('✅ Código de autorização recebido!');
        
        if (window.opener) {
          console.log('📤 Enviando sucesso para janela pai...');
          window.opener.postMessage({
            type: 'MERCADOLIVRE_AUTH_SUCCESS',
            code: code,
            state: state
          }, '*');
        } else {
          console.warn('⚠️ window.opener não encontrado');
        }
        
        setTimeout(() => {
          console.log('🚪 Fechando janela...');
          window.close();
        }, 1000);
      } else {
        const errorMsg = 'Código de autorização não encontrado';
        console.error('❌', errorMsg);
        
        if (window.opener) {
          window.opener.postMessage({
            type: 'MERCADOLIVRE_AUTH_ERROR',
            error: errorMsg
          }, '*');
        }
        
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    } catch (err: any) {
      console.error('❌ Erro no callback:', err);
      
      if (window.opener) {
        window.opener.postMessage({
          type: 'MERCADOLIVRE_AUTH_ERROR',
          error: err.message
        }, '*');
      }
      
      setTimeout(() => {
        window.close();
      }, 1000);
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="text-center p-8 bg-white/80 backdrop-blur-sm rounded-lg shadow-lg">
        <div className="animate-spin w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full mx-auto mb-4"></div>
        <h2 className="text-xl font-semibold text-gray-800 mb-2">Processando autenticação...</h2>
        <p className="text-gray-600">Aguarde enquanto processamos sua conexão com o Mercado Livre.</p>
        <p className="text-sm text-gray-500 mt-4">Esta janela será fechada automaticamente.</p>
      </div>
    </div>
  );
};

export default AuthCallback;
