
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { TestTube, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const ApiTestPanel = () => {
  const [loading, setLoading] = useState(false);
  const [productId, setProductId] = useState('690488868');
  const [zipCode, setZipCode] = useState('01310-100');
  const [result, setResult] = useState<any>(null);

  const testApi = async () => {
    setLoading(true);
    setResult(null);

    try {
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado. Conecte-se ao Mercado Livre primeiro.');
      }

      console.log('🧪 TESTANDO API MERCADO LIVRE');
      console.log('Product ID:', productId);
      console.log('CEP:', zipCode);

      const { data, error } = await supabase.functions.invoke('test-ml-api', {
        body: {
          productId,
          zipCode,
          accessToken
        }
      });

      if (error) {
        console.error('Erro da função:', error);
        throw new Error(`Erro: ${error.message}`);
      }

      console.log('✅ RESPOSTA RECEBIDA:', data);
      setResult(data);

      toast({
        title: "✅ Teste concluído!",
        description: `${data.summary?.totalOptions || 0} opções encontradas`,
      });

    } catch (error: any) {
      console.error('❌ ERRO NO TESTE:', error);
      toast({
        title: "❌ Erro no teste",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-gradient-to-r from-green-600 to-blue-600 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TestTube className="h-5 w-5" />
          Teste da API Mercado Livre
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="productId" className="text-white">Product ID</Label>
              <Input
                id="productId"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="bg-white/20 text-white placeholder:text-white/60 border-white/30"
                placeholder="690488868"
              />
            </div>
            <div>
              <Label htmlFor="zipCode" className="text-white">CEP</Label>
              <Input
                id="zipCode"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="bg-white/20 text-white placeholder:text-white/60 border-white/30"
                placeholder="01310-100"
              />
            </div>
          </div>

          <Button
            onClick={testApi}
            disabled={loading}
            className="w-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testando API...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Testar API Diretamente
              </>
            )}
          </Button>

          {result && (
            <div className="mt-4 p-4 bg-black/20 rounded-lg">
              <h3 className="font-semibold mb-2">Resultado do Teste:</h3>
              <div className="text-sm space-y-1">
                <p>📦 Produto: {result.productId}</p>
                <p>📍 CEP: {result.zipCode}</p>
                <p>🚚 Opções encontradas: {result.summary?.totalOptions || 0}</p>
                <p>💰 Com desconto de reputação: {result.summary?.hasLoyalDiscount ? 'Sim' : 'Não'}</p>
                <p>📊 Com base_cost: {result.summary?.optionsWithBaseCost || 0}</p>
              </div>
              
              <details className="mt-2">
                <summary className="cursor-pointer text-sm font-medium">Ver resposta completa da API</summary>
                <pre className="mt-2 text-xs bg-black/30 p-2 rounded overflow-auto max-h-64">
                  {JSON.stringify(result.rawApiResponse, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
