import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.50.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NFEData {
  nfeNumber: string;
  serie: string;
  emissionDate: string;
  supplierCnpj: string;
  supplierName: string;
  totalValue: number;
  taxValue: number;
  freightValue: number;
  insuranceValue: number;
  discountValue: number;
  items: NFEItem[];
}

interface NFEItem {
  sequence: number;
  sku: string;
  description: string;
  ncm?: string;
  cfop?: string;
  quantity: number;
  unitValue: number;
  totalValue: number;
  icmsValue: number;
  ipiValue: number;
  pisValue: number;
  cofinsValue: number;
}

function parseXMLToNFE(xmlContent: string): NFEData {
  console.log('=== INICIANDO PARSE XML NFE ===');
  
  // Basic XML parsing (simplified for this implementation)
  // In a real implementation, you would use a proper XML parser
  
  // Extract NFE number
  const nfeNumberMatch = xmlContent.match(/<nNF>(\d+)<\/nNF>/);
  const nfeNumber = nfeNumberMatch ? nfeNumberMatch[1] : '';
  
  // Extract serie
  const serieMatch = xmlContent.match(/<serie>(\d+)<\/serie>/);
  const serie = serieMatch ? serieMatch[1] : '';
  
  // Extract emission date
  const dateMatch = xmlContent.match(/<dhEmi>([^<]+)<\/dhEmi>/);
  const emissionDate = dateMatch ? dateMatch[1].split('T')[0] : '';
  
  // Extract supplier CNPJ
  const cnpjMatch = xmlContent.match(/<CNPJ>(\d+)<\/CNPJ>/);
  const supplierCnpj = cnpjMatch ? cnpjMatch[1] : '';
  
  // Extract supplier name
  const nameMatch = xmlContent.match(/<xNome>([^<]+)<\/xNome>/);
  const supplierName = nameMatch ? nameMatch[1] : '';
  
  // Extract total values
  const totalMatch = xmlContent.match(/<vNF>([^<]+)<\/vNF>/);
  const totalValue = totalMatch ? parseFloat(totalMatch[1]) : 0;
  
  const taxMatch = xmlContent.match(/<vTotTrib>([^<]+)<\/vTotTrib>/);
  const taxValue = taxMatch ? parseFloat(taxMatch[1]) : 0;
  
  const freightMatch = xmlContent.match(/<vFrete>([^<]+)<\/vFrete>/);
  const freightValue = freightMatch ? parseFloat(freightMatch[1]) : 0;
  
  const insuranceMatch = xmlContent.match(/<vSeg>([^<]+)<\/vSeg>/);
  const insuranceValue = insuranceMatch ? parseFloat(insuranceMatch[1]) : 0;
  
  const discountMatch = xmlContent.match(/<vDesc>([^<]+)<\/vDesc>/);
  const discountValue = discountMatch ? parseFloat(discountMatch[1]) : 0;
  
  // Extract items (simplified extraction)
  const items: NFEItem[] = [];
  const detRegex = /<det nItem="(\d+)">([\s\S]*?)<\/det>/g;
  let match;
  
  while ((match = detRegex.exec(xmlContent)) !== null) {
    const itemNumber = parseInt(match[1]);
    const itemXml = match[2];
    
    // Extract item data
    const skuMatch = itemXml.match(/<cProd>([^<]+)<\/cProd>/);
    const sku = skuMatch ? skuMatch[1] : '';
    
    const descMatch = itemXml.match(/<xProd>([^<]+)<\/xProd>/);
    const description = descMatch ? descMatch[1] : '';
    
    const ncmMatch = itemXml.match(/<NCM>([^<]+)<\/NCM>/);
    const ncm = ncmMatch ? ncmMatch[1] : '';
    
    const cfopMatch = itemXml.match(/<CFOP>([^<]+)<\/CFOP>/);
    const cfop = cfopMatch ? cfopMatch[1] : '';
    
    const qtyMatch = itemXml.match(/<qCom>([^<]+)<\/qCom>/);
    const quantity = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
    
    const unitValueMatch = itemXml.match(/<vUnCom>([^<]+)<\/vUnCom>/);
    const unitValue = unitValueMatch ? parseFloat(unitValueMatch[1]) : 0;
    
    const totalValueMatch = itemXml.match(/<vProd>([^<]+)<\/vProd>/);
    const itemTotalValue = totalValueMatch ? parseFloat(totalValueMatch[1]) : 0;
    
    // Extract tax values
    const icmsMatch = itemXml.match(/<vICMS>([^<]+)<\/vICMS>/);
    const icmsValue = icmsMatch ? parseFloat(icmsMatch[1]) : 0;
    
    const ipiMatch = itemXml.match(/<vIPI>([^<]+)<\/vIPI>/);
    const ipiValue = ipiMatch ? parseFloat(ipiMatch[1]) : 0;
    
    const pisMatch = itemXml.match(/<vPIS>([^<]+)<\/vPIS>/);
    const pisValue = pisMatch ? parseFloat(pisMatch[1]) : 0;
    
    const cofinsMatch = itemXml.match(/<vCOFINS>([^<]+)<\/vCOFINS>/);
    const cofinsValue = cofinsMatch ? parseFloat(cofinsMatch[1]) : 0;
    
    items.push({
      sequence: itemNumber,
      sku,
      description,
      ncm,
      cfop,
      quantity,
      unitValue,
      totalValue: itemTotalValue,
      icmsValue,
      ipiValue,
      pisValue,
      cofinsValue,
    });
  }
  
  console.log('Parse concluído:', {
    nfeNumber,
    serie,
    totalItems: items.length,
    totalValue
  });
  
  return {
    nfeNumber,
    serie,
    emissionDate,
    supplierCnpj,
    supplierName,
    totalValue,
    taxValue,
    freightValue,
    insuranceValue,
    discountValue,
    items
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user ID from auth header
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Usuário não autenticado');
    }

    const { xmlContent } = await req.json();
    
    console.log('=== PROCESSAMENTO DE NFE XML ===');
    console.log('Usuário:', user.id);
    console.log('Tamanho do XML:', xmlContent?.length || 0);

    if (!xmlContent) {
      throw new Error('Conteúdo XML é obrigatório');
    }

    // Parse XML to extract NFE data
    const nfeData = parseXMLToNFE(xmlContent);
    
    if (!nfeData.nfeNumber) {
      throw new Error('NFE inválida: número da nota não encontrado');
    }

    // Insert NFE import record
    const { data: nfeImport, error: nfeError } = await supabase
      .from('nfe_imports')
      .insert({
        user_id: user.id,
        nfe_number: nfeData.nfeNumber,
        serie: nfeData.serie,
        emission_date: nfeData.emissionDate,
        supplier_cnpj: nfeData.supplierCnpj,
        supplier_name: nfeData.supplierName,
        total_value: nfeData.totalValue,
        tax_value: nfeData.taxValue,
        freight_value: nfeData.freightValue,
        insurance_value: nfeData.insuranceValue,
        discount_value: nfeData.discountValue,
        xml_content: xmlContent,
      })
      .select()
      .single();

    if (nfeError) {
      console.error('Erro ao inserir NFE:', nfeError);
      throw new Error(`Erro ao inserir NFE: ${nfeError.message}`);
    }

    console.log('NFE inserida:', nfeImport.id);

    // Insert NFE items
    const nfeItems = nfeData.items.map(item => ({
      nfe_import_id: nfeImport.id,
      item_sequence: item.sequence,
      sku: item.sku,
      description: item.description,
      ncm: item.ncm,
      cfop: item.cfop,
      quantity: item.quantity,
      unit_value: item.unitValue,
      total_value: item.totalValue,
      icms_value: item.icmsValue,
      ipi_value: item.ipiValue,
      pis_value: item.pisValue,
      cofins_value: item.cofinsValue,
    }));

    const { data: insertedItems, error: itemsError } = await supabase
      .from('nfe_items')
      .insert(nfeItems)
      .select();

    if (itemsError) {
      console.error('Erro ao inserir itens da NFE:', itemsError);
      throw new Error(`Erro ao inserir itens da NFE: ${itemsError.message}`);
    }

    console.log('Itens da NFE inseridos:', insertedItems?.length || 0);

    // Try to match NFE items with existing products and update/create them
    for (const item of nfeData.items) {
      if (item.sku && item.description) {
        await supabase
          .from('products')
          .upsert({
            user_id: user.id,
            sku: item.sku,
            name: item.description,
            purchase_price: item.unitValue,
          }, { onConflict: 'user_id,sku' });
      }
    }

    const response = {
      success: true,
      message: `NFE ${nfeData.nfeNumber} processada com sucesso`,
      data: {
        nfeImport: nfeImport,
        items: insertedItems,
        summary: {
          nfeNumber: nfeData.nfeNumber,
          serie: nfeData.serie,
          supplier: nfeData.supplierName,
          totalItems: nfeData.items.length,
          totalValue: nfeData.totalValue,
          taxValue: nfeData.taxValue,
          freightValue: nfeData.freightValue,
        }
      }
    };

    console.log('=== NFE PROCESSADA COM SUCESSO ===');
    console.log('NFE:', nfeData.nfeNumber);
    console.log('Itens:', nfeData.items.length);
    console.log('Valor total:', nfeData.totalValue);

    return new Response(
      JSON.stringify(response),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('=== ERRO NO PROCESSAMENTO NFE ===');
    console.error('Mensagem:', error.message);
    console.error('Stack:', error.stack);
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message || 'Erro interno do servidor',
        details: 'Verifique os logs da função para mais detalhes'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});