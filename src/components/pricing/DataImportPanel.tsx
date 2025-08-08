import React, { useState, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, FileText, AlertCircle, CheckCircle, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import Papa from 'papaparse';
import * as XLSX from 'xlsx';

interface ImportedProduct {
  sku: string;
  name: string;
  purchase_price: number;
  category?: string;
  brand?: string;
  supplier?: string;
  weight?: number;
}

interface ImportedCost {
  name: string;
  description?: string;
  cost_type: 'fixed' | 'variable' | 'percentage';
  value: number;
  percentage_base?: 'subtotal' | 'total' | 'profit';
  is_active: boolean;
}

interface DataImportPanelProps {
  onImportComplete?: (data: any) => void;
}

export const DataImportPanel: React.FC<DataImportPanelProps> = ({ onImportComplete }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [importResult, setImportResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const processCSVFile = useCallback(async (file: File): Promise<ImportedProduct[]> => {
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        transform: (value: string) => value.trim(),
        complete: (results) => {
          try {
            const products = results.data.map((row: any) => ({
              sku: row.sku || row.SKU || row.codigo || row.CODIGO || '',
              name: row.name || row.nome || row.produto || row.PRODUTO || row.description || row.DESCRIPTION || '',
              purchase_price: parseFloat(row.purchase_price || row.preco_compra || row.custo || row.CUSTO || row.price || row.PRICE || '0'),
              category: row.category || row.categoria || row.CATEGORIA || '',
              brand: row.brand || row.marca || row.MARCA || '',
              supplier: row.supplier || row.fornecedor || row.FORNECEDOR || '',
              weight: parseFloat(row.weight || row.peso || row.PESO || '0') || undefined,
            })).filter((p: ImportedProduct) => p.sku && p.name && p.purchase_price > 0);

            resolve(products);
          } catch (error) {
            reject(new Error('Erro ao processar arquivo CSV'));
          }
        },
        error: (error) => {
          reject(new Error(`Erro ao ler arquivo CSV: ${error.message}`));
        }
      });
    });
  }, []);

  const processXLSXFile = useCallback(async (file: File): Promise<ImportedProduct[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          const products = jsonData.map((row: any) => ({
            sku: row.sku || row.SKU || row.codigo || row.CODIGO || '',
            name: row.name || row.nome || row.produto || row.PRODUTO || row.description || row.DESCRIPTION || '',
            purchase_price: parseFloat(row.purchase_price || row.preco_compra || row.custo || row.CUSTO || row.price || row.PRICE || '0'),
            category: row.category || row.categoria || row.CATEGORIA || '',
            brand: row.brand || row.marca || row.MARCA || '',
            supplier: row.supplier || row.fornecedor || row.FORNECEDOR || '',
            weight: parseFloat(row.weight || row.peso || row.PESO || '0') || undefined,
          })).filter((p: ImportedProduct) => p.sku && p.name && p.purchase_price > 0);

          resolve(products);
        } catch (error) {
          reject(new Error('Erro ao processar arquivo Excel'));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsArrayBuffer(file);
    });
  }, []);

  const processXMLFile = useCallback(async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const xmlContent = e.target?.result as string;
          if (!xmlContent.includes('<infNFe') && !xmlContent.includes('<nfeProc')) {
            reject(new Error('Arquivo XML não parece ser uma NFe válida'));
            return;
          }
          resolve(xmlContent);
        } catch (error) {
          reject(new Error('Erro ao processar arquivo XML'));
        }
      };
      reader.onerror = () => reject(new Error('Erro ao ler arquivo XML'));
      reader.readAsText(file, 'UTF-8');
    });
  }, []);

  const handleFileImport = useCallback(async (file: File, type: 'csv' | 'xlsx' | 'xml') => {
    setIsLoading(true);
    setProgress(0);
    setError(null);
    setImportResult(null);

    try {
      if (type === 'xml') {
        // Process NFE XML
        setProgress(25);
        const xmlContent = await processXMLFile(file);
        
        setProgress(50);
        const { data, error } = await supabase.functions.invoke('process-nfe-xml', {
          body: { xmlContent }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        setProgress(100);
        setImportResult(data.data);
        toast({
          title: "NFe importada com sucesso!",
          description: `${data.data.summary.totalItems} itens processados da NFe ${data.data.summary.nfeNumber}`,
        });

      } else {
        // Process CSV/XLSX
        setProgress(25);
        const products = type === 'csv' 
          ? await processCSVFile(file)
          : await processXLSXFile(file);

        if (products.length === 0) {
          throw new Error('Nenhum produto válido encontrado no arquivo');
        }

        setProgress(50);
        const { data, error } = await supabase.functions.invoke('process-csv-import', {
          body: { products, additionalCosts: [] }
        });

        if (error) throw error;
        if (!data.success) throw new Error(data.error);

        setProgress(100);
        setImportResult(data.data);
        toast({
          title: "Importação concluída!",
          description: `${data.data.summary.totalProducts} produtos importados com sucesso`,
        });
      }

      onImportComplete?.(importResult);

    } catch (error) {
      console.error('Erro na importação:', error);
      setError(error.message);
      toast({
        title: "Erro na importação",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [processCSVFile, processXLSXFile, processXMLFile, toast, onImportComplete, importResult]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>, type: 'csv' | 'xlsx' | 'xml') => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileImport(file, type);
    }
  }, [handleFileImport]);

  const clearResults = useCallback(() => {
    setImportResult(null);
    setError(null);
    setProgress(0);
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="h-5 w-5" />
          Importação de Dados
        </CardTitle>
        <CardDescription>
          Importe produtos através de planilhas CSV/Excel ou XML de NFe
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="spreadsheet" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="spreadsheet">Planilha (CSV/Excel)</TabsTrigger>
            <TabsTrigger value="nfe">NFe (XML)</TabsTrigger>
          </TabsList>
          
          <TabsContent value="spreadsheet" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="csv-file">Arquivo CSV</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={(e) => handleFileChange(e, 'csv')}
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground">
                  Colunas esperadas: sku, name, purchase_price, category, brand, supplier, weight
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="xlsx-file">Arquivo Excel</Label>
                <Input
                  id="xlsx-file"
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => handleFileChange(e, 'xlsx')}
                  disabled={isLoading}
                />
                <p className="text-sm text-muted-foreground">
                  Primeira planilha será processada automaticamente
                </p>
              </div>
            </div>
          </TabsContent>
          
          <TabsContent value="nfe" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="xml-file">Arquivo XML da NFe</Label>
              <Input
                id="xml-file"
                type="file"
                accept=".xml"
                onChange={(e) => handleFileChange(e, 'xml')}
                disabled={isLoading}
              />
              <p className="text-sm text-muted-foreground">
                Arquivo XML completo da Nota Fiscal Eletrônica
              </p>
            </div>
          </TabsContent>
        </Tabs>

        {isLoading && (
          <div className="space-y-2">
            <Progress value={progress} className="w-full" />
            <p className="text-sm text-center text-muted-foreground">
              Processando arquivo... {progress}%
            </p>
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {importResult && (
          <div className="space-y-4">
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                Importação concluída com sucesso!
              </AlertDescription>
            </Alert>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Resumo da Importação</CardTitle>
                <Button variant="ghost" size="sm" onClick={clearResults}>
                  <X className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {importResult.summary && (
                  <>
                    <div className="flex justify-between">
                      <span>Produtos importados:</span>
                      <span className="font-medium">{importResult.summary.totalProducts || importResult.summary.totalItems}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Valor total:</span>
                      <span className="font-medium">R$ {(importResult.summary.totalValue || 0).toFixed(2)}</span>
                    </div>
                    {importResult.summary.nfeNumber && (
                      <>
                        <div className="flex justify-between">
                          <span>NFe:</span>
                          <span className="font-medium">{importResult.summary.nfeNumber}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fornecedor:</span>
                          <span className="font-medium">{importResult.summary.supplier}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <div className="bg-muted/50 p-4 rounded-lg">
          <h4 className="font-medium mb-2 flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Formatos Suportados
          </h4>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• <strong>CSV:</strong> Arquivo separado por vírgulas com cabeçalho</li>
            <li>• <strong>Excel:</strong> Arquivos .xlsx ou .xls (primeira planilha)</li>
            <li>• <strong>XML NFe:</strong> Nota Fiscal Eletrônica completa</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};