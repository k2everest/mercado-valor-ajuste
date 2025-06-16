
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useLanguage } from "@/hooks/useLanguage";
import { Download, Minus, Plus, Package } from "lucide-react";
import { Product } from './types';

interface ProductActionsProps {
  products: Product[];
  onAdjustAllPrices: (operation: 'add' | 'subtract') => void;
}

export const ProductActions = ({ products, onAdjustAllPrices }: ProductActionsProps) => {
  const { t } = useLanguage();

  const exportToCSV = () => {
    const csvContent = [
      ['ID', 'Título', 'Preço Original', 'Preço Ajustado', 'Status', 'Frete Grátis', 'Quantidade Disponível', 'Vendidos', 'Link'].join(','),
      ...products.map(product => [
        product.id,
        `"${product.title}"`,
        product.originalPrice.toFixed(2),
        (product.adjustedPrice || product.originalPrice).toFixed(2),
        product.status,
        product.freeShipping ? 'Sim' : 'Não',
        product.availableQuantity || 0,
        product.soldQuantity || 0,
        product.permalink || ''
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'produtos_mercadolivre_ajustados.csv';
    link.click();

    toast({
      title: "CSV exportado!",
      description: "O arquivo foi baixado com sucesso",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Ações em Massa ({products.length} produtos importados)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4">
          <Button
            onClick={() => onAdjustAllPrices('subtract')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Minus className="h-4 w-4" />
            Subtrair Custo Real do Frete
          </Button>
          <Button
            onClick={() => onAdjustAllPrices('add')}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Somar Custo Real do Frete
          </Button>
          <Button
            onClick={exportToCSV}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
          >
            <Download className="h-4 w-4" />
            {t('dashboard.export_csv')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
