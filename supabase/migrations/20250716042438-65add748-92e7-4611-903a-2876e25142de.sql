-- Add new fields to user_settings for the requested features
ALTER TABLE public.user_settings 
ADD COLUMN stock_sales_percentage NUMERIC DEFAULT 10.0 CHECK (stock_sales_percentage >= 0 AND stock_sales_percentage <= 100),
ADD COLUMN predicted_savings_enabled BOOLEAN DEFAULT true,
ADD COLUMN standard_deviation_enabled BOOLEAN DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.user_settings.stock_sales_percentage IS 'Percentage of stock that user expects to sell, used for calculations';
COMMENT ON COLUMN public.user_settings.predicted_savings_enabled IS 'Whether to show predicted savings in the header';
COMMENT ON COLUMN public.user_settings.standard_deviation_enabled IS 'Whether to include standard deviation analysis based on sales data';