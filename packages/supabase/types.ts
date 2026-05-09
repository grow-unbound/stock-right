export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: unknown
          new_values: Json | null
          old_values: Json | null
          reason: string | null
          tenant_id: string
          user_id: string | null
          warehouse_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          tenant_id?: string
          user_id?: string | null
          warehouse_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: unknown
          new_values?: Json | null
          old_values?: Json | null
          reason?: string | null
          tenant_id?: string
          user_id?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_log_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      auth_otp_challenges: {
        Row: {
          attempt_count: number
          consumed_at: string | null
          created_at: string
          expires_at: string
          id: string
          locked_until: string | null
          otp_hash: string
          purpose: string
          resend_count: number
          user_id: string
        }
        Insert: {
          attempt_count?: number
          consumed_at?: string | null
          created_at?: string
          expires_at: string
          id?: string
          locked_until?: string | null
          otp_hash: string
          purpose: string
          resend_count?: number
          user_id: string
        }
        Update: {
          attempt_count?: number
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          locked_until?: string | null
          otp_hash?: string
          purpose?: string
          resend_count?: number
          user_id?: string
        }
        Relationships: []
      }
      charge_types: {
        Row: {
          code: string
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          sort_order: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          sort_order?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charge_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_receipts: {
        Row: {
          allocation_confirmed_at: string | null
          created_at: string
          customer_id: string
          id: string
          notes: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          receipt_allocated: boolean
          receipt_date: string
          recorded_by: string | null
          reference_number: string | null
          tenant_id: string
          total_amount: number
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          allocation_confirmed_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          receipt_allocated?: boolean
          receipt_date: string
          recorded_by?: string | null
          reference_number?: string | null
          tenant_id?: string
          total_amount: number
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          allocation_confirmed_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          notes?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          receipt_allocated?: boolean
          receipt_date?: string
          recorded_by?: string | null
          reference_number?: string | null
          tenant_id?: string
          total_amount?: number
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_receipts_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_summary: {
        Row: {
          active_bag_count: number
          active_lot_count: number
          aging_bag_count: number
          aging_lot_count: number
          customer_id: string
          first_transaction_date: string | null
          fresh_bag_count: number
          fresh_lot_count: number
          has_pending_dues: boolean | null
          is_active: boolean
          last_activity_date: string | null
          last_updated_at: string
          outstanding_charges: number
          outstanding_others: number
          outstanding_rents: number
          outstanding_total: number
          stale_bag_count: number
          stale_lot_count: number
          tenant_id: string
          total_paid: number
          warehouse_id: string
        }
        Insert: {
          active_bag_count?: number
          active_lot_count?: number
          aging_bag_count?: number
          aging_lot_count?: number
          customer_id: string
          first_transaction_date?: string | null
          fresh_bag_count?: number
          fresh_lot_count?: number
          has_pending_dues?: boolean | null
          is_active?: boolean
          last_activity_date?: string | null
          last_updated_at?: string
          outstanding_charges?: number
          outstanding_others?: number
          outstanding_rents?: number
          outstanding_total?: number
          stale_bag_count?: number
          stale_lot_count?: number
          tenant_id?: string
          total_paid?: number
          warehouse_id: string
        }
        Update: {
          active_bag_count?: number
          active_lot_count?: number
          aging_bag_count?: number
          aging_lot_count?: number
          customer_id?: string
          first_transaction_date?: string | null
          fresh_bag_count?: number
          fresh_lot_count?: number
          has_pending_dues?: boolean | null
          is_active?: boolean
          last_activity_date?: string | null
          last_updated_at?: string
          outstanding_charges?: number
          outstanding_others?: number
          outstanding_rents?: number
          outstanding_total?: number
          stale_bag_count?: number
          stale_lot_count?: number
          tenant_id?: string
          total_paid?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customer_summary_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: true
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_summary_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_summary_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          category: Database["public"]["Enums"]["customer_category"]
          created_at: string
          credit_limit: number
          customer_code: string
          customer_name: string
          gstin: string | null
          id: string
          is_active: boolean
          mobile: string | null
          notes: string | null
          phone: string | null
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          address?: string | null
          category: Database["public"]["Enums"]["customer_category"]
          created_at?: string
          credit_limit?: number
          customer_code: string
          customer_name: string
          gstin?: string | null
          id?: string
          is_active?: boolean
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          address?: string | null
          category?: Database["public"]["Enums"]["customer_category"]
          created_at?: string
          credit_limit?: number
          customer_code?: string
          customer_name?: string
          gstin?: string | null
          id?: string
          is_active?: boolean
          mobile?: string | null
          notes?: string | null
          phone?: string | null
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_money_summary: {
        Row: {
          id: string
          last_updated_at: string
          net_amount: number | null
          payments_amount: number
          payments_count: number
          receipt_parties: number
          receipts_amount: number
          receipts_count: number
          summary_date: string
          tenant_id: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          last_updated_at?: string
          payments_amount?: number
          payments_count?: number
          receipt_parties?: number
          receipts_amount?: number
          receipts_count?: number
          summary_date: string
          tenant_id?: string
          warehouse_id: string
        }
        Update: {
          id?: string
          last_updated_at?: string
          payments_amount?: number
          payments_count?: number
          receipt_parties?: number
          receipts_amount?: number
          receipts_count?: number
          summary_date?: string
          tenant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_money_summary_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_money_summary_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_stock_summary: {
        Row: {
          active_lots_eod: number
          aging_bags_eod: number
          aging_lots_eod: number
          delivered_bags: number
          delivered_lots: number
          fresh_bags_eod: number
          fresh_lots_eod: number
          id: string
          last_updated_at: string
          lodged_bags: number
          lodged_lots: number
          stale_bags_eod: number
          stale_lots_eod: number
          summary_date: string
          tenant_id: string
          total_bags_eod: number
          warehouse_id: string
        }
        Insert: {
          active_lots_eod?: number
          aging_bags_eod?: number
          aging_lots_eod?: number
          delivered_bags?: number
          delivered_lots?: number
          fresh_bags_eod?: number
          fresh_lots_eod?: number
          id?: string
          last_updated_at?: string
          lodged_bags?: number
          lodged_lots?: number
          stale_bags_eod?: number
          stale_lots_eod?: number
          summary_date: string
          tenant_id?: string
          total_bags_eod?: number
          warehouse_id: string
        }
        Update: {
          active_lots_eod?: number
          aging_bags_eod?: number
          aging_lots_eod?: number
          delivered_bags?: number
          delivered_lots?: number
          fresh_bags_eod?: number
          fresh_lots_eod?: number
          id?: string
          last_updated_at?: string
          lodged_bags?: number
          lodged_lots?: number
          stale_bags_eod?: number
          stale_lots_eod?: number
          summary_date?: string
          tenant_id?: string
          total_bags_eod?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_stock_summary_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "daily_stock_summary_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          blocked_reason: string | null
          created_at: string
          delivery_date: string
          driver_name: string | null
          external_reference_id: string | null
          id: string
          legacy_locations: string | null
          location_ids: string[]
          lot_id: string
          notes: string | null
          num_bags_out: number
          overridden_by: string | null
          override_at: string | null
          override_reason: string | null
          status: Database["public"]["Enums"]["delivery_status"]
          updated_at: string
          vehicle_number: string | null
        }
        Insert: {
          blocked_reason?: string | null
          created_at?: string
          delivery_date: string
          driver_name?: string | null
          external_reference_id?: string | null
          id?: string
          legacy_locations?: string | null
          location_ids?: string[]
          lot_id: string
          notes?: string | null
          num_bags_out: number
          overridden_by?: string | null
          override_at?: string | null
          override_reason?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          vehicle_number?: string | null
        }
        Update: {
          blocked_reason?: string | null
          created_at?: string
          delivery_date?: string
          driver_name?: string | null
          external_reference_id?: string | null
          id?: string
          legacy_locations?: string | null
          location_ids?: string[]
          lot_id?: string
          notes?: string | null
          num_bags_out?: number
          overridden_by?: string | null
          override_at?: string | null
          override_reason?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
          updated_at?: string
          vehicle_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_overridden_by_fkey"
            columns: ["overridden_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          id: string
          name: string
          tenant_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          tenant_id?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          tenant_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locations_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      lot_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          lot_id: string
          new_status: Database["public"]["Enums"]["lot_status"]
          old_status: Database["public"]["Enums"]["lot_status"] | null
          reason: string | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          lot_id: string
          new_status: Database["public"]["Enums"]["lot_status"]
          old_status?: Database["public"]["Enums"]["lot_status"] | null
          reason?: string | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          lot_id?: string
          new_status?: Database["public"]["Enums"]["lot_status"]
          old_status?: Database["public"]["Enums"]["lot_status"] | null
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lot_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lot_status_history_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      lots: {
        Row: {
          balance_bags: number
          charges_pending: number
          created_at: string
          customer_id: string
          driver_name: string | null
          external_reference_id: string | null
          id: string
          legacy_locations: string | null
          location_ids: string[]
          lodgement_date: string
          lot_number: string
          notes: string | null
          original_bags: number
          outstanding_total: number | null
          product_id: string
          rent_pending: number
          rental_mode: Database["public"]["Enums"]["rental_mode"]
          status: Database["public"]["Enums"]["lot_status"]
          tenant_id: string
          updated_at: string
          vehicle_number: string | null
          warehouse_id: string
        }
        Insert: {
          balance_bags: number
          charges_pending?: number
          created_at?: string
          customer_id: string
          driver_name?: string | null
          external_reference_id?: string | null
          id?: string
          legacy_locations?: string | null
          location_ids?: string[]
          lodgement_date: string
          lot_number: string
          notes?: string | null
          original_bags: number
          outstanding_total?: number | null
          product_id: string
          rent_pending?: number
          rental_mode: Database["public"]["Enums"]["rental_mode"]
          status?: Database["public"]["Enums"]["lot_status"]
          tenant_id?: string
          updated_at?: string
          vehicle_number?: string | null
          warehouse_id: string
        }
        Update: {
          balance_bags?: number
          charges_pending?: number
          created_at?: string
          customer_id?: string
          driver_name?: string | null
          external_reference_id?: string | null
          id?: string
          legacy_locations?: string | null
          location_ids?: string[]
          lodgement_date?: string
          lot_number?: string
          notes?: string | null
          original_bags?: number
          outstanding_total?: number | null
          product_id?: string
          rent_pending?: number
          rental_mode?: Database["public"]["Enums"]["rental_mode"]
          status?: Database["public"]["Enums"]["lot_status"]
          tenant_id?: string
          updated_at?: string
          vehicle_number?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "lots_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lots_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      operational_payments: {
        Row: {
          amount: number
          created_at: string
          delivery_id: string | null
          due_date: string | null
          expenditure_head: string | null
          external_reference_id: string | null
          id: string
          lot_id: string | null
          notes: string | null
          party_name: string | null
          party_phone: string | null
          payment_date: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_type_id: string | null
          product_charge_type_id: string | null
          recorded_by: string | null
          reference_number: string | null
          status: Database["public"]["Enums"]["op_payment_status"]
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          delivery_id?: string | null
          due_date?: string | null
          expenditure_head?: string | null
          external_reference_id?: string | null
          id?: string
          lot_id?: string | null
          notes?: string | null
          party_name?: string | null
          party_phone?: string | null
          payment_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_type_id?: string | null
          product_charge_type_id?: string | null
          recorded_by?: string | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["op_payment_status"]
          tenant_id?: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          delivery_id?: string | null
          due_date?: string | null
          expenditure_head?: string | null
          external_reference_id?: string | null
          id?: string
          lot_id?: string | null
          notes?: string | null
          party_name?: string | null
          party_phone?: string | null
          payment_date?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_type_id?: string | null
          product_charge_type_id?: string | null
          recorded_by?: string | null
          reference_number?: string | null
          status?: Database["public"]["Enums"]["op_payment_status"]
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operational_payments_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_payments_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_payments_payment_type_id_fkey"
            columns: ["payment_type_id"]
            isOneToOne: false
            referencedRelation: "payment_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operational_payments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_types: {
        Row: {
          category: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_types_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      product_charges: {
        Row: {
          charge_type_id: string
          charges_per_bag: number
          created_at: string
          product_charge_type_id: string
          product_id: string
          updated_at: string
        }
        Insert: {
          charge_type_id: string
          charges_per_bag: number
          created_at?: string
          product_charge_type_id?: string
          product_id: string
          updated_at?: string
        }
        Update: {
          charge_type_id?: string
          charges_per_bag?: number
          created_at?: string
          product_charge_type_id?: string
          product_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_charges_charge_type_id_fkey"
            columns: ["charge_type_id"]
            isOneToOne: false
            referencedRelation: "charge_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_charges_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_groups: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_product_group_id: string | null
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_product_group_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_product_group_id?: string | null
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_groups_parent_product_group_id_fkey"
            columns: ["parent_product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_groups_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          bag_size: number | null
          chargeable_bag_size: number | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          monthly_rent_per_bag: number | null
          monthly_rent_per_kg: number | null
          product_group_id: string
          product_name: string
          stale_days_limit: number | null
          storage_temperature: string | null
          tenant_id: string
          updated_at: string
          yearly_rent_per_bag: number | null
          yearly_rent_per_kg: number | null
        }
        Insert: {
          bag_size?: number | null
          chargeable_bag_size?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          monthly_rent_per_bag?: number | null
          monthly_rent_per_kg?: number | null
          product_group_id: string
          product_name: string
          stale_days_limit?: number | null
          storage_temperature?: string | null
          tenant_id?: string
          updated_at?: string
          yearly_rent_per_bag?: number | null
          yearly_rent_per_kg?: number | null
        }
        Update: {
          bag_size?: number | null
          chargeable_bag_size?: number | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          monthly_rent_per_bag?: number | null
          monthly_rent_per_kg?: number | null
          product_group_id?: string
          product_name?: string
          stale_days_limit?: number | null
          storage_temperature?: string | null
          tenant_id?: string
          updated_at?: string
          yearly_rent_per_bag?: number | null
          yearly_rent_per_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_product_group_id_fkey"
            columns: ["product_group_id"]
            isOneToOne: false
            referencedRelation: "product_groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_allocations: {
        Row: {
          allocated_by: string | null
          allocated_manually: boolean
          amount: number
          charge_id: string | null
          created_at: string
          id: string
          receipt_id: string
          rent_accrual_id: string | null
          updated_at: string
        }
        Insert: {
          allocated_by?: string | null
          allocated_manually?: boolean
          amount: number
          charge_id?: string | null
          created_at?: string
          id?: string
          receipt_id: string
          rent_accrual_id?: string | null
          updated_at?: string
        }
        Update: {
          allocated_by?: string | null
          allocated_manually?: boolean
          amount?: number
          charge_id?: string | null
          created_at?: string
          id?: string
          receipt_id?: string
          rent_accrual_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_allocations_allocated_by_fkey"
            columns: ["allocated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "transaction_charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "customer_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipt_allocations_rent_accrual_id_fkey"
            columns: ["rent_accrual_id"]
            isOneToOne: false
            referencedRelation: "rent_accruals"
            referencedColumns: ["id"]
          },
        ]
      }
      rent_accruals: {
        Row: {
          accrual_date: string
          accrual_from: string
          accrual_to: string
          created_at: string
          id: string
          is_paid: boolean
          lot_id: string
          notes: string | null
          paid_date: string | null
          rental_amount: number
          rental_mode: Database["public"]["Enums"]["rental_mode"]
          updated_at: string
        }
        Insert: {
          accrual_date: string
          accrual_from: string
          accrual_to: string
          created_at?: string
          id?: string
          is_paid?: boolean
          lot_id: string
          notes?: string | null
          paid_date?: string | null
          rental_amount: number
          rental_mode: Database["public"]["Enums"]["rental_mode"]
          updated_at?: string
        }
        Update: {
          accrual_date?: string
          accrual_from?: string
          accrual_to?: string
          created_at?: string
          id?: string
          is_paid?: boolean
          lot_id?: string
          notes?: string | null
          paid_date?: string | null
          rental_amount?: number
          rental_mode?: Database["public"]["Enums"]["rental_mode"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rent_accruals_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      transaction_charges: {
        Row: {
          charge_amount: number
          charge_date: string
          charge_type_id: string | null
          created_at: string
          delivery_id: string | null
          id: string
          is_paid: boolean
          legacy_amount_paid: number | null
          lot_id: string
          notes: string | null
          num_bags: number | null
          paid_date: string | null
          product_charge_type_id: string | null
          updated_at: string
        }
        Insert: {
          charge_amount: number
          charge_date: string
          charge_type_id?: string | null
          created_at?: string
          delivery_id?: string | null
          id?: string
          is_paid?: boolean
          legacy_amount_paid?: number | null
          lot_id: string
          notes?: string | null
          num_bags?: number | null
          paid_date?: string | null
          product_charge_type_id?: string | null
          updated_at?: string
        }
        Update: {
          charge_amount?: number
          charge_date?: string
          charge_type_id?: string | null
          created_at?: string
          delivery_id?: string | null
          id?: string
          is_paid?: boolean
          legacy_amount_paid?: number | null
          lot_id?: string
          notes?: string | null
          num_bags?: number | null
          paid_date?: string | null
          product_charge_type_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transaction_charges_charge_type_id_fkey"
            columns: ["charge_type_id"]
            isOneToOne: false
            referencedRelation: "charge_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_charges_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_charges_lot_id_fkey"
            columns: ["lot_id"]
            isOneToOne: false
            referencedRelation: "lots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transaction_charges_product_charge_type_id_fkey"
            columns: ["product_charge_type_id"]
            isOneToOne: false
            referencedRelation: "product_charges"
            referencedColumns: ["product_charge_type_id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          email: string | null
          email_verified_at: string | null
          id: string
          is_active: boolean
          phone: string
          terms_accepted_at: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_verified_at?: string | null
          id: string
          is_active?: boolean
          phone: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          email?: string | null
          email_verified_at?: string | null
          id?: string
          is_active?: boolean
          phone?: string
          terms_accepted_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          user_id: string
        }
        Insert: {
          role: Database["public"]["Enums"]["user_role"]
          tenant_id: string
          user_id: string
        }
        Update: {
          role?: Database["public"]["Enums"]["user_role"]
          tenant_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_warehouse_assignments: {
        Row: {
          assigned_at: string
          user_id: string
          warehouse_id: string
        }
        Insert: {
          assigned_at?: string
          user_id: string
          warehouse_id: string
        }
        Update: {
          assigned_at?: string
          user_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_warehouse_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_warehouse_assignments_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_settings: {
        Row: {
          blanket_stale_days: number
          created_at: string
          follow_up_outstanding_days: number
          grace_period_months: number
          id: string
          tenant_id: string
          updated_at: string
          warehouse_id: string
          yearly_rent_cutoff_day: number
          yearly_rent_cutoff_month: number
        }
        Insert: {
          blanket_stale_days?: number
          created_at?: string
          follow_up_outstanding_days?: number
          grace_period_months?: number
          id?: string
          tenant_id?: string
          updated_at?: string
          warehouse_id: string
          yearly_rent_cutoff_day?: number
          yearly_rent_cutoff_month?: number
        }
        Update: {
          blanket_stale_days?: number
          created_at?: string
          follow_up_outstanding_days?: number
          grace_period_months?: number
          id?: string
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
          yearly_rent_cutoff_day?: number
          yearly_rent_cutoff_month?: number
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_settings_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: true
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse_snapshot: {
        Row: {
          active_lots: number
          aging_bags: number
          aging_lots: number
          cash_balance: number
          charges_lots: number
          fresh_bags: number
          fresh_lots: number
          last_updated_at: string
          lots_aged_365_plus: number
          overdue_customers: number
          pending_payables: number
          receivable_charges: number
          receivable_customers: number
          receivable_others: number
          receivable_rents: number
          rent_lots: number
          stale_bags: number
          stale_lots: number
          tenant_id: string
          today_date: string
          today_delivered_bags: number
          today_delivered_lots: number
          today_lodged_bags: number
          today_lodged_lots: number
          today_payments: number
          today_receipt_parties: number
          today_receipts: number
          total_bags: number
          total_lots: number
          total_receivable: number
          warehouse_id: string
        }
        Insert: {
          active_lots?: number
          aging_bags?: number
          aging_lots?: number
          cash_balance?: number
          charges_lots?: number
          fresh_bags?: number
          fresh_lots?: number
          last_updated_at?: string
          lots_aged_365_plus?: number
          overdue_customers?: number
          pending_payables?: number
          receivable_charges?: number
          receivable_customers?: number
          receivable_others?: number
          receivable_rents?: number
          rent_lots?: number
          stale_bags?: number
          stale_lots?: number
          tenant_id?: string
          today_date?: string
          today_delivered_bags?: number
          today_delivered_lots?: number
          today_lodged_bags?: number
          today_lodged_lots?: number
          today_payments?: number
          today_receipt_parties?: number
          today_receipts?: number
          total_bags?: number
          total_lots?: number
          total_receivable?: number
          warehouse_id: string
        }
        Update: {
          active_lots?: number
          aging_bags?: number
          aging_lots?: number
          cash_balance?: number
          charges_lots?: number
          fresh_bags?: number
          fresh_lots?: number
          last_updated_at?: string
          lots_aged_365_plus?: number
          overdue_customers?: number
          pending_payables?: number
          receivable_charges?: number
          receivable_customers?: number
          receivable_others?: number
          receivable_rents?: number
          rent_lots?: number
          stale_bags?: number
          stale_lots?: number
          tenant_id?: string
          today_date?: string
          today_delivered_bags?: number
          today_delivered_lots?: number
          today_lodged_bags?: number
          today_lodged_lots?: number
          today_payments?: number
          today_receipt_parties?: number
          today_receipts?: number
          total_bags?: number
          total_lots?: number
          total_receivable?: number
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_snapshot_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_snapshot_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: true
            referencedRelation: "warehouses"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouses: {
        Row: {
          address: string | null
          capacity_bags: number
          city: string | null
          created_at: string
          id: string
          manager_name: string | null
          manager_phone: string | null
          pincode: string | null
          state: string | null
          tenant_id: string
          updated_at: string
          warehouse_code: string
          warehouse_name: string
        }
        Insert: {
          address?: string | null
          capacity_bags?: number
          city?: string | null
          created_at?: string
          id?: string
          manager_name?: string | null
          manager_phone?: string | null
          pincode?: string | null
          state?: string | null
          tenant_id: string
          updated_at?: string
          warehouse_code: string
          warehouse_name: string
        }
        Update: {
          address?: string | null
          capacity_bags?: number
          city?: string | null
          created_at?: string
          id?: string
          manager_name?: string | null
          manager_phone?: string | null
          pincode?: string | null
          state?: string | null
          tenant_id?: string
          updated_at?: string
          warehouse_code?: string
          warehouse_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "warehouses_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      money_activity: {
        Row: {
          amount: number | null
          counterparty_name: string | null
          created_at: string | null
          customer_code: string | null
          event_id: string | null
          expenditure_head: string | null
          notes: string | null
          occurred_at: string | null
          payment_method: string | null
          payment_type_name: string | null
          receipt_allocated: boolean | null
          reference_number: string | null
          tenant_id: string | null
          transaction_type: string | null
          warehouse_id: string | null
        }
        Relationships: []
      }
      money_events: {
        Row: {
          amount: number | null
          customer_id: string | null
          event_date: string | null
          event_type: string | null
          expenditure_head: string | null
          id: string | null
          party_name: string | null
          payment_method: string | null
          payment_type_category: string | null
          payment_type_id: string | null
          payment_type_name: string | null
          status: string | null
          warehouse_id: string | null
        }
        Relationships: []
      }
      stock_events: {
        Row: {
          balance_bags: number | null
          customer_id: string | null
          delivery_id: string | null
          event_date: string | null
          event_type: string | null
          id: string | null
          num_bags: number | null
          status: string | null
          warehouse_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _generate_rent_accruals_for_month_warehouse: {
        Args: {
          p_month: string
          p_narrow_lot_scope?: boolean
          p_warehouse_id: string
        }
        Returns: Json
      }
      accessible_warehouse_ids: { Args: never; Returns: string[] }
      backfill_rent_accruals: {
        Args: {
          p_from_month?: string
          p_through_month?: string
          p_warehouse_id?: string
        }
        Returns: Json
      }
      confirm_receipt_allocations: {
        Args: {
          p_lines: Json
          p_receipt_id: string
        }
        Returns: Json
      }
      count_money_movements: {
        Args: {
          p_search?: string | null
          p_transaction_type?: string | null
          p_warehouse_id: string
        }
        Returns: number
      }
      count_stock_movements: {
        Args: {
          p_filter?: string | null
          p_search?: string | null
          p_warehouse_id: string
        }
        Returns: number
      }
      current_tenant_id: { Args: never; Returns: string }
      customer_outstanding_allocatable: {
        Args: {
          p_customer_id: string
          p_warehouse_id: string
        }
        Returns: {
          balance_bags: number
          charge_type_code: string | null
          display_period: string | null
          due_amount: number
          line_id: string
          line_kind: string
          line_label: string
          lot_id: string
          lot_number: string
          original_bags: number
          product_name: string
          remaining_amount: number
          rental_mode: string | null
          sort_date: string
        }[]
      }
      generate_rent_accruals_for_month: {
        Args: {
          p_month: string
          p_narrow_lot_scope?: boolean
          p_warehouse_id: string
        }
        Returns: Json
      }
      get_customers_paged: {
        Args: {
          p_filter?: string
          p_last_id?: string
          p_last_sort_val?: string
          p_limit?: number
          p_warehouse_id: string
        }
        Returns: {
          address: string
          bag_count: number
          customer_code: string
          customer_id: string
          customer_name: string
          has_stock: boolean
          last_activity_date: string
          lot_count: number
          mobile: string
          outstanding: number
          phone: string
        }[]
      }
      get_money_events: {
        Args: {
          p_event_type?: string
          p_last_date?: string
          p_last_id?: string
          p_limit?: number
          p_warehouse_id: string
        }
        Returns: {
          counterparty: string
          created_at: string
          event_id: string
          kind: string
          notes: string
          payment_method: string
          total_amount: number
          tx_date: string
        }[]
      }
      get_stock_events: {
        Args: {
          p_event_type?: string
          p_last_date?: string
          p_last_id?: string
          p_limit?: number
          p_warehouse_id: string
        }
        Returns: {
          created_at: string
          customer_code: string
          customer_name: string
          event_id: string
          kind: string
          lot_id: string
          lot_number: string
          num_bags: number
          product_group_name: string
          product_name: string
          tx_date: string
        }[]
      }
      list_money_movements: {
        Args: {
          p_page?: number
          p_page_size?: number
          p_search?: string | null
          p_sort_column?: string
          p_sort_direction?: string
          p_transaction_type?: string | null
          p_warehouse_id: string
        }
        Returns: {
          amount: number
          counterparty_name: string
          created_at: string
          customer_code: string | null
          event_id: string
          expenditure_head: string | null
          notes: string | null
          occurred_at: string
          payment_method: string | null
          payment_type_name: string | null
          receipt_allocated: boolean | null
          reference_number: string | null
          transaction_type: string
        }[]
      }
      count_parties_tab: {
        Args: {
          p_filter?: string
          p_search?: string
          p_warehouse_id: string
        }
        Returns: number
      }
      list_parties_tab: {
        Args: {
          p_filter?: string
          p_page?: number
          p_page_size?: number
          p_search?: string
          p_warehouse_id: string
        }
        Returns: {
          address: string
          aging_bag_count: number
          aging_lot_count: number
          bags_active_stale_delivered: number
          customer_code: string
          customer_id: string
          customer_name: string
          fresh_bag_count: number
          fresh_lot_count: number
          lots_active: number
          lots_delivered: number
          lots_stale: number
          outstanding_charges: number
          outstanding_rents: number
          outstanding_total: number
          stale_bag_count: number
          stale_lot_count: number
        }[]
      }
      parties_tab_kpis: {
        Args: { p_warehouse_id: string }
        Returns: {
          customers_with_outstanding: number
          parties_with_stale: number
          stale_stock_bags: number
          total_outstanding: number
        }[]
      }
      list_stock_movements: {
        Args: {
          p_filter?: string | null
          p_page?: number
          p_page_size?: number
          p_search?: string | null
          p_sort_column?: string | null
          p_sort_direction?: string | null
          p_warehouse_id: string
        }
        Returns: {
          balance_bags: number
          charges_pending: number
          created_at: string
          customer_code: string
          customer_name: string
          event_id: string
          lot_id: string
          lot_number: string
          lot_status: string
          num_bags: number
          product_name: string
          rent_pending: number
          transaction_type: string
          tx_date: string
        }[]
      }
      parties_receivables_summary: {
        Args: { p_warehouse_id: string }
        Returns: {
          charges_lot_count: number
          charges_receivable: number
          customers_with_dues: number
          others_customer_count: number
          others_receivable: number
          rent_lot_count: number
          rent_receivable: number
          total_receivable: number
          updated_at: string
        }[]
      }
      stock_tab_stale_kpis: {
        Args: { p_warehouse_id: string }
        Returns: {
          stale_bags: number
          stale_lots: number
        }[]
      }
      user_can_manage_money: { Args: never; Returns: boolean }
      rent_yearly_cutoff_in_year: {
        Args: { p_cut_day: number; p_cut_month: number; p_year: number }
        Returns: string
      }
    }
    Enums: {
      customer_category: "TRADER" | "FARMER"
      delivery_status: "SCHEDULED" | "DELIVERED" | "BLOCKED"
      lot_status:
        | "ACTIVE"
        | "STALE"
        | "DELIVERED"
        | "CLEARED"
        | "WRITTEN_OFF"
        | "DISPUTED"
      op_payment_status: "PENDING" | "PAID"
      payment_method: "CASH" | "BANK_TRANSFER" | "CHEQUE" | "UPI" | "OTHER"
      rental_mode: "YEARLY" | "MONTHLY" | "BROUGHT_FORWARD"
      user_role: "OWNER" | "MANAGER" | "STAFF"
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
    Enums: {
      customer_category: ["TRADER", "FARMER"],
      delivery_status: ["SCHEDULED", "DELIVERED", "BLOCKED"],
      lot_status: [
        "ACTIVE",
        "STALE",
        "DELIVERED",
        "CLEARED",
        "WRITTEN_OFF",
        "DISPUTED",
      ],
      op_payment_status: ["PENDING", "PAID"],
      payment_method: ["CASH", "BANK_TRANSFER", "CHEQUE", "UPI", "OTHER"],
      rental_mode: ["YEARLY", "MONTHLY", "BROUGHT_FORWARD"],
      user_role: ["OWNER", "MANAGER", "STAFF"],
    },
  },
} as const
