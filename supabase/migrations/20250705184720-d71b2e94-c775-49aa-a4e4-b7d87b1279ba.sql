
-- Tabela para armazenar histórico de cálculos de frete
CREATE TABLE public.freight_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  product_id TEXT NOT NULL,
  zip_code TEXT NOT NULL,
  freight_cost DECIMAL(10,2) NOT NULL,
  seller_freight_cost DECIMAL(10,2) NOT NULL,
  freight_method TEXT NOT NULL,
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_current BOOLEAN NOT NULL DEFAULT true,
  notification_received_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela para armazenar a última sessão de cálculos do usuário
CREATE TABLE public.user_last_calculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL UNIQUE,
  zip_code TEXT,
  calculations JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para melhorar performance
CREATE INDEX idx_freight_history_user_product ON public.freight_history(user_id, product_id);
CREATE INDEX idx_freight_history_current ON public.freight_history(user_id, is_current) WHERE is_current = true;
CREATE INDEX idx_freight_history_zip ON public.freight_history(zip_code);

-- RLS para freight_history
ALTER TABLE public.freight_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own freight history" 
  ON public.freight_history 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own freight history" 
  ON public.freight_history 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own freight history" 
  ON public.freight_history 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- RLS para user_last_calculations
ALTER TABLE public.user_last_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own last calculations" 
  ON public.user_last_calculations 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own last calculations" 
  ON public.user_last_calculations 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own last calculations" 
  ON public.user_last_calculations 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Função para marcar cálculos anteriores como não-atuais
CREATE OR REPLACE FUNCTION mark_previous_freight_as_outdated()
RETURNS TRIGGER AS $$
BEGIN
  -- Marcar cálculos anteriores do mesmo produto/CEP como não-atuais
  UPDATE public.freight_history 
  SET is_current = false 
  WHERE user_id = NEW.user_id 
    AND product_id = NEW.product_id 
    AND zip_code = NEW.zip_code 
    AND id != NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para manter apenas um cálculo atual por produto/CEP
CREATE TRIGGER trigger_mark_previous_freight_outdated
  AFTER INSERT ON public.freight_history
  FOR EACH ROW
  EXECUTE FUNCTION mark_previous_freight_as_outdated();
