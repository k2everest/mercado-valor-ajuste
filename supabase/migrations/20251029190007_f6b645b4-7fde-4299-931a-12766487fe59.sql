-- Tabela para histórico de atualizações de preços no ML
CREATE TABLE IF NOT EXISTS public.price_updates_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  product_id TEXT NOT NULL,
  product_title TEXT,
  original_price DECIMAL(10, 2) NOT NULL,
  freight_cost DECIMAL(10, 2) NOT NULL,
  adjusted_price DECIMAL(10, 2) NOT NULL,
  new_base_price DECIMAL(10, 2) NOT NULL,
  operation TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_first_update BOOLEAN NOT NULL DEFAULT false
);

-- Enable Row Level Security
ALTER TABLE public.price_updates_history ENABLE ROW LEVEL SECURITY;

-- Create policies for user access
CREATE POLICY "Users can view their own price updates" 
ON public.price_updates_history 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own price updates" 
ON public.price_updates_history 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX idx_price_updates_product ON public.price_updates_history(user_id, product_id);
CREATE INDEX idx_price_updates_sent_at ON public.price_updates_history(sent_at DESC);