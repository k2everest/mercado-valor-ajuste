
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { TestTube, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const ApiTestPanel = () => {
  const [loading, setLoading] = useState(false);
  const [productId, setProductId] = useState('690488868');
  const [zipCode, setZipCode] = useState('01310-100');
  const [result, setResult] = useState<any>(null);
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const testAllOptions = async () => {
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

      console.log('🧪 Iniciando teste completo de todas as opções...');

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000); // 45 segundos

      try {
        const { data, error } = await supabase.functions.invoke('test-ml-api', {
          body: {
            productId: productId.trim(),
            zipCode: zipCode.trim(),
            accessToken,
            testType: 'all_options'
          }
        });

        clearTimeout(timeoutId);

        if (error) {
          console.error('❌ Erro da função Supabase:', error);
          throw new Error(`Erro na função: ${error.message}`);
        }

        if (!data) {
          throw new Error('Nenhuma resposta recebida da função');
        }

        if (!data.success) {
          throw new Error(data.error || 'Erro desconhecido na API');
        }

        console.log('✅ Teste completo concluído');
        setResult(data);

        const summary = data.summary;
        toast({
          title: "✅ Teste completo finalizado!",
          description: `${summary.successfulEndpoints}/${summary.totalEndpointsTested} endpoints funcionando. Frete grátis: ${summary.freeShippingAnalysis.freeEndpointAvailable ? 'Disponível' : 'Indisponível'}`,
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
        title: "❌ Erro no teste completo",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const renderEndpointResult = (key: string, data: any, title: string) => {
    const isExpanded = expandedSections[key];
    
    return (
      <div key={key} className="border rounded-lg p-3 mb-3">
        <div 
          className="flex items-center justify-between cursor-pointer"
          onClick={() => toggleSection(key)}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            <h4 className="font-medium">{title}</h4>
            <span className={`text-xs px-2 py-1 rounded ${data.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {data.success ? 'Sucesso' : 'Erro'}
            </span>
          </div>
          {data.success && data.totalOptions && (
            <span className="text-sm text-gray-500">{data.totalOptions} opções</span>
          )}
        </div>
        
        {isExpanded && (
          <div className="mt-3 space-y-2 text-sm">
            <p><strong>Endpoint:</strong> {data.endpoint}</p>
            {data.zipCode && <p><strong>CEP:</strong> {data.zipCode}</p>}
            
            {data.error && (
              <div className="bg-red-50 p-2 rounded text-red-700">
                <strong>Erro:</strong> {data.error}
              </div>
            )}
            
            {data.success && data.options && (
              <div>
                <strong>Opções de Frete:</strong>
                <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
                  {data.options.map((option: any) => (
                    <div key={option.index} className="bg-gray-50 p-2 rounded text-xs">
                      <p><strong>{option.name}</strong> (ID: {option.shippingMethodId})</p>
                      <p>💰 Cliente: R$ {option.cost} | Vendedor: R$ {option.sellerCost || option.listCost || 'N/A'}</p>
                      {option.hasLoyalDiscount && <p>🎯 Desconto Loyal</p>}
                      {option.isFreeForCustomer && <p>🆓 Grátis para cliente</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {data.success && data.freeShippingInfo && (
              <div className="bg-green-50 p-2 rounded">
                <strong>Informações de Frete Grátis:</strong>
                <p>💰 Custo nacional para vendedor: {data.freeShippingInfo.currencyId} {data.freeShippingInfo.listCost}</p>
                <p>🚚 Método: {data.freeShippingInfo.shippingMethodId}</p>
                <p>📦 Tipo logístico: {data.freeShippingInfo.logisticType}</p>
              </div>
            )}
            
            {data.success && data.areasCoverage && data.areasCoverage.length > 0 && (
              <div>
                <strong>Cobertura por Áreas ({data.totalAreas}):</strong>
                <div className="mt-1 space-y-1 max-h-32 overflow-y-auto">
                  {data.areasCoverage.map((area: any, index: number) => (
                    <div key={index} className="bg-blue-50 p-1 rounded text-xs">
                      Área {area.areaId}: {area.currencyId} {area.listCost}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-gradient-to-r from-green-600 to-blue-600 text-white">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <TestTube className="h-5 w-5" />
          Teste Completo - Todas as Opções ML
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
                disabled={loading}
              />
            </div>
            <div>
              <Label htmlFor="zipCode" className="text-white">CEP (opcional)</Label>
              <Input
                id="zipCode"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                className="bg-white/20 text-white placeholder:text-white/60 border-white/30"
                placeholder="01310-100"
                disabled={loading}
              />
            </div>
          </div>

          <Button
            onClick={testAllOptions}
            disabled={loading || !productId.trim()}
            className="w-full bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Testando Todas as Opções...
              </>
            ) : (
              <>
                <TestTube className="h-4 w-4 mr-2" />
                Testar Todas as Opções
              </>
            )}
          </Button>

          {result && (
            <div className="mt-4 p-4 bg-black/20 rounded-lg max-h-96 overflow-y-auto">
              <h3 className="font-semibold mb-3">✅ Resultado do Teste Completo:</h3>
              
              {/* Resumo Geral */}
              <div className="mb-4 p-3 bg-white/10 rounded">
                <h4 className="font-medium mb-2">📊 Resumo Geral</h4>
                <div className="text-sm space-y-1">
                  <p>🎯 Endpoints testados: {result.summary?.totalEndpointsTested || 0}</p>
                  <p>✅ Sucessos: {result.summary?.successfulEndpoints || 0}</p>
                  <p>📦 Produto: {result.allResults?.product_info?.title || 'N/A'}</p>
                  <p>🆓 Declara frete grátis: {result.summary?.freeShippingAnalysis?.productDeclaresFreeShipping ? 'Sim' : 'Não'}</p>
                  <p>💰 Endpoint /free disponível: {result.summary?.freeShippingAnalysis?.freeEndpointAvailable ? 'Sim' : 'Não'}</p>
                  {result.summary?.freeShippingAnalysis?.nationalCoverageCost && (
                    <p>💰 Custo nacional vendedor: R$ {result.summary.freeShippingAnalysis.nationalCoverageCost}</p>
                  )}
                </div>
              </div>

              {/* Detalhes dos Endpoints */}
              <div className="space-y-2">
                {result.allResults?.product_info && renderEndpointResult(
                  'product_info', 
                  result.allResults.product_info, 
                  '📦 Informações do Produto'
                )}
                {result.allResults?.free_shipping && renderEndpointResult(
                  'free_shipping', 
                  result.allResults.free_shipping, 
                  '🆓 Frete Grátis (/free)'
                )}
                {result.allResults?.shipping_options && renderEndpointResult(
                  'shipping_options', 
                  result.allResults.shipping_options, 
                  '🚚 Opções com CEP'
                )}
                {result.allResults?.basic_shipping && renderEndpointResult(
                  'basic_shipping', 
                  result.allResults.basic_shipping, 
                  '📋 Opções Básicas'
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
