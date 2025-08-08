export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instanciate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      additional_costs: {
        Row: {
          cost_type: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          percentage_base: string | null
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          cost_type: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          percentage_base?: string | null
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          cost_type?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          percentage_base?: string | null
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      cost_allocations: {
        Row: {
          allocated_amount: number
          allocation_percentage: number
          allocation_type: string
          created_at: string
          id: string
          import_batch_id: string
          product_id: string
          user_id: string
        }
        Insert: {
          allocated_amount: number
          allocation_percentage: number
          allocation_type: string
          created_at?: string
          id?: string
          import_batch_id: string
          product_id: string
          user_id: string
        }
        Update: {
          allocated_amount?: number
          allocation_percentage?: number
          allocation_type?: string
          created_at?: string
          id?: string
          import_batch_id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cost_allocations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      freight_history: {
        Row: {
          calculated_at: string
          created_at: string
          freight_cost: number
          freight_method: string
          id: string
          is_current: boolean
          notification_received_at: string | null
          product_id: string
          seller_freight_cost: number
          user_id: string
          zip_code: string
        }
        Insert: {
          calculated_at?: string
          created_at?: string
          freight_cost: number
          freight_method: string
          id?: string
          is_current?: boolean
          notification_received_at?: string | null
          product_id: string
          seller_freight_cost: number
          user_id: string
          zip_code: string
        }
        Update: {
          calculated_at?: string
          created_at?: string
          freight_cost?: number
          freight_method?: string
          id?: string
          is_current?: boolean
          notification_received_at?: string | null
          product_id?: string
          seller_freight_cost?: number
          user_id?: string
          zip_code?: string
        }
        Relationships: []
      }
      nfe_imports: {
        Row: {
          created_at: string
          discount_value: number | null
          emission_date: string
          freight_value: number | null
          id: string
          insurance_value: number | null
          nfe_number: string
          processed_at: string
          serie: string
          supplier_cnpj: string
          supplier_name: string
          tax_value: number | null
          total_value: number
          user_id: string
          xml_content: string | null
        }
        Insert: {
          created_at?: string
          discount_value?: number | null
          emission_date: string
          freight_value?: number | null
          id?: string
          insurance_value?: number | null
          nfe_number: string
          processed_at?: string
          serie: string
          supplier_cnpj: string
          supplier_name: string
          tax_value?: number | null
          total_value: number
          user_id: string
          xml_content?: string | null
        }
        Update: {
          created_at?: string
          discount_value?: number | null
          emission_date?: string
          freight_value?: number | null
          id?: string
          insurance_value?: number | null
          nfe_number?: string
          processed_at?: string
          serie?: string
          supplier_cnpj?: string
          supplier_name?: string
          tax_value?: number | null
          total_value?: number
          user_id?: string
          xml_content?: string | null
        }
        Relationships: []
      }
      nfe_items: {
        Row: {
          cfop: string | null
          cofins_value: number | null
          created_at: string
          description: string
          icms_value: number | null
          id: string
          ipi_value: number | null
          item_sequence: number
          ncm: string | null
          nfe_import_id: string
          pis_value: number | null
          product_id: string | null
          quantity: number
          sku: string
          total_value: number
          unit_value: number
        }
        Insert: {
          cfop?: string | null
          cofins_value?: number | null
          created_at?: string
          description: string
          icms_value?: number | null
          id?: string
          ipi_value?: number | null
          item_sequence: number
          ncm?: string | null
          nfe_import_id: string
          pis_value?: number | null
          product_id?: string | null
          quantity: number
          sku: string
          total_value: number
          unit_value: number
        }
        Update: {
          cfop?: string | null
          cofins_value?: number | null
          created_at?: string
          description?: string
          icms_value?: number | null
          id?: string
          ipi_value?: number | null
          item_sequence?: number
          ncm?: string | null
          nfe_import_id?: string
          pis_value?: number | null
          product_id?: string | null
          quantity?: number
          sku?: string
          total_value?: number
          unit_value?: number
        }
        Relationships: [
          {
            foreignKeyName: "nfe_items_nfe_import_id_fkey"
            columns: ["nfe_import_id"]
            isOneToOne: false
            referencedRelation: "nfe_imports"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "nfe_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing_calculations: {
        Row: {
          additional_costs: number | null
          calculated_at: string
          created_at: string
          current_markup: number | null
          current_selling_price: number | null
          id: string
          margin_percentage: number
          product_id: string
          purchase_cost: number
          suggested_markup: number
          suggested_price: number
          tax_cost: number | null
          total_cost: number
          user_id: string
        }
        Insert: {
          additional_costs?: number | null
          calculated_at?: string
          created_at?: string
          current_markup?: number | null
          current_selling_price?: number | null
          id?: string
          margin_percentage: number
          product_id: string
          purchase_cost: number
          suggested_markup: number
          suggested_price: number
          tax_cost?: number | null
          total_cost: number
          user_id: string
        }
        Update: {
          additional_costs?: number | null
          calculated_at?: string
          created_at?: string
          current_markup?: number | null
          current_selling_price?: number | null
          id?: string
          margin_percentage?: number
          product_id?: string
          purchase_cost?: number
          suggested_markup?: number
          suggested_price?: number
          tax_cost?: number | null
          total_cost?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pricing_calculations_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          brand: string | null
          category: string | null
          created_at: string
          dimensions: Json | null
          id: string
          ml_product_id: string | null
          name: string
          purchase_price: number
          selling_price: number | null
          sku: string
          supplier: string | null
          updated_at: string
          user_id: string
          weight: number | null
        }
        Insert: {
          brand?: string | null
          category?: string | null
          created_at?: string
          dimensions?: Json | null
          id?: string
          ml_product_id?: string | null
          name: string
          purchase_price?: number
          selling_price?: number | null
          sku: string
          supplier?: string | null
          updated_at?: string
          user_id: string
          weight?: number | null
        }
        Update: {
          brand?: string | null
          category?: string | null
          created_at?: string
          dimensions?: Json | null
          id?: string
          ml_product_id?: string | null
          name?: string
          purchase_price?: number
          selling_price?: number | null
          sku?: string
          supplier?: string | null
          updated_at?: string
          user_id?: string
          weight?: number | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          created_at: string
          event_data: Json | null
          event_type: string
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_data?: Json | null
          event_type: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_data?: Json | null
          event_type?: string
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      tax_settings: {
        Row: {
          cnpj: string | null
          cofins_percentage: number | null
          created_at: string
          expected_tickets_monthly: number | null
          icms_percentage: number | null
          id: string
          ipi_percentage: number | null
          operational_cost_monthly: number | null
          pis_percentage: number | null
          simples_percentage: number | null
          state_ie: string | null
          target_margin_percentage: number | null
          tax_regime: string
          updated_at: string
          user_id: string
        }
        Insert: {
          cnpj?: string | null
          cofins_percentage?: number | null
          created_at?: string
          expected_tickets_monthly?: number | null
          icms_percentage?: number | null
          id?: string
          ipi_percentage?: number | null
          operational_cost_monthly?: number | null
          pis_percentage?: number | null
          simples_percentage?: number | null
          state_ie?: string | null
          target_margin_percentage?: number | null
          tax_regime: string
          updated_at?: string
          user_id: string
        }
        Update: {
          cnpj?: string | null
          cofins_percentage?: number | null
          created_at?: string
          expected_tickets_monthly?: number | null
          icms_percentage?: number | null
          id?: string
          ipi_percentage?: number | null
          operational_cost_monthly?: number | null
          pis_percentage?: number | null
          simples_percentage?: number | null
          state_ie?: string | null
          target_margin_percentage?: number | null
          tax_regime?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_last_calculations: {
        Row: {
          calculations: Json
          created_at: string
          id: string
          updated_at: string
          user_id: string
          zip_code: string | null
        }
        Insert: {
          calculations?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id: string
          zip_code?: string | null
        }
        Update: {
          calculations?: Json
          created_at?: string
          id?: string
          updated_at?: string
          user_id?: string
          zip_code?: string | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          id: string
          predicted_savings_enabled: boolean | null
          preferred_language: string | null
          service_quality_threshold: number | null
          shipping_cost: number | null
          standard_deviation_enabled: boolean | null
          stock_sales_percentage: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          predicted_savings_enabled?: boolean | null
          preferred_language?: string | null
          service_quality_threshold?: number | null
          shipping_cost?: number | null
          standard_deviation_enabled?: boolean | null
          stock_sales_percentage?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          predicted_savings_enabled?: boolean | null
          preferred_language?: string | null
          service_quality_threshold?: number | null
          shipping_cost?: number | null
          standard_deviation_enabled?: boolean | null
          stock_sales_percentage?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      log_security_event: {
        Args: {
          p_user_id?: string
          p_event_type?: string
          p_event_data?: Json
          p_ip_address?: string
          p_user_agent?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
