export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          customer_id: string | null
          name: string
          manage_name: string | null
          user_code: string | null
          sku: string
          barcode: string | null
          product_db_no: string | null
          category: string
          manufacture_date: string | null
          expiry_date: string | null
          option_size: string | null
          option_color: string | null
          option_lot: string | null
          option_etc: string | null
          quantity: number
          unit: string
          min_stock: number
          price: number
          cost_price: number | null
          location: string | null
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['products']['Row']>
        Update: Partial<Database['public']['Tables']['products']['Row']>
      }
      inventory_quantities: {
        Row: {
          product_id: string
          qty_on_hand: number
          qty_available: number
          qty_allocated: number
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['inventory_quantities']['Row']>
        Update: Partial<Database['public']['Tables']['inventory_quantities']['Row']>
      }
      inbound_receipts: {
        Row: {
          id: string
          plan_id: string
          status: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['inbound_receipts']['Row']>
        Update: Partial<Database['public']['Tables']['inbound_receipts']['Row']>
      }
      inbound_plan_lines: {
        Row: {
          id: string
          plan_id: string
          product_id: string
          expected_qty: number
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['inbound_plan_lines']['Row']>
        Update: Partial<Database['public']['Tables']['inbound_plan_lines']['Row']>
      }
      customer_master: {
        Row: {
          id: string
          code: string
          name: string
          type: string
          contact_email: string | null
          contact_phone: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['customer_master']['Row']>
        Update: Partial<Database['public']['Tables']['customer_master']['Row']>
      }
      customer_contact: {
        Row: {
          id: string
          customer_master_id: string
          name: string
          title: string | null
          department: string | null
          role: string
          email: string | null
          phone: string | null
          mobile: string | null
          fax: string | null
          preferred_contact: string | null
          work_hours: string | null
          timezone: string | null
          language: string | null
          is_primary: boolean
          is_active: boolean
          birthday: string | null
          note: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['customer_contact']['Row']>
        Update: Partial<Database['public']['Tables']['customer_contact']['Row']>
      }
      customer_pricing: {
        Row: {
          id: string
          customer_master_id: string
          org_id: string | null
          pricing_type: string
          service_name: string | null
          service_code: string | null
          unit_price: number
          currency: string
          unit: string
          min_quantity: number | null
          max_quantity: number | null
          effective_from: string
          effective_to: string | null
          volume_discount_rate: number | null
          volume_threshold: number | null
          requires_approval: boolean
          is_active: boolean
          note: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['customer_pricing']['Row']>
        Update: Partial<Database['public']['Tables']['customer_pricing']['Row']>
      }
      customer_activity: {
        Row: {
          id: string
          customer_master_id: string
          activity_type: string
          subject: string
          description: string | null
          related_contact_id: string | null
          performed_by_user_id: string | null
          priority: string
          requires_followup: boolean
          followup_due_date: string | null
          followup_completed: boolean
          followup_completed_at: string | null
          attachment_urls: string[] | null
          tags: string[] | null
          activity_date: string
          duration_minutes: number | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['customer_activity']['Row']>
        Update: Partial<Database['public']['Tables']['customer_activity']['Row']>
      }
      customer_contract: {
        Row: {
          id: string
          customer_master_id: string
          contract_no: string
          contract_name: string
          contract_type: string
          contract_start: string
          contract_end: string | null
          auto_renewal: boolean
          renewal_notice_days: number
          renewal_count: number
          contract_amount: number | null
          currency: string
          payment_terms: number
          payment_method: string | null
          billing_cycle: string
          sla_inbound_processing: number | null
          sla_outbound_cutoff: string | null
          sla_accuracy_rate: number | null
          sla_ontime_ship_rate: number | null
          contract_file_url: string | null
          contract_file_name: string | null
          signed_date: string | null
          signed_by_customer: string | null
          signed_by_company: string | null
          status: string
          parent_contract_id: string | null
          replaced_by_contract_id: string | null
          termination_reason: string | null
          termination_date: string | null
          termination_notice_date: string | null
          reminder_sent: boolean
          reminder_sent_at: string | null
          note: string | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['customer_contract']['Row']>
        Update: Partial<Database['public']['Tables']['customer_contract']['Row']>
      }
      org: {
        Row: {
          id: string
          name: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['org']['Row']>
        Update: Partial<Database['public']['Tables']['org']['Row']>
      }
      warehouse: {
        Row: {
          id: string
          name: string
          type: string | null
          status: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['warehouse']['Row']>
        Update: Partial<Database['public']['Tables']['warehouse']['Row']>
      }
      inventory_ledger: {
        Row: {
          id: string
          transaction_type: string | null
          qty_change: number | null
          created_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['inventory_ledger']['Row']>
        Update: Partial<Database['public']['Tables']['inventory_ledger']['Row']>
      }
      alert_settings: {
        Row: {
          id: string
          alert_key: string
          enabled: boolean | null
          channels: string[] | null
          notify_roles: string[] | null
          notify_users: string[] | null
          cooldown_minutes: number | null
        }
        Insert: Partial<Database['public']['Tables']['alert_settings']['Row']>
        Update: Partial<Database['public']['Tables']['alert_settings']['Row']>
      }
      notifications: {
        Row: {
          id: string
          user_id: string
          title: string
          message: string
          type: string
          link_url: string | null
          action: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['notifications']['Row']>
        Update: Partial<Database['public']['Tables']['notifications']['Row']>
      }
      user_profiles: {
        Row: {
          id: string
          org_id: string | null
          full_name: string | null
          display_name: string | null
          role: string | null
          department: string | null
          status: string | null
          can_access_admin: boolean | null
          can_access_dashboard: boolean | null
          can_manage_users: boolean | null
          can_manage_inventory: boolean | null
          can_manage_orders: boolean | null
          last_login_at: string | null
          created_at: string | null
          deleted_at: string | null
          locked_until: string | null
          locked_reason: string | null
          username: string | null
          email: string | null
        }
        Insert: Partial<Database['public']['Tables']['user_profiles']['Row']>
        Update: Partial<Database['public']['Tables']['user_profiles']['Row']>
      }
      orders: {
        Row: {
          id: string
          order_no: string
          user_id: string | null
          country_code: string | null
          product_name: string | null
          remark: string | null
          logistics_company: string | null
          tracking_no: string | null
          status: string
          created_at: string
          updated_at: string
        }
        Insert: Partial<Database['public']['Tables']['orders']['Row']>
        Update: Partial<Database['public']['Tables']['orders']['Row']>
      }
      order_receivers: {
        Row: {
          id: string
          order_id: string
          name: string
          phone: string | null
          zip: string | null
          address1: string | null
          address2: string | null
          locality: string | null
          country_code: string | null
          meta: Json | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['order_receivers']['Row']>
        Update: Partial<Database['public']['Tables']['order_receivers']['Row']>
      }
      logistics_api_logs: {
        Row: {
          id: string
          order_id: string
          adapter: string
          direction: string
          status: string
          http_code: number | null
          headers: Json | null
          body: Json | null
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['logistics_api_logs']['Row']>
        Update: Partial<Database['public']['Tables']['logistics_api_logs']['Row']>
      }
      order_default_settings: {
        Row: {
          config_key: string
          sender_name: string
          sender_phone: string | null
          sender_zip: string | null
          sender_address: string | null
          sender_address_detail: string | null
          created_at: string
          updated_at: string | null
        }
        Insert: Partial<Database['public']['Tables']['order_default_settings']['Row']>
        Update: Partial<Database['public']['Tables']['order_default_settings']['Row']>
      }
      order_senders: {
        Row: {
          id: string
          name: string
          phone: string | null
          zip: string | null
          address: string | null
          address_detail: string | null
          is_default: boolean
          created_at: string
        }
        Insert: Partial<Database['public']['Tables']['order_senders']['Row']>
        Update: Partial<Database['public']['Tables']['order_senders']['Row']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// 헬퍼 타입
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T]
