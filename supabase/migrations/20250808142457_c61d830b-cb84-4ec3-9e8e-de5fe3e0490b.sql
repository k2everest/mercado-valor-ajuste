-- Criar tabela de produtos importados
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  purchase_price NUMERIC NOT NULL DEFAULT 0,
  selling_price NUMERIC DEFAULT 0,
  ml_product_id TEXT,
  category TEXT,
  brand TEXT,
  supplier TEXT,
  weight NUMERIC DEFAULT 0,
  dimensions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, sku)
);

-- Criar tabela de importações NFE
CREATE TABLE public.nfe_imports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nfe_number TEXT NOT NULL,
  serie TEXT NOT NULL,
  emission_date DATE NOT NULL,
  supplier_cnpj TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  total_value NUMERIC NOT NULL,
  tax_value NUMERIC DEFAULT 0,
  freight_value NUMERIC DEFAULT 0,
  insurance_value NUMERIC DEFAULT 0,
  discount_value NUMERIC DEFAULT 0,
  xml_content TEXT,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de itens da NFE
CREATE TABLE public.nfe_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nfe_import_id UUID NOT NULL REFERENCES public.nfe_imports(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  item_sequence INTEGER NOT NULL,
  sku TEXT NOT NULL,
  description TEXT NOT NULL,
  ncm TEXT,
  cfop TEXT,
  quantity NUMERIC NOT NULL,
  unit_value NUMERIC NOT NULL,
  total_value NUMERIC NOT NULL,
  icms_value NUMERIC DEFAULT 0,
  ipi_value NUMERIC DEFAULT 0,
  pis_value NUMERIC DEFAULT 0,
  cofins_value NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de custos adicionais
CREATE TABLE public.additional_costs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  cost_type TEXT NOT NULL CHECK (cost_type IN ('fixed', 'variable', 'percentage')),
  value NUMERIC NOT NULL DEFAULT 0,
  percentage_base TEXT CHECK (percentage_base IN ('subtotal', 'total', 'profit')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de configurações tributárias
CREATE TABLE public.tax_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  tax_regime TEXT NOT NULL CHECK (tax_regime IN ('simples_nacional', 'lucro_real', 'lucro_presumido')),
  cnpj TEXT,
  state_ie TEXT,
  simples_percentage NUMERIC DEFAULT 6.0,
  icms_percentage NUMERIC DEFAULT 18.0,
  ipi_percentage NUMERIC DEFAULT 0.0,
  pis_percentage NUMERIC DEFAULT 1.65,
  cofins_percentage NUMERIC DEFAULT 7.6,
  operational_cost_monthly NUMERIC DEFAULT 0,
  expected_tickets_monthly INTEGER DEFAULT 100,
  target_margin_percentage NUMERIC DEFAULT 30.0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de cálculos de precificação
CREATE TABLE public.pricing_calculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  purchase_cost NUMERIC NOT NULL,
  additional_costs NUMERIC DEFAULT 0,
  tax_cost NUMERIC DEFAULT 0,
  total_cost NUMERIC NOT NULL,
  current_selling_price NUMERIC,
  suggested_price NUMERIC NOT NULL,
  current_markup NUMERIC,
  suggested_markup NUMERIC NOT NULL,
  margin_percentage NUMERIC NOT NULL,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela de rateio de custos
CREATE TABLE public.cost_allocations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  import_batch_id UUID NOT NULL,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  allocation_percentage NUMERIC NOT NULL,
  allocated_amount NUMERIC NOT NULL,
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('proportional', 'equal', 'custom')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfe_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nfe_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.additional_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_calculations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cost_allocations ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para products
CREATE POLICY "Users can view their own products" ON public.products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own products" ON public.products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own products" ON public.products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own products" ON public.products FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para nfe_imports
CREATE POLICY "Users can view their own NFE imports" ON public.nfe_imports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own NFE imports" ON public.nfe_imports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own NFE imports" ON public.nfe_imports FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own NFE imports" ON public.nfe_imports FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para nfe_items
CREATE POLICY "Users can view NFE items from their imports" ON public.nfe_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.nfe_imports WHERE id = nfe_items.nfe_import_id AND user_id = auth.uid())
);
CREATE POLICY "Users can create NFE items for their imports" ON public.nfe_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.nfe_imports WHERE id = nfe_items.nfe_import_id AND user_id = auth.uid())
);
CREATE POLICY "Users can update NFE items from their imports" ON public.nfe_items FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.nfe_imports WHERE id = nfe_items.nfe_import_id AND user_id = auth.uid())
);
CREATE POLICY "Users can delete NFE items from their imports" ON public.nfe_items FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.nfe_imports WHERE id = nfe_items.nfe_import_id AND user_id = auth.uid())
);

-- Políticas RLS para additional_costs
CREATE POLICY "Users can view their own additional costs" ON public.additional_costs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own additional costs" ON public.additional_costs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own additional costs" ON public.additional_costs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own additional costs" ON public.additional_costs FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para tax_settings
CREATE POLICY "Users can view their own tax settings" ON public.tax_settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own tax settings" ON public.tax_settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own tax settings" ON public.tax_settings FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own tax settings" ON public.tax_settings FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para pricing_calculations
CREATE POLICY "Users can view their own pricing calculations" ON public.pricing_calculations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own pricing calculations" ON public.pricing_calculations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pricing calculations" ON public.pricing_calculations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own pricing calculations" ON public.pricing_calculations FOR DELETE USING (auth.uid() = user_id);

-- Políticas RLS para cost_allocations
CREATE POLICY "Users can view their own cost allocations" ON public.cost_allocations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own cost allocations" ON public.cost_allocations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own cost allocations" ON public.cost_allocations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own cost allocations" ON public.cost_allocations FOR DELETE USING (auth.uid() = user_id);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_additional_costs_updated_at BEFORE UPDATE ON public.additional_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_tax_settings_updated_at BEFORE UPDATE ON public.tax_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Índices para performance
CREATE INDEX idx_products_user_id ON public.products(user_id);
CREATE INDEX idx_products_sku ON public.products(user_id, sku);
CREATE INDEX idx_nfe_imports_user_id ON public.nfe_imports(user_id);
CREATE INDEX idx_nfe_items_nfe_import_id ON public.nfe_items(nfe_import_id);
CREATE INDEX idx_pricing_calculations_product_id ON public.pricing_calculations(product_id);
CREATE INDEX idx_cost_allocations_product_id ON public.cost_allocations(product_id);