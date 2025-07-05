
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface MLNotification {
  resource: string;
  user_id: number;
  application_id: number;
  topic: string;
  attempts: number;
  sent: string;
  received: string;
  data?: {
    id: string;
    status?: string;
    shipping?: {
      shipping_mode?: string;
      shipping_method?: string;
      mandatory_free_shipping?: boolean;
      cost?: number;
    };
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔔 NOTIFICAÇÃO RECEBIDA DO MERCADO LIVRE');
    console.log('Method:', req.method);
    console.log('Headers:', Object.fromEntries(req.headers.entries()));
    
    let notification: MLNotification | null = null;
    
    if (req.method === 'POST') {
      const contentType = req.headers.get('content-type');
      
      if (contentType?.includes('application/json')) {
        notification = await req.json();
      } else if (contentType?.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData();
        const formObj = Object.fromEntries(formData.entries());
        try {
          notification = JSON.parse(formObj.toString());
        } catch {
          notification = formObj as any;
        }
      } else {
        const textBody = await req.text();
        try {
          notification = JSON.parse(textBody);
        } catch {
          console.log('Body como texto:', textBody);
        }
      }
    }
    
    console.log('📦 DADOS DA NOTIFICAÇÃO:', JSON.stringify(notification, null, 2));
    
    // Process freight-related notifications
    if (notification) {
      await processFreightNotification(notification);
    }
    
    return new Response(
      JSON.stringify({ 
        status: 'ok',
        message: 'Notificação processada com sucesso',
        timestamp: new Date().toISOString(),
        notification_type: notification?.topic || 'unknown'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ ERRO AO PROCESSAR NOTIFICAÇÃO:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Erro interno',
        message: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function processFreightNotification(notification: MLNotification) {
  console.log('🚚 PROCESSANDO NOTIFICAÇÃO DE FRETE');
  
  // Check if this is a shipping-related notification
  const isShippingRelated = 
    notification.topic === 'shipments' ||
    notification.topic === 'shipping' ||
    notification.topic === 'items' ||  // Item changes can affect shipping
    (notification.data?.shipping !== undefined);
  
  if (!isShippingRelated) {
    console.log('📋 Notificação não relacionada ao frete, ignorando');
    return;
  }
  
  console.log('🎯 NOTIFICAÇÃO DE FRETE DETECTADA!');
  console.log('Tópico:', notification.topic);
  console.log('Resource:', notification.resource);
  
  // Extract item ID from resource
  let itemId = null;
  
  if (notification.resource) {
    // Extract from different resource patterns
    const patterns = [
      /\/items\/([A-Z0-9]+)/,      // /items/MLB123456
      /\/orders\/(\d+)/,           // /orders/123456 (contains item info)
      /\/shipments\/(\d+)/         // /shipments/123456
    ];
    
    for (const pattern of patterns) {
      const match = notification.resource.match(pattern);
      if (match) {
        itemId = match[1];
        break;
      }
    }
  }
  
  if (itemId) {
    console.log('📦 Item ID identificado:', itemId);
    await invalidateFreightCache(itemId);
  }
  
  // Analyze shipping changes
  const shippingData = notification.data?.shipping;
  
  if (shippingData) {
    console.log('📊 DADOS DE FRETE NA NOTIFICAÇÃO:');
    console.log('- Modo de envio:', shippingData.shipping_mode);
    console.log('- Método de envio:', shippingData.shipping_method);
    console.log('- Frete grátis obrigatório:', shippingData.mandatory_free_shipping);
    console.log('- Custo:', shippingData.cost);
    
    // Detect free shipping changes
    if (shippingData.mandatory_free_shipping !== undefined) {
      console.log('🔄 MUDANÇA DETECTADA: Status de frete grátis obrigatório');
      
      if (itemId) {
        await invalidateFreightCache(itemId);
      }
    }
    
    // Detect cost changes
    if (shippingData.cost !== undefined) {
      console.log('💰 MUDANÇA DETECTADA: Custo de frete alterado');
      
      if (itemId) {
        await invalidateFreightCache(itemId);
      }
    }
  }
  
  // For items topic, always invalidate cache as shipping rules might have changed
  if (notification.topic === 'items' && itemId) {
    console.log('📦 ITEM ALTERADO: Invalidando cache de frete');
    await invalidateFreightCache(itemId);
  }
  
  console.log('✅ Processamento da notificação de frete concluído');
}

async function invalidateFreightCache(itemId: string) {
  console.log(`🗑️ INVALIDANDO CACHE DE FRETE PARA ITEM: ${itemId}`);
  
  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Mark all current freight calculations for this item as outdated
    const { error } = await supabase
      .from('freight_history')
      .update({ 
        is_current: false,
        notification_received_at: new Date().toISOString()
      })
      .eq('product_id', itemId)
      .eq('is_current', true);
    
    if (error) {
      console.error('❌ Erro ao invalidar cache:', error);
    } else {
      console.log(`✅ Cache invalidado para item ${itemId}`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao acessar banco de dados:', error);
  }
}
