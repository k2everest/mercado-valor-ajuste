import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { TestTube, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const ApiTestPanel = () => {
  const [loading, setLoading] = useState(false);
  const [productId, setProductId] = useState('690488868');
  const [zipCode, setZipCode] = useState('01310-100');
  const [testType, setTestType] = useState('shipping_options');
  const [result, setResult] = useState<any>(null);

  console.log('🔍 Current testType:', testType);

  const testApi = async () => {
    // Previne execução dupla
    if (loading) {
      console.log('⚠️ Teste já em execução, ignorando nova chamada');
      return;
    }
    
    setLoading(true);
    setResult(null);

    try {
      const accessToken = localStorage.getItem('ml_access_token');
      if (!accessToken) {
        throw new Error('Token de acesso não encontrado. Conecte-se ao Mercado Livre primeiro.');
      }

      console.log('🧪 Iniciando teste da API...');
      console.log('Product ID:', productId);
      console.log('Tipo de teste:', testType);
      if (testType === 'shipping_options') {
        console.log('CEP:', zipCode);
      }

      // Usando timeout para evitar chamadas pendentes
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 segundos

      try {
        const requestBody: any = {
          productId: productId.trim(),
          accessToken,
          testType
        };

        // Só adiciona CEP se for o teste padrão
        if (testType === 'shipping_options') {
          requestBody.zipCode = zipCode.trim();
        }

        const { data, error } = await supabase.functions.invoke('test-ml-api', {
          body: requestBody
        });

        clearTimeout(timeoutId);

        if (error) {
          console.error('❌ Erro da função Supabase:', error);
          throw new Error(`Erro na função: ${error.message}`);
        }

        console.log('📡 Resposta da função:', data);

        if (!data) {
          throw new Error('Nenhuma resposta recebida da função');
        }

        if (!data.success) {
          throw new Error(data.error || 'Erro desconhecido na API');
        }

        console.log('✅ Teste concluído com sucesso');
        setResult(data);

        let description = '';
        if (testType === 'shipping_options_free') {
          description = `Frete grátis: R$ ${data.summary?.freeShippingCost || 0}`;
        } else {
          description = `${data.summary?.totalOptions || 0} opções de frete encontradas`;
        }

        toast({
          title: "✅ Teste concluído!",
          description: description,
        });

      } catch (fetchError: any) {
        clearTimeout(timeoutId);
        if (fetchError.name === 'AbortError') {
          throw new Error('Timeout: A requisição demorou muito para responder');
        }
        throw fetchError;
      }

    } catch (error: any) {
      console.error('❌ Erro no teste:', error);
      toast({
        title: "❌ Erro no teste",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getTestDescription = () => {
    switch (testType) {
      case 'shipping_options_free':
        return 'Consulta o custo do frete grátis do produto (endpoint /free)';
      case 'shipping_options':
        return 'Consulta opções de frete com CEP de destino';
      default:
        return 'Teste não identificado';
    }
  };

  const testOptions = [
    { value: 'shipping_options', label: 'Opções de Frete (com CEP)' },
    { value: 'shipping_options_free', label: 'Frete Grátis (/free)' }
  ];

  console.log('📋 Opções disponíveis:', testOptions);

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
          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label htmlFor="testType" className="text-white">Tipo de Teste</Label>
              <Select value={testType} onValueChange={setTestType} disabled={loading}>
                <SelectTrigger className="bg-white/20 text-white border-white/30">
                  <SelectValue placeholder="Selecione o tipo de teste" />
                </SelectTrigger>
                <SelectContent className="bg-white text-black">
                  {testOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-white/70 mt-1">{getTestDescription()}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="productId" className="text-white">Product ID</Label>
              <Input
                id="productId"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="bg-white/20 text-white placeholder:text-white/60 border-white/30"
                placeholder="690488868"
                disabled={loading}
              />
            </div>
            {testType === 'shipping_options' && (
              <div>
                <Label htmlFor="zipCode" className="text-white">CEP</Label>
                <Input
                  id="zipCode"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  className="bg-white/20 text-white placeholder:text-white/60 border-white/30"
                  placeholder="01310-100"
                  disabled={loading}
                />
              </div>
            )}
          </div>

          <Button
            onClick={testApi}
            disabled={loading || !productId.trim() || (testType === 'shipping_options' && !zipCode.trim())}
            className="w-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm disabled:opacity-50"
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
              <h3 className="font-semibold mb-2">✅ Resultado do Teste:</h3>
              <div className="text-sm space-y-1">
                <p>🧪 Tipo: {result.testDescription}</p>
                <p>📦 Produto: {result.productId}</p>
                {result.zipCode && <p>📍 CEP: {result.zipCode}</p>}
                
                {result.testType === 'shipping_options_free' ? (
                  <div className="space-y-1">
                    <p>💰 Custo do frete grátis: {result.summary?.currency || 'BRL'} {result.summary?.freeShippingCost || 0}</p>
                    <p>🎯 Tem cobertura frete grátis: {result.summary?.hasFreeCoverage ? 'Sim' : 'Não'}</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <p>🚚 Total de opções: {result.summary?.totalOptions || 0}</p>
                    <p>🆓 Opções gratuitas: {result.summary?.freeShippingOptions || 0}</p>
                    <p>💰 Com desconto loyalty: {result.summary?.hasLoyalDiscount ? 'Sim' : 'Não'}</p>
                    <p>📊 Com base_cost: {result.summary?.optionsWithBaseCost || 0}</p>
                  </div>
                )}
              </div>
              
              {result.processedOptions && result.processedOptions.length > 0 && (
                <div className="mt-3">
                  <h4 className="font-medium mb-2">📋 Opções Detalhadas:</h4>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {result.processedOptions.map((option: any) => (
                      <div key={option.index} className="text-xs bg-black/30 p-2 rounded">
                        <p><strong>{option.name}</strong> (ID: {option.shippingMethodId})</p>
                        <p>💰 Custo: R$ {option.cost} | Base: R$ {option.baseCost}</p>
                        {option.hasLoyalDiscount && (
                          <p>🎯 Desconto: {option.discountRate * 100}% (R$ {option.promotedAmount})</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
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
