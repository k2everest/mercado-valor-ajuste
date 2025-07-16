-- Add service quality field to user_settings table
ALTER TABLE public.user_settings 
ADD COLUMN service_quality_threshold numeric DEFAULT 50.0;