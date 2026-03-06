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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      api_rate_limits: {
        Row: {
          actor_key: string
          actor_key_type: string
          created_at: string
          request_count: number
          scope: string
          updated_at: string
          window_start: string
        }
        Insert: {
          actor_key: string
          actor_key_type?: string
          created_at?: string
          request_count?: number
          scope: string
          updated_at?: string
          window_start: string
        }
        Update: {
          actor_key?: string
          actor_key_type?: string
          created_at?: string
          request_count?: number
          scope?: string
          updated_at?: string
          window_start?: string
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: number
          new_value: Json | null
          old_value: Json | null
          record_id: string | null
          table_name: string
          tenant_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: number
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name: string
          tenant_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: number
          new_value?: Json | null
          old_value?: Json | null
          record_id?: string | null
          table_name?: string
          tenant_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_role: string | null
          created_at: string | null
          id: string
          ip_address: unknown
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_role?: string | null
          created_at?: string | null
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      audit_logs_archive: {
        Row: {
          action_type: string
          actor_id: string | null
          actor_role: string | null
          archived_at: string
          created_at: string
          id: string
          ip_address: unknown
          new_value: Json | null
          old_value: Json | null
          reason: string | null
          resource_id: string | null
          resource_type: string
          user_agent: string | null
        }
        Insert: {
          action_type: string
          actor_id?: string | null
          actor_role?: string | null
          archived_at?: string
          created_at: string
          id: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          resource_id?: string | null
          resource_type: string
          user_agent?: string | null
        }
        Update: {
          action_type?: string
          actor_id?: string | null
          actor_role?: string | null
          archived_at?: string
          created_at?: string
          id?: string
          ip_address?: unknown
          new_value?: Json | null
          old_value?: Json | null
          reason?: string | null
          resource_id?: string | null
          resource_type?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      billing_invoice: {
        Row: {
          brand_id: string | null
          created_at: string | null
          currency: string | null
          customer_master_id: string
          due_date: string | null
          id: string
          invoice_date: string
          invoice_no: string
          issued_at: string | null
          note: string | null
          paid_at: string | null
          period_from: string
          period_to: string
          status: string | null
          subtotal: number
          tax_amount: number
          total_amount: number
          updated_at: string | null
        }
        Insert: {
          brand_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_master_id: string
          due_date?: string | null
          id?: string
          invoice_date: string
          invoice_no: string
          issued_at?: string | null
          note?: string | null
          paid_at?: string | null
          period_from: string
          period_to: string
          status?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string | null
        }
        Update: {
          brand_id?: string | null
          created_at?: string | null
          currency?: string | null
          customer_master_id?: string
          due_date?: string | null
          id?: string
          invoice_date?: string
          invoice_no?: string
          issued_at?: string | null
          note?: string | null
          paid_at?: string | null
          period_from?: string
          period_to?: string
          status?: string | null
          subtotal?: number
          tax_amount?: number
          total_amount?: number
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoice_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoice_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_invoice_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_invoice_line: {
        Row: {
          billing_invoice_id: string
          description: string
          id: string
          item_type: string
          line_amount: number
          line_no: number | null
          quantity: number
          ref_id: string | null
          ref_type: string | null
          unit_price: number
        }
        Insert: {
          billing_invoice_id: string
          description: string
          id?: string
          item_type: string
          line_amount: number
          line_no?: number | null
          quantity?: number
          ref_id?: string | null
          ref_type?: string | null
          unit_price: number
        }
        Update: {
          billing_invoice_id?: string
          description?: string
          id?: string
          item_type?: string
          line_amount?: number
          line_no?: number | null
          quantity?: number
          ref_id?: string | null
          ref_type?: string | null
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_invoice_line_billing_invoice_id_fkey"
            columns: ["billing_invoice_id"]
            isOneToOne: false
            referencedRelation: "billing_invoice"
            referencedColumns: ["id"]
          },
        ]
      }
      brand: {
        Row: {
          allow_backorder: boolean | null
          auto_allocate: boolean | null
          code: string
          country_code: string | null
          created_at: string | null
          customer_master_id: string
          description: string | null
          id: string
          is_default_brand: boolean | null
          logo_url: string | null
          metadata: Json | null
          name_en: string | null
          name_ko: string | null
          name_zh: string | null
          require_lot_tracking: boolean | null
          status: string | null
          updated_at: string | null
          website_url: string | null
        }
        Insert: {
          allow_backorder?: boolean | null
          auto_allocate?: boolean | null
          code: string
          country_code?: string | null
          created_at?: string | null
          customer_master_id: string
          description?: string | null
          id?: string
          is_default_brand?: boolean | null
          logo_url?: string | null
          metadata?: Json | null
          name_en?: string | null
          name_ko?: string | null
          name_zh?: string | null
          require_lot_tracking?: boolean | null
          status?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Update: {
          allow_backorder?: boolean | null
          auto_allocate?: boolean | null
          code?: string
          country_code?: string | null
          created_at?: string | null
          customer_master_id?: string
          description?: string | null
          id?: string
          is_default_brand?: boolean | null
          logo_url?: string | null
          metadata?: Json | null
          name_en?: string | null
          name_ko?: string | null
          name_zh?: string | null
          require_lot_tracking?: boolean | null
          status?: string | null
          updated_at?: string | null
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "brand_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      brand_warehouse: {
        Row: {
          allow_inbound: boolean | null
          allow_outbound: boolean | null
          allow_stock_hold: boolean | null
          brand_id: string
          created_at: string | null
          fulfill_priority: number | null
          handling_rate: number | null
          id: string
          is_primary: boolean | null
          rate_currency: string | null
          status: string | null
          storage_rate: number | null
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          allow_inbound?: boolean | null
          allow_outbound?: boolean | null
          allow_stock_hold?: boolean | null
          brand_id: string
          created_at?: string | null
          fulfill_priority?: number | null
          handling_rate?: number | null
          id?: string
          is_primary?: boolean | null
          rate_currency?: string | null
          status?: string | null
          storage_rate?: number | null
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          allow_inbound?: boolean | null
          allow_outbound?: boolean | null
          allow_stock_hold?: boolean | null
          brand_id?: string
          created_at?: string | null
          fulfill_priority?: number | null
          handling_rate?: number | null
          id?: string
          is_primary?: boolean | null
          rate_currency?: string | null
          status?: string | null
          storage_rate?: number | null
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_warehouse_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_warehouse_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      common_codes: {
        Row: {
          code: string
          created_at: string | null
          description: string | null
          group_code: string
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          description?: string | null
          group_code: string
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          description?: string | null
          group_code?: string
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      cs_alerts: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          metadata: Json | null
          partner_id: string | null
          ref: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string | null
          status: string | null
          type: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          partner_id?: string | null
          ref?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          status?: string | null
          type: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          metadata?: Json | null
          partner_id?: string | null
          ref?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string | null
          status?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "cs_alerts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "my_partner_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_alerts_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_conversations: {
        Row: {
          channel: string
          created_at: string | null
          id: string
          lang_in: string | null
          partner_id: string | null
          status: string | null
          subject: string | null
          updated_at: string | null
        }
        Insert: {
          channel: string
          created_at?: string | null
          id?: string
          lang_in?: string | null
          partner_id?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Update: {
          channel?: string
          created_at?: string | null
          id?: string
          lang_in?: string | null
          partner_id?: string | null
          status?: string | null
          subject?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_conversations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "my_partner_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_conversations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_glossary: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          note: string | null
          priority: number | null
          term_ko: string
          term_zh: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          note?: string | null
          priority?: number | null
          term_ko: string
          term_zh: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          note?: string | null
          priority?: number | null
          term_ko?: string
          term_zh?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      cs_messages: {
        Row: {
          content: string
          convo_id: string | null
          created_at: string | null
          id: string
          intent: string | null
          lang: string
          role: string
          slots: Json | null
          tool_name: string | null
          tool_payload: Json | null
          tool_result: Json | null
        }
        Insert: {
          content: string
          convo_id?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          lang: string
          role: string
          slots?: Json | null
          tool_name?: string | null
          tool_payload?: Json | null
          tool_result?: Json | null
        }
        Update: {
          content?: string
          convo_id?: string | null
          created_at?: string | null
          id?: string
          intent?: string | null
          lang?: string
          role?: string
          slots?: Json | null
          tool_name?: string | null
          tool_payload?: Json | null
          tool_result?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_messages_convo_id_fkey"
            columns: ["convo_id"]
            isOneToOne: false
            referencedRelation: "cs_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_templates: {
        Row: {
          active: boolean | null
          body: string
          created_at: string | null
          id: string
          key: string
          lang: string
          tone: string | null
          updated_at: string | null
          variables: Json | null
        }
        Insert: {
          active?: boolean | null
          body: string
          created_at?: string | null
          id?: string
          key: string
          lang: string
          tone?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Update: {
          active?: boolean | null
          body?: string
          created_at?: string | null
          id?: string
          key?: string
          lang?: string
          tone?: string | null
          updated_at?: string | null
          variables?: Json | null
        }
        Relationships: []
      }
      cs_tickets: {
        Row: {
          assignee: string | null
          conversation_id: string | null
          created_at: string | null
          description: string | null
          id: string
          partner_id: string | null
          priority: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string | null
          summary: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          assignee?: string | null
          conversation_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          partner_id?: string | null
          priority?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          summary: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          assignee?: string | null
          conversation_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          partner_id?: string | null
          priority?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string | null
          summary?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cs_tickets_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "cs_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_tickets_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "my_partner_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cs_tickets_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      cs_translate_logs: {
        Row: {
          chars_in: number | null
          chars_out: number | null
          created_at: string | null
          formality: string | null
          id: string
          source_lang: string
          source_text: string
          target_lang: string
          tone: string | null
          translated_text: string
          user_id: string | null
        }
        Insert: {
          chars_in?: number | null
          chars_out?: number | null
          created_at?: string | null
          formality?: string | null
          id?: string
          source_lang: string
          source_text: string
          target_lang: string
          tone?: string | null
          translated_text: string
          user_id?: string | null
        }
        Update: {
          chars_in?: number | null
          chars_out?: number | null
          created_at?: string | null
          formality?: string | null
          id?: string
          source_lang?: string
          source_text?: string
          target_lang?: string
          tone?: string | null
          translated_text?: string
          user_id?: string | null
        }
        Relationships: []
      }
      customer_activity: {
        Row: {
          activity_date: string | null
          activity_type: string
          attachment_urls: string[] | null
          created_at: string | null
          customer_master_id: string
          description: string | null
          duration_minutes: number | null
          followup_completed: boolean | null
          followup_completed_at: string | null
          followup_due_date: string | null
          id: string
          metadata: Json | null
          performed_by_user_id: string | null
          priority: string | null
          related_contact_id: string | null
          requires_followup: boolean | null
          subject: string
          tags: string[] | null
          updated_at: string | null
        }
        Insert: {
          activity_date?: string | null
          activity_type: string
          attachment_urls?: string[] | null
          created_at?: string | null
          customer_master_id: string
          description?: string | null
          duration_minutes?: number | null
          followup_completed?: boolean | null
          followup_completed_at?: string | null
          followup_due_date?: string | null
          id?: string
          metadata?: Json | null
          performed_by_user_id?: string | null
          priority?: string | null
          related_contact_id?: string | null
          requires_followup?: boolean | null
          subject: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Update: {
          activity_date?: string | null
          activity_type?: string
          attachment_urls?: string[] | null
          created_at?: string | null
          customer_master_id?: string
          description?: string | null
          duration_minutes?: number | null
          followup_completed?: boolean | null
          followup_completed_at?: string | null
          followup_due_date?: string | null
          id?: string
          metadata?: Json | null
          performed_by_user_id?: string | null
          priority?: string | null
          related_contact_id?: string | null
          requires_followup?: boolean | null
          subject?: string
          tags?: string[] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_activity_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activity_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_activity_related_contact_id_fkey"
            columns: ["related_contact_id"]
            isOneToOne: false
            referencedRelation: "customer_contact"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contact: {
        Row: {
          birthday: string | null
          created_at: string | null
          customer_master_id: string
          department: string | null
          email: string | null
          fax: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          language: string | null
          metadata: Json | null
          mobile: string | null
          name: string
          note: string | null
          phone: string | null
          preferred_contact: string | null
          role: string
          timezone: string | null
          title: string | null
          updated_at: string | null
          work_hours: string | null
        }
        Insert: {
          birthday?: string | null
          created_at?: string | null
          customer_master_id: string
          department?: string | null
          email?: string | null
          fax?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          language?: string | null
          metadata?: Json | null
          mobile?: string | null
          name: string
          note?: string | null
          phone?: string | null
          preferred_contact?: string | null
          role: string
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          work_hours?: string | null
        }
        Update: {
          birthday?: string | null
          created_at?: string | null
          customer_master_id?: string
          department?: string | null
          email?: string | null
          fax?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          language?: string | null
          metadata?: Json | null
          mobile?: string | null
          name?: string
          note?: string | null
          phone?: string | null
          preferred_contact?: string | null
          role?: string
          timezone?: string | null
          title?: string | null
          updated_at?: string | null
          work_hours?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contact_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contact_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_contract: {
        Row: {
          auto_renewal: boolean | null
          billing_cycle: string | null
          contract_amount: number | null
          contract_end: string | null
          contract_file_name: string | null
          contract_file_url: string | null
          contract_name: string
          contract_no: string
          contract_start: string
          contract_type: string
          created_at: string | null
          currency: string | null
          customer_master_id: string
          id: string
          metadata: Json | null
          note: string | null
          parent_contract_id: string | null
          payment_method: string | null
          payment_terms: number | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          renewal_count: number | null
          renewal_notice_days: number | null
          replaced_by_contract_id: string | null
          signed_by_company: string | null
          signed_by_customer: string | null
          signed_date: string | null
          sla_accuracy_rate: number | null
          sla_inbound_processing: number | null
          sla_ontime_ship_rate: number | null
          sla_outbound_cutoff: string | null
          status: string
          termination_date: string | null
          termination_notice_date: string | null
          termination_reason: string | null
          updated_at: string | null
        }
        Insert: {
          auto_renewal?: boolean | null
          billing_cycle?: string | null
          contract_amount?: number | null
          contract_end?: string | null
          contract_file_name?: string | null
          contract_file_url?: string | null
          contract_name: string
          contract_no: string
          contract_start: string
          contract_type: string
          created_at?: string | null
          currency?: string | null
          customer_master_id: string
          id?: string
          metadata?: Json | null
          note?: string | null
          parent_contract_id?: string | null
          payment_method?: string | null
          payment_terms?: number | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          renewal_count?: number | null
          renewal_notice_days?: number | null
          replaced_by_contract_id?: string | null
          signed_by_company?: string | null
          signed_by_customer?: string | null
          signed_date?: string | null
          sla_accuracy_rate?: number | null
          sla_inbound_processing?: number | null
          sla_ontime_ship_rate?: number | null
          sla_outbound_cutoff?: string | null
          status?: string
          termination_date?: string | null
          termination_notice_date?: string | null
          termination_reason?: string | null
          updated_at?: string | null
        }
        Update: {
          auto_renewal?: boolean | null
          billing_cycle?: string | null
          contract_amount?: number | null
          contract_end?: string | null
          contract_file_name?: string | null
          contract_file_url?: string | null
          contract_name?: string
          contract_no?: string
          contract_start?: string
          contract_type?: string
          created_at?: string | null
          currency?: string | null
          customer_master_id?: string
          id?: string
          metadata?: Json | null
          note?: string | null
          parent_contract_id?: string | null
          payment_method?: string | null
          payment_terms?: number | null
          reminder_sent?: boolean | null
          reminder_sent_at?: string | null
          renewal_count?: number | null
          renewal_notice_days?: number | null
          replaced_by_contract_id?: string | null
          signed_by_company?: string | null
          signed_by_customer?: string | null
          signed_date?: string | null
          sla_accuracy_rate?: number | null
          sla_inbound_processing?: number | null
          sla_ontime_ship_rate?: number | null
          sla_outbound_cutoff?: string | null
          status?: string
          termination_date?: string | null
          termination_notice_date?: string | null
          termination_reason?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contract_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contract_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contract_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "customer_contract"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contract_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "v_active_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contract_replaced_by_contract_id_fkey"
            columns: ["replaced_by_contract_id"]
            isOneToOne: false
            referencedRelation: "customer_contract"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contract_replaced_by_contract_id_fkey"
            columns: ["replaced_by_contract_id"]
            isOneToOne: false
            referencedRelation: "v_active_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_master: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          billing_currency: string | null
          billing_cycle: string | null
          business_reg_no: string | null
          city: string | null
          code: string
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contract_end: string | null
          contract_start: string | null
          country_code: string | null
          created_at: string | null
          id: string
          metadata: Json | null
          name: string
          note: string | null
          org_id: string | null
          payment_terms: number | null
          postal_code: string | null
          status: string | null
          tenant_id: string
          type: string
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          billing_currency?: string | null
          billing_cycle?: string | null
          business_reg_no?: string | null
          city?: string | null
          code: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_end?: string | null
          contract_start?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          name: string
          note?: string | null
          org_id?: string | null
          payment_terms?: number | null
          postal_code?: string | null
          status?: string | null
          tenant_id: string
          type: string
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          billing_currency?: string | null
          billing_cycle?: string | null
          business_reg_no?: string | null
          city?: string | null
          code?: string
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contract_end?: string | null
          contract_start?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          note?: string | null
          org_id?: string | null
          payment_terms?: number | null
          postal_code?: string | null
          status?: string | null
          tenant_id?: string
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_master_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_pricing: {
        Row: {
          created_at: string | null
          currency: string | null
          customer_master_id: string
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          max_quantity: number | null
          metadata: Json | null
          min_quantity: number | null
          note: string | null
          org_id: string | null
          pricing_type: string
          requires_approval: boolean | null
          service_code: string | null
          service_name: string | null
          tenant_id: string
          unit: string
          unit_price: number
          updated_at: string | null
          volume_discount_rate: number | null
          volume_threshold: number | null
        }
        Insert: {
          created_at?: string | null
          currency?: string | null
          customer_master_id: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          max_quantity?: number | null
          metadata?: Json | null
          min_quantity?: number | null
          note?: string | null
          org_id?: string | null
          pricing_type: string
          requires_approval?: boolean | null
          service_code?: string | null
          service_name?: string | null
          tenant_id: string
          unit: string
          unit_price: number
          updated_at?: string | null
          volume_discount_rate?: number | null
          volume_threshold?: number | null
        }
        Update: {
          created_at?: string | null
          currency?: string | null
          customer_master_id?: string
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          max_quantity?: number | null
          metadata?: Json | null
          min_quantity?: number | null
          note?: string | null
          org_id?: string | null
          pricing_type?: string
          requires_approval?: boolean | null
          service_code?: string | null
          service_name?: string | null
          tenant_id?: string
          unit?: string
          unit_price?: number
          updated_at?: string | null
          volume_discount_rate?: number | null
          volume_threshold?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_pricing_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_pricing_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_pricing_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      customer_relationship: {
        Row: {
          child_customer_id: string
          created_at: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          metadata: Json | null
          note: string | null
          parent_customer_id: string
          relationship_strength: string | null
          relationship_type: string
          updated_at: string | null
        }
        Insert: {
          child_customer_id: string
          created_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          note?: string | null
          parent_customer_id: string
          relationship_strength?: string | null
          relationship_type: string
          updated_at?: string | null
        }
        Update: {
          child_customer_id?: string
          created_at?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          metadata?: Json | null
          note?: string | null
          parent_customer_id?: string
          relationship_strength?: string | null
          relationship_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_relationship_child_customer_id_fkey"
            columns: ["child_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_relationship_child_customer_id_fkey"
            columns: ["child_customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_relationship_parent_customer_id_fkey"
            columns: ["parent_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_relationship_parent_customer_id_fkey"
            columns: ["parent_customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_logs: {
        Row: {
          body_html: string | null
          body_text: string | null
          created_at: string
          error_message: string | null
          id: string
          inquiry_id: string
          inquiry_type: string
          metadata: Json | null
          recipient_email: string
          recipient_name: string | null
          sent_at: string | null
          sent_by: string | null
          status: string | null
          subject: string
          template_id: string | null
          trigger_event: string | null
        }
        Insert: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          inquiry_id: string
          inquiry_type: string
          metadata?: Json | null
          recipient_email: string
          recipient_name?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject: string
          template_id?: string | null
          trigger_event?: string | null
        }
        Update: {
          body_html?: string | null
          body_text?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          inquiry_id?: string
          inquiry_type?: string
          metadata?: Json | null
          recipient_email?: string
          recipient_name?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string | null
          subject?: string
          template_id?: string | null
          trigger_event?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_logs_sent_by_fkey"
            columns: ["sent_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_logs_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      email_templates: {
        Row: {
          body_html: string
          body_text: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          display_name: string
          id: string
          is_active: boolean | null
          name: string
          subject: string
          trigger_event: string | null
          trigger_status: string | null
          updated_at: string
          updated_by: string | null
          variables: Json | null
        }
        Insert: {
          body_html: string
          body_text?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name: string
          id?: string
          is_active?: boolean | null
          name: string
          subject: string
          trigger_event?: string | null
          trigger_status?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json | null
        }
        Update: {
          body_html?: string
          body_text?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          display_name?: string
          id?: string
          is_active?: boolean | null
          name?: string
          subject?: string
          trigger_event?: string | null
          trigger_status?: string | null
          updated_at?: string
          updated_by?: string | null
          variables?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "email_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "email_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      external_quote_inquiry: {
        Row: {
          assigned_to: string | null
          company_name: string
          contact_name: string
          converted_at: string | null
          converted_customer_id: string | null
          created_at: string
          email: string
          expected_revenue: number | null
          extra_services: string[]
          id: string
          lost_reason: string | null
          memo: string | null
          monthly_outbound_range: string
          owner_user_id: string | null
          phone: string | null
          product_categories: string[]
          quote_file_url: string | null
          quote_sent_at: string | null
          sales_stage: string | null
          sku_count: number | null
          source: string
          status: string
          updated_at: string | null
          win_probability: number | null
        }
        Insert: {
          assigned_to?: string | null
          company_name: string
          contact_name: string
          converted_at?: string | null
          converted_customer_id?: string | null
          created_at?: string
          email: string
          expected_revenue?: number | null
          extra_services?: string[]
          id?: string
          lost_reason?: string | null
          memo?: string | null
          monthly_outbound_range: string
          owner_user_id?: string | null
          phone?: string | null
          product_categories?: string[]
          quote_file_url?: string | null
          quote_sent_at?: string | null
          sales_stage?: string | null
          sku_count?: number | null
          source?: string
          status?: string
          updated_at?: string | null
          win_probability?: number | null
        }
        Update: {
          assigned_to?: string | null
          company_name?: string
          contact_name?: string
          converted_at?: string | null
          converted_customer_id?: string | null
          created_at?: string
          email?: string
          expected_revenue?: number | null
          extra_services?: string[]
          id?: string
          lost_reason?: string | null
          memo?: string | null
          monthly_outbound_range?: string
          owner_user_id?: string | null
          phone?: string | null
          product_categories?: string[]
          quote_file_url?: string | null
          quote_sent_at?: string | null
          sales_stage?: string | null
          sku_count?: number | null
          source?: string
          status?: string
          updated_at?: string | null
          win_probability?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "external_quote_inquiry_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_quote_inquiry_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_type: string
          id: string
          org_id: string
          payload: Json
          receipt_id: string
          tenant_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_type: string
          id?: string
          org_id: string
          payload?: Json
          receipt_id: string
          tenant_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_type?: string
          id?: string
          org_id?: string
          payload?: Json
          receipt_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_events_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_inspections: {
        Row: {
          condition: string | null
          created_at: string | null
          expected_qty: number
          id: string
          inbound_id: string | null
          inspector_id: string | null
          note: string | null
          org_id: string | null
          photos: string[] | null
          product_id: string | null
          received_qty: number
          rejected_qty: number | null
          tenant_id: string
        }
        Insert: {
          condition?: string | null
          created_at?: string | null
          expected_qty: number
          id?: string
          inbound_id?: string | null
          inspector_id?: string | null
          note?: string | null
          org_id?: string | null
          photos?: string[] | null
          product_id?: string | null
          received_qty: number
          rejected_qty?: number | null
          tenant_id: string
        }
        Update: {
          condition?: string | null
          created_at?: string | null
          expected_qty?: number
          id?: string
          inbound_id?: string | null
          inspector_id?: string | null
          note?: string | null
          org_id?: string | null
          photos?: string[] | null
          product_id?: string | null
          received_qty?: number
          rejected_qty?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inbound_inspections_org"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_inspections_inbound_id_fkey"
            columns: ["inbound_id"]
            isOneToOne: false
            referencedRelation: "inbounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_inspections_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_inventory_snapshots: {
        Row: {
          created_at: string
          id: string
          org_id: string
          product_id: string
          qty_after: number
          qty_before: number
          receipt_id: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          product_id: string
          qty_after?: number
          qty_before?: number
          receipt_id: string
          warehouse_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          product_id?: string
          qty_after?: number
          qty_before?: number
          receipt_id?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_inventory_snapshots_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_inventory_snapshots_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_issues: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          issue_type: string
          line_id: string | null
          org_id: string
          receipt_id: string
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          issue_type: string
          line_id?: string | null
          org_id: string
          receipt_id: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          issue_type?: string
          line_id?: string | null
          org_id?: string
          receipt_id?: string
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_issues_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipt_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_issues_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_photo_slots: {
        Row: {
          created_at: string
          id: string
          is_required: boolean
          min_photos: number
          org_id: string
          receipt_id: string
          slot_key: string
          sort_order: number
          tenant_id: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_required?: boolean
          min_photos?: number
          org_id: string
          receipt_id: string
          slot_key: string
          sort_order?: number
          tenant_id: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          is_required?: boolean
          min_photos?: number
          org_id?: string
          receipt_id?: string
          slot_key?: string
          sort_order?: number
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_photo_slots_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_photos: {
        Row: {
          file_size: number | null
          height: number | null
          id: string
          is_deleted: boolean
          line_id: string | null
          mime_type: string | null
          org_id: string
          photo_type: string | null
          receipt_id: string
          slot_id: string | null
          source: string | null
          step: number | null
          storage_bucket: string
          storage_path: string
          taken_at: string | null
          tenant_id: string
          uploaded_at: string
          uploaded_by: string | null
          width: number | null
        }
        Insert: {
          file_size?: number | null
          height?: number | null
          id?: string
          is_deleted?: boolean
          line_id?: string | null
          mime_type?: string | null
          org_id: string
          photo_type?: string | null
          receipt_id: string
          slot_id?: string | null
          source?: string | null
          step?: number | null
          storage_bucket?: string
          storage_path: string
          taken_at?: string | null
          tenant_id: string
          uploaded_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Update: {
          file_size?: number | null
          height?: number | null
          id?: string
          is_deleted?: boolean
          line_id?: string | null
          mime_type?: string | null
          org_id?: string
          photo_type?: string | null
          receipt_id?: string
          slot_id?: string | null
          source?: string | null
          step?: number | null
          storage_bucket?: string
          storage_path?: string
          taken_at?: string | null
          tenant_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_photos_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipt_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_photos_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_photos_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "inbound_photo_slots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_photos_slot_id_fkey"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "v_inbound_receipt_photo_progress"
            referencedColumns: ["slot_id"]
          },
        ]
      }
      inbound_plan_lines: {
        Row: {
          box_count: number | null
          created_at: string
          expected_qty: number
          expiry_date: string | null
          id: string
          line_notes: string | null
          lot_no: string | null
          mfg_date: string | null
          notes: string | null
          org_id: string
          pallet_text: string | null
          plan_id: string
          product_id: string
          tenant_id: string
          uom: string | null
        }
        Insert: {
          box_count?: number | null
          created_at?: string
          expected_qty: number
          expiry_date?: string | null
          id?: string
          line_notes?: string | null
          lot_no?: string | null
          mfg_date?: string | null
          notes?: string | null
          org_id: string
          pallet_text?: string | null
          plan_id: string
          product_id: string
          tenant_id: string
          uom?: string | null
        }
        Update: {
          box_count?: number | null
          created_at?: string
          expected_qty?: number
          expiry_date?: string | null
          id?: string
          line_notes?: string | null
          lot_no?: string | null
          mfg_date?: string | null
          notes?: string | null
          org_id?: string
          pallet_text?: string | null
          plan_id?: string
          product_id?: string
          tenant_id?: string
          uom?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_inbound_plan_lines_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_plan_lines_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "inbound_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_plans: {
        Row: {
          client_id: string
          created_at: string
          created_by: string | null
          id: string
          inbound_manager: string | null
          notes: string | null
          org_id: string
          plan_no: string
          planned_date: string
          status: string
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          client_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          inbound_manager?: string | null
          notes?: string | null
          org_id: string
          plan_no: string
          planned_date: string
          status?: string
          tenant_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          client_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          inbound_manager?: string | null
          notes?: string | null
          org_id?: string
          plan_no?: string
          planned_date?: string
          status?: string
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inbound_plans_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inbound_plans_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_receipt_lines: {
        Row: {
          accepted_qty: number
          created_at: string
          damaged_qty: number
          discrepancy_reason: string | null
          expected_qty: number
          expiry_date: string | null
          id: string
          inspected_at: string | null
          inspected_by: string | null
          lot_no: string | null
          missing_qty: number
          notes: string | null
          org_id: string
          other_qty: number
          over_qty: number
          plan_line_id: string | null
          product_id: string
          receipt_id: string
          received_qty: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          accepted_qty?: number
          created_at?: string
          damaged_qty?: number
          discrepancy_reason?: string | null
          expected_qty?: number
          expiry_date?: string | null
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          lot_no?: string | null
          missing_qty?: number
          notes?: string | null
          org_id: string
          other_qty?: number
          over_qty?: number
          plan_line_id?: string | null
          product_id: string
          receipt_id: string
          received_qty?: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          accepted_qty?: number
          created_at?: string
          damaged_qty?: number
          discrepancy_reason?: string | null
          expected_qty?: number
          expiry_date?: string | null
          id?: string
          inspected_at?: string | null
          inspected_by?: string | null
          lot_no?: string | null
          missing_qty?: number
          notes?: string | null
          org_id?: string
          other_qty?: number
          over_qty?: number
          plan_line_id?: string | null
          product_id?: string
          receipt_id?: string
          received_qty?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inbound_receipt_lines_product"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipt_lines_plan_line_id_fkey"
            columns: ["plan_line_id"]
            isOneToOne: false
            referencedRelation: "inbound_plan_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipt_lines_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_receipt_photo_requirements: {
        Row: {
          created_at: string
          id: string
          org_id: string
          receipt_id: string
          template_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          receipt_id: string
          template_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          receipt_id?: string
          template_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_receipt_photo_requirements_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: true
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipt_photo_requirements_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "photo_guide_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_receipt_shares: {
        Row: {
          content: Json
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          language_default: string
          last_accessed_at: string | null
          org_id: string | null
          password_hash: string | null
          password_salt: string | null
          receipt_id: string
          slug: string
          summary_en: string | null
          summary_ko: string | null
          summary_zh: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          content?: Json
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          language_default?: string
          last_accessed_at?: string | null
          org_id?: string | null
          password_hash?: string | null
          password_salt?: string | null
          receipt_id: string
          slug: string
          summary_en?: string | null
          summary_ko?: string | null
          summary_zh?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          content?: Json
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          language_default?: string
          last_accessed_at?: string | null
          org_id?: string | null
          password_hash?: string | null
          password_salt?: string | null
          receipt_id?: string
          slug?: string
          summary_en?: string | null
          summary_ko?: string | null
          summary_zh?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_receipt_shares_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_receipts: {
        Row: {
          arrived_at: string | null
          carrier_name: string | null
          client_id: string
          confirmed_at: string | null
          confirmed_by: string | null
          created_at: string
          created_by: string | null
          dock_name: string | null
          id: string
          notes: string | null
          org_id: string
          plan_id: string | null
          receipt_no: string
          status: string
          tenant_id: string
          total_box_count: number | null
          tracking_no: string | null
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          arrived_at?: string | null
          carrier_name?: string | null
          client_id: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          dock_name?: string | null
          id?: string
          notes?: string | null
          org_id: string
          plan_id?: string | null
          receipt_no: string
          status?: string
          tenant_id: string
          total_box_count?: number | null
          tracking_no?: string | null
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          arrived_at?: string | null
          carrier_name?: string | null
          client_id?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          created_at?: string
          created_by?: string | null
          dock_name?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          plan_id?: string | null
          receipt_no?: string
          status?: string
          tenant_id?: string
          total_box_count?: number | null
          tracking_no?: string | null
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_inbound_receipts_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inbound_receipts_client"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inbound_receipts_org"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_inbound_receipts_warehouse"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_receipts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "inbound_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_shipment: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by_user_id: string | null
          eta: string | null
          id: string
          note: string | null
          owner_brand_id: string
          received_at: string | null
          received_by_user_id: string | null
          ref_no: string | null
          status: string
          supplier_customer_id: string | null
          type: string
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          eta?: string | null
          id?: string
          note?: string | null
          owner_brand_id: string
          received_at?: string | null
          received_by_user_id?: string | null
          ref_no?: string | null
          status: string
          supplier_customer_id?: string | null
          type: string
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          eta?: string | null
          id?: string
          note?: string | null
          owner_brand_id?: string
          received_at?: string | null
          received_by_user_id?: string | null
          ref_no?: string | null
          status?: string
          supplier_customer_id?: string | null
          type?: string
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_shipment_owner_brand_id_fkey"
            columns: ["owner_brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_shipment_supplier_customer_id_fkey"
            columns: ["supplier_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_shipment_supplier_customer_id_fkey"
            columns: ["supplier_customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_shipment_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      inbound_shipment_line: {
        Row: {
          expiry_date: string | null
          id: string
          inbound_shipment_id: string
          line_no: number | null
          lot_no: string | null
          note: string | null
          product_id: string
          qty_damaged: number
          qty_expected: number
          qty_received: number
          uom_code: string
        }
        Insert: {
          expiry_date?: string | null
          id?: string
          inbound_shipment_id: string
          line_no?: number | null
          lot_no?: string | null
          note?: string | null
          product_id: string
          qty_damaged?: number
          qty_expected: number
          qty_received?: number
          uom_code?: string
        }
        Update: {
          expiry_date?: string | null
          id?: string
          inbound_shipment_id?: string
          line_no?: number | null
          lot_no?: string | null
          note?: string | null
          product_id?: string
          qty_damaged?: number
          qty_expected?: number
          qty_received?: number
          uom_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "inbound_shipment_line_inbound_shipment_id_fkey"
            columns: ["inbound_shipment_id"]
            isOneToOne: false
            referencedRelation: "inbound_shipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbound_shipment_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inbounds: {
        Row: {
          actual_arrival_date: string | null
          carrier: string | null
          created_at: string | null
          expected_arrival_date: string | null
          id: string
          inbound_date: string
          inspection_status: string | null
          note: string | null
          photos: string[] | null
          product_id: string | null
          product_name: string
          quantity: number
          received_quantity: number | null
          rejection_reason: string | null
          status: string
          supplier_id: string | null
          supplier_name: string
          total_price: number
          tracking_no: string | null
          unit: string
          unit_price: number
        }
        Insert: {
          actual_arrival_date?: string | null
          carrier?: string | null
          created_at?: string | null
          expected_arrival_date?: string | null
          id?: string
          inbound_date: string
          inspection_status?: string | null
          note?: string | null
          photos?: string[] | null
          product_id?: string | null
          product_name: string
          quantity: number
          received_quantity?: number | null
          rejection_reason?: string | null
          status: string
          supplier_id?: string | null
          supplier_name: string
          total_price: number
          tracking_no?: string | null
          unit: string
          unit_price: number
        }
        Update: {
          actual_arrival_date?: string | null
          carrier?: string | null
          created_at?: string | null
          expected_arrival_date?: string | null
          id?: string
          inbound_date?: string
          inspection_status?: string | null
          note?: string | null
          photos?: string[] | null
          product_id?: string | null
          product_name?: string
          quantity?: number
          received_quantity?: number | null
          rejection_reason?: string | null
          status?: string
          supplier_id?: string | null
          supplier_name?: string
          total_price?: number
          tracking_no?: string | null
          unit?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "inbounds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbounds_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "my_partner_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inbounds_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_action_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string | null
          created_at: string
          details: Json | null
          id: string
          inquiry_id: string
          inquiry_type: string
          ip_address: string | null
          new_value: string | null
          old_value: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          inquiry_id: string
          inquiry_type: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string | null
          created_at?: string
          details?: Json | null
          id?: string
          inquiry_id?: string
          inquiry_type?: string
          ip_address?: string | null
          new_value?: string | null
          old_value?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_action_logs_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiry_notes: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          inquiry_id: string
          inquiry_type: string
          note: string
          updated_at: string | null
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          inquiry_id: string
          inquiry_type: string
          note: string
          updated_at?: string | null
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          inquiry_id?: string
          inquiry_type?: string
          note?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inquiry_notes_admin_id_fkey"
            columns: ["admin_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          created_at: string | null
          expiry_date: string | null
          id: string
          location_id: string | null
          lot_no: string | null
          manufactured_date: string | null
          owner_brand_id: string
          product_id: string
          qty_allocated: number
          qty_available: number | null
          qty_on_hand: number
          status: string | null
          uom_code: string
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          location_id?: string | null
          lot_no?: string | null
          manufactured_date?: string | null
          owner_brand_id: string
          product_id: string
          qty_allocated?: number
          qty_available?: number | null
          qty_on_hand?: number
          status?: string | null
          uom_code?: string
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          expiry_date?: string | null
          id?: string
          location_id?: string | null
          lot_no?: string | null
          manufactured_date?: string | null
          owner_brand_id?: string
          product_id?: string
          qty_allocated?: number
          qty_available?: number | null
          qty_on_hand?: number
          status?: string | null
          uom_code?: string
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_owner_brand_id_fkey"
            columns: ["owner_brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_import_runs: {
        Row: {
          created_at: string
          dry_run: boolean
          error_message: string | null
          id: string
          imported_count: number
          metadata: Json
          requested_by: string | null
          requested_limit: number
          selected_count: number
          skipped_count: number
          source_file_name: string | null
          status: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          dry_run?: boolean
          error_message?: string | null
          id?: string
          imported_count?: number
          metadata?: Json
          requested_by?: string | null
          requested_limit?: number
          selected_count?: number
          skipped_count?: number
          source_file_name?: string | null
          status?: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          dry_run?: boolean
          error_message?: string | null
          id?: string
          imported_count?: number
          metadata?: Json
          requested_by?: string | null
          requested_limit?: number
          selected_count?: number
          skipped_count?: number
          source_file_name?: string | null
          status?: string
          tenant_id?: string
        }
        Relationships: []
      }
      inventory_ledger: {
        Row: {
          balance_after: number | null
          created_at: string
          created_by: string | null
          direction: string | null
          id: string
          idempotency_key: string | null
          memo: string | null
          movement_type: string | null
          notes: string | null
          org_id: string
          product_id: string
          qty_change: number
          quantity: number | null
          reference_id: string | null
          reference_type: string | null
          source_hash: string | null
          tenant_id: string
          transaction_type: string
          warehouse_id: string
        }
        Insert: {
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          direction?: string | null
          id?: string
          idempotency_key?: string | null
          memo?: string | null
          movement_type?: string | null
          notes?: string | null
          org_id: string
          product_id: string
          qty_change: number
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          source_hash?: string | null
          tenant_id: string
          transaction_type: string
          warehouse_id: string
        }
        Update: {
          balance_after?: number | null
          created_at?: string
          created_by?: string | null
          direction?: string | null
          id?: string
          idempotency_key?: string | null
          memo?: string | null
          movement_type?: string | null
          notes?: string | null
          org_id?: string
          product_id?: string
          qty_change?: number
          quantity?: number | null
          reference_id?: string | null
          reference_type?: string | null
          source_hash?: string | null
          tenant_id?: string
          transaction_type?: string
          warehouse_id?: string
        }
        Relationships: []
      }
      inventory_quantities: {
        Row: {
          id: string
          org_id: string
          product_id: string
          qty_allocated: number
          qty_available: number
          qty_on_hand: number
          tenant_id: string
          updated_at: string
          warehouse_id: string
        }
        Insert: {
          id?: string
          org_id: string
          product_id: string
          qty_allocated?: number
          qty_available?: number
          qty_on_hand?: number
          tenant_id: string
          updated_at?: string
          warehouse_id: string
        }
        Update: {
          id?: string
          org_id?: string
          product_id?: string
          qty_allocated?: number
          qty_available?: number
          qty_on_hand?: number
          tenant_id?: string
          updated_at?: string
          warehouse_id?: string
        }
        Relationships: []
      }
      inventory_snapshot: {
        Row: {
          closing_stock: number
          created_at: string
          product_id: string
          snapshot_date: string
          tenant_id: string
          updated_at: string
        }
        Insert: {
          closing_stock?: number
          created_at?: string
          product_id: string
          snapshot_date: string
          tenant_id: string
          updated_at?: string
        }
        Update: {
          closing_stock?: number
          created_at?: string
          product_id?: string
          snapshot_date?: string
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_snapshot_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_transaction: {
        Row: {
          created_at: string | null
          from_location_id: string | null
          id: string
          location_id: string | null
          lot_no: string | null
          note: string | null
          owner_brand_id: string | null
          performed_at: string | null
          performed_by_user_id: string | null
          product_id: string
          qty: number
          ref_id: string | null
          ref_type: string | null
          to_location_id: string | null
          transaction_type: string
          uom_code: string
          warehouse_id: string
        }
        Insert: {
          created_at?: string | null
          from_location_id?: string | null
          id?: string
          location_id?: string | null
          lot_no?: string | null
          note?: string | null
          owner_brand_id?: string | null
          performed_at?: string | null
          performed_by_user_id?: string | null
          product_id: string
          qty: number
          ref_id?: string | null
          ref_type?: string | null
          to_location_id?: string | null
          transaction_type: string
          uom_code?: string
          warehouse_id: string
        }
        Update: {
          created_at?: string | null
          from_location_id?: string | null
          id?: string
          location_id?: string | null
          lot_no?: string | null
          note?: string | null
          owner_brand_id?: string | null
          performed_at?: string | null
          performed_by_user_id?: string | null
          product_id?: string
          qty?: number
          ref_id?: string | null
          ref_type?: string | null
          to_location_id?: string | null
          transaction_type?: string
          uom_code?: string
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_transaction_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transaction_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transaction_owner_brand_id_fkey"
            columns: ["owner_brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transaction_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transaction_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_transaction_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_volume_raw: {
        Row: {
          closing_stock_raw: string | null
          created_at: string
          customer_id: string
          header_order: string[]
          id: string
          item_name: string | null
          opening_stock_raw: string | null
          raw_data: Json
          record_date: string | null
          row_no: number
          sheet_name: string
          source_file: string | null
          uploaded_by: string | null
        }
        Insert: {
          closing_stock_raw?: string | null
          created_at?: string
          customer_id: string
          header_order?: string[]
          id?: string
          item_name?: string | null
          opening_stock_raw?: string | null
          raw_data?: Json
          record_date?: string | null
          row_no: number
          sheet_name: string
          source_file?: string | null
          uploaded_by?: string | null
        }
        Update: {
          closing_stock_raw?: string | null
          created_at?: string
          customer_id?: string
          header_order?: string[]
          id?: string
          item_name?: string | null
          opening_stock_raw?: string | null
          raw_data?: Json
          record_date?: string | null
          row_no?: number
          sheet_name?: string
          source_file?: string | null
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "inventory_volume_raw_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_volume_raw_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_volume_share: {
        Row: {
          created_at: string
          created_by: string | null
          customer_id: string
          date_from: string | null
          date_to: string | null
          expires_at: string | null
          id: string
          password_hash: string | null
          password_salt: string | null
          slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_id: string
          date_from?: string | null
          date_to?: string | null
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          password_salt?: string | null
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_id?: string
          date_from?: string | null
          date_to?: string | null
          expires_at?: string | null
          id?: string
          password_hash?: string | null
          password_salt?: string | null
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_volume_share_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_volume_share_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      location: {
        Row: {
          aisle: string | null
          bin: string | null
          capacity_unit: string | null
          code: string
          created_at: string | null
          id: string
          is_bulk: boolean | null
          is_pickable: boolean | null
          max_capacity: number | null
          rack: string | null
          shelf: string | null
          status: string | null
          temperature_zone: string | null
          type: string
          updated_at: string | null
          warehouse_id: string
          zone: string | null
        }
        Insert: {
          aisle?: string | null
          bin?: string | null
          capacity_unit?: string | null
          code: string
          created_at?: string | null
          id?: string
          is_bulk?: boolean | null
          is_pickable?: boolean | null
          max_capacity?: number | null
          rack?: string | null
          shelf?: string | null
          status?: string | null
          temperature_zone?: string | null
          type: string
          updated_at?: string | null
          warehouse_id: string
          zone?: string | null
        }
        Update: {
          aisle?: string | null
          bin?: string | null
          capacity_unit?: string | null
          code?: string
          created_at?: string | null
          id?: string
          is_bulk?: boolean | null
          is_pickable?: boolean | null
          max_capacity?: number | null
          rack?: string | null
          shelf?: string | null
          status?: string | null
          temperature_zone?: string | null
          type?: string
          updated_at?: string | null
          warehouse_id?: string
          zone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "location_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      logistics_api_logs: {
        Row: {
          adapter: string | null
          body: Json | null
          created_at: string | null
          direction: string | null
          headers: Json | null
          http_code: number | null
          id: string
          order_id: string | null
          status: string | null
        }
        Insert: {
          adapter?: string | null
          body?: Json | null
          created_at?: string | null
          direction?: string | null
          headers?: Json | null
          http_code?: number | null
          id?: string
          order_id?: string | null
          status?: string | null
        }
        Update: {
          adapter?: string | null
          body?: Json | null
          created_at?: string | null
          direction?: string | null
          headers?: Json | null
          http_code?: number | null
          id?: string
          order_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "logistics_api_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      my_tasks: {
        Row: {
          attachments: string[] | null
          barcode: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          location: string | null
          note: string | null
          priority: string
          product_name: string
          qr_code: string | null
          quantity: number
          status: string
          title: string
          type: string
          unit: string
          work_order_id: string | null
        }
        Insert: {
          attachments?: string[] | null
          barcode?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          location?: string | null
          note?: string | null
          priority: string
          product_name: string
          qr_code?: string | null
          quantity: number
          status: string
          title: string
          type: string
          unit: string
          work_order_id?: string | null
        }
        Update: {
          attachments?: string[] | null
          barcode?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          location?: string | null
          note?: string | null
          priority?: string
          product_name?: string
          qr_code?: string | null
          quantity?: number
          status?: string
          title?: string
          type?: string
          unit?: string
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "my_tasks_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_rules: {
        Row: {
          cooldown_minutes: number | null
          created_at: string
          created_by: string | null
          description: string | null
          email_template_id: string | null
          id: string
          is_active: boolean | null
          name: string
          notify_roles: string[] | null
          notify_type: string
          notify_users: string[] | null
          send_email: boolean | null
          send_notification: boolean | null
          send_slack: boolean | null
          trigger_condition: Json | null
          trigger_event: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cooldown_minutes?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_template_id?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          notify_roles?: string[] | null
          notify_type: string
          notify_users?: string[] | null
          send_email?: boolean | null
          send_notification?: boolean | null
          send_slack?: boolean | null
          trigger_condition?: Json | null
          trigger_event: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cooldown_minutes?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          email_template_id?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          notify_roles?: string[] | null
          notify_type?: string
          notify_users?: string[] | null
          send_email?: boolean | null
          send_notification?: boolean | null
          send_slack?: boolean | null
          trigger_condition?: Json | null
          trigger_event?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_email_template_id_fkey"
            columns: ["email_template_id"]
            isOneToOne: false
            referencedRelation: "email_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          action: string | null
          created_at: string
          id: string
          inquiry_id: string | null
          inquiry_type: string | null
          is_read: boolean | null
          link_url: string | null
          message: string
          metadata: Json | null
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action?: string | null
          created_at?: string
          id?: string
          inquiry_id?: string | null
          inquiry_type?: string | null
          is_read?: boolean | null
          link_url?: string | null
          message: string
          metadata?: Json | null
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          action?: string | null
          created_at?: string
          id?: string
          inquiry_id?: string | null
          inquiry_type?: string | null
          is_read?: boolean | null
          link_url?: string | null
          message?: string
          metadata?: Json | null
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_receivers: {
        Row: {
          address1: string | null
          address2: string | null
          country_code: string | null
          created_at: string | null
          id: string
          locality: string | null
          meta: Json | null
          name: string
          order_id: string | null
          phone: string | null
          zip: string | null
        }
        Insert: {
          address1?: string | null
          address2?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          locality?: string | null
          meta?: Json | null
          name: string
          order_id?: string | null
          phone?: string | null
          zip?: string | null
        }
        Update: {
          address1?: string | null
          address2?: string | null
          country_code?: string | null
          created_at?: string | null
          id?: string
          locality?: string | null
          meta?: Json | null
          name?: string
          order_id?: string | null
          phone?: string | null
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_receivers_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_senders: {
        Row: {
          address: string | null
          address_detail: string | null
          created_at: string | null
          id: string
          is_default: boolean | null
          name: string
          phone: string | null
          zip: string | null
        }
        Insert: {
          address?: string | null
          address_detail?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          phone?: string | null
          zip?: string | null
        }
        Update: {
          address?: string | null
          address_detail?: string | null
          created_at?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          phone?: string | null
          zip?: string | null
        }
        Relationships: []
      }
      order_status_history: {
        Row: {
          changed_by: string | null
          created_at: string | null
          from_status: string | null
          id: string
          order_id: string | null
          reason: string | null
          to_status: string
        }
        Insert: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          order_id?: string | null
          reason?: string | null
          to_status: string
        }
        Update: {
          changed_by?: string | null
          created_at?: string | null
          from_status?: string | null
          id?: string
          order_id?: string | null
          reason?: string | null
          to_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_status_history_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          cancelled_at: string | null
          cancelled_by: string | null
          cancelled_reason: string | null
          country_code: string | null
          created_at: string | null
          hold_reason: string | null
          id: string
          logistics_company: string | null
          on_hold: boolean | null
          order_no: string
          partner_id: string | null
          product_name: string | null
          remark: string | null
          status: string | null
          tracking_no: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          country_code?: string | null
          created_at?: string | null
          hold_reason?: string | null
          id?: string
          logistics_company?: string | null
          on_hold?: boolean | null
          order_no: string
          partner_id?: string | null
          product_name?: string | null
          remark?: string | null
          status?: string | null
          tracking_no?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          cancelled_at?: string | null
          cancelled_by?: string | null
          cancelled_reason?: string | null
          country_code?: string | null
          created_at?: string | null
          hold_reason?: string | null
          id?: string
          logistics_company?: string | null
          on_hold?: boolean | null
          order_no?: string
          partner_id?: string | null
          product_name?: string | null
          remark?: string | null
          status?: string | null
          tracking_no?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "my_partner_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      org: {
        Row: {
          code: string | null
          created_at: string | null
          id: string
          name: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string | null
          id?: string
          name: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string | null
          id?: string
          name?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      outbound_order_line: {
        Row: {
          id: string
          line_no: number | null
          lot_no: string | null
          note: string | null
          outbound_id: string
          product_id: string
          qty_allocated: number
          qty_ordered: number
          qty_packed: number
          qty_picked: number
          qty_shipped: number
          uom_code: string
        }
        Insert: {
          id?: string
          line_no?: number | null
          lot_no?: string | null
          note?: string | null
          outbound_id: string
          product_id: string
          qty_allocated?: number
          qty_ordered: number
          qty_packed?: number
          qty_picked?: number
          qty_shipped?: number
          uom_code?: string
        }
        Update: {
          id?: string
          line_no?: number | null
          lot_no?: string | null
          note?: string | null
          outbound_id?: string
          product_id?: string
          qty_allocated?: number
          qty_ordered?: number
          qty_packed?: number
          qty_picked?: number
          qty_shipped?: number
          uom_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "outbound_order_line_outbound_id_fkey"
            columns: ["outbound_id"]
            isOneToOne: false
            referencedRelation: "outbounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbound_order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      outbounds: {
        Row: {
          brand_id: string | null
          carrier_code: string | null
          channel_order_no: string | null
          client_order_no: string | null
          created_at: string | null
          customer_id: string | null
          customer_name: string
          id: string
          note: string | null
          order_type: string | null
          outbound_date: string
          product_id: string | null
          product_name: string
          quantity: number
          requested_ship_at: string | null
          shipped_at: string | null
          status: string
          store_id: string | null
          total_price: number
          tracking_no: string | null
          unit: string
          unit_price: number
          warehouse_id: string | null
        }
        Insert: {
          brand_id?: string | null
          carrier_code?: string | null
          channel_order_no?: string | null
          client_order_no?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name: string
          id?: string
          note?: string | null
          order_type?: string | null
          outbound_date: string
          product_id?: string | null
          product_name: string
          quantity: number
          requested_ship_at?: string | null
          shipped_at?: string | null
          status: string
          store_id?: string | null
          total_price: number
          tracking_no?: string | null
          unit: string
          unit_price: number
          warehouse_id?: string | null
        }
        Update: {
          brand_id?: string | null
          carrier_code?: string | null
          channel_order_no?: string | null
          client_order_no?: string | null
          created_at?: string | null
          customer_id?: string | null
          customer_name?: string
          id?: string
          note?: string | null
          order_type?: string | null
          outbound_date?: string
          product_id?: string | null
          product_name?: string
          quantity?: number
          requested_ship_at?: string | null
          shipped_at?: string | null
          status?: string
          store_id?: string | null
          total_price?: number
          tracking_no?: string | null
          unit?: string
          unit_price?: number
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outbounds_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbounds_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "my_partner_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbounds_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbounds_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbounds_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "outbounds_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_job: {
        Row: {
          completed_at: string | null
          created_at: string | null
          created_by_user_id: string | null
          from_location_id: string | null
          id: string
          kit_product_id: string
          note: string | null
          owner_brand_id: string
          qty_kit_completed: number
          qty_kit_planned: number
          started_at: string | null
          status: string
          to_location_id: string | null
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          from_location_id?: string | null
          id?: string
          kit_product_id: string
          note?: string | null
          owner_brand_id: string
          qty_kit_completed?: number
          qty_kit_planned: number
          started_at?: string | null
          status: string
          to_location_id?: string | null
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          from_location_id?: string | null
          id?: string
          kit_product_id?: string
          note?: string | null
          owner_brand_id?: string
          qty_kit_completed?: number
          qty_kit_planned?: number
          started_at?: string | null
          status?: string
          to_location_id?: string | null
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_job_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_job_kit_product_id_fkey"
            columns: ["kit_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_job_owner_brand_id_fkey"
            columns: ["owner_brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_job_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "location"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_job_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      pack_job_component: {
        Row: {
          component_product_id: string
          id: string
          line_no: number | null
          pack_job_id: string
          qty_consumed: number
          qty_required: number
          uom_code: string
        }
        Insert: {
          component_product_id: string
          id?: string
          line_no?: number | null
          pack_job_id: string
          qty_consumed?: number
          qty_required: number
          uom_code?: string
        }
        Update: {
          component_product_id?: string
          id?: string
          line_no?: number | null
          pack_job_id?: string
          qty_consumed?: number
          qty_required?: number
          uom_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "pack_job_component_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pack_job_component_pack_job_id_fkey"
            columns: ["pack_job_id"]
            isOneToOne: false
            referencedRelation: "pack_job"
            referencedColumns: ["id"]
          },
        ]
      }
      parcel_shipment: {
        Row: {
          anh_commission: number | null
          anh_commission_rate: number | null
          billed_at: string | null
          billing_status: string | null
          box_count: number | null
          brand_id: string | null
          created_at: string | null
          delivered_at: string | null
          dest_city: string | null
          dest_country_code: string | null
          dest_postal_code: string | null
          fee_base: number | null
          fee_currency: string | null
          fee_extra: number | null
          fee_fuel: number | null
          fee_remote: number | null
          fee_total: number | null
          id: string
          invoice_no: string | null
          outbound_id: string | null
          paid_at: string | null
          ship_date: string
          shipping_account_id: string
          source_type: string
          status: string | null
          store_id: string | null
          tracking_no: string
          updated_at: string | null
          volume_m3: number | null
          warehouse_id: string | null
          waybill_no: string | null
          weight_kg: number | null
        }
        Insert: {
          anh_commission?: number | null
          anh_commission_rate?: number | null
          billed_at?: string | null
          billing_status?: string | null
          box_count?: number | null
          brand_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          dest_city?: string | null
          dest_country_code?: string | null
          dest_postal_code?: string | null
          fee_base?: number | null
          fee_currency?: string | null
          fee_extra?: number | null
          fee_fuel?: number | null
          fee_remote?: number | null
          fee_total?: number | null
          id?: string
          invoice_no?: string | null
          outbound_id?: string | null
          paid_at?: string | null
          ship_date: string
          shipping_account_id: string
          source_type: string
          status?: string | null
          store_id?: string | null
          tracking_no: string
          updated_at?: string | null
          volume_m3?: number | null
          warehouse_id?: string | null
          waybill_no?: string | null
          weight_kg?: number | null
        }
        Update: {
          anh_commission?: number | null
          anh_commission_rate?: number | null
          billed_at?: string | null
          billing_status?: string | null
          box_count?: number | null
          brand_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          dest_city?: string | null
          dest_country_code?: string | null
          dest_postal_code?: string | null
          fee_base?: number | null
          fee_currency?: string | null
          fee_extra?: number | null
          fee_fuel?: number | null
          fee_remote?: number | null
          fee_total?: number | null
          id?: string
          invoice_no?: string | null
          outbound_id?: string | null
          paid_at?: string | null
          ship_date?: string
          shipping_account_id?: string
          source_type?: string
          status?: string | null
          store_id?: string | null
          tracking_no?: string
          updated_at?: string | null
          volume_m3?: number | null
          warehouse_id?: string | null
          waybill_no?: string | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "parcel_shipment_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_shipment_outbound_id_fkey"
            columns: ["outbound_id"]
            isOneToOne: false
            referencedRelation: "outbounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_shipment_shipping_account_id_fkey"
            columns: ["shipping_account_id"]
            isOneToOne: false
            referencedRelation: "shipping_account"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_shipment_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parcel_shipment_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          address: string
          code: string | null
          contact: string
          created_at: string | null
          email: string
          id: string
          locale: string | null
          name: string
          note: string | null
          phone: string
          timezone: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          address: string
          code?: string | null
          contact: string
          created_at?: string | null
          email: string
          id?: string
          locale?: string | null
          name: string
          note?: string | null
          phone: string
          timezone?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          address?: string
          code?: string | null
          contact?: string
          created_at?: string | null
          email?: string
          id?: string
          locale?: string | null
          name?: string
          note?: string | null
          phone?: string
          timezone?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      photo_guide_slots: {
        Row: {
          description: string | null
          id: string
          is_required: boolean
          min_photos: number
          org_id: string
          slot_key: string
          sort_order: number
          template_id: string
          tenant_id: string
          title: string
        }
        Insert: {
          description?: string | null
          id?: string
          is_required?: boolean
          min_photos?: number
          org_id: string
          slot_key: string
          sort_order?: number
          template_id: string
          tenant_id: string
          title: string
        }
        Update: {
          description?: string | null
          id?: string
          is_required?: boolean
          min_photos?: number
          org_id?: string
          slot_key?: string
          sort_order?: number
          template_id?: string
          tenant_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "photo_guide_slots_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "photo_guide_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      photo_guide_templates: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          name: string
          org_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          org_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          org_id?: string
          tenant_id?: string
        }
        Relationships: []
      }
      product_barcodes: {
        Row: {
          barcode: string
          barcode_type: string
          created_at: string
          id: string
          is_primary: boolean
          org_id: string
          product_id: string
          tenant_id: string
        }
        Insert: {
          barcode: string
          barcode_type: string
          created_at?: string
          id?: string
          is_primary?: boolean
          org_id: string
          product_id: string
          tenant_id: string
        }
        Update: {
          barcode?: string
          barcode_type?: string
          created_at?: string
          id?: string
          is_primary?: boolean
          org_id?: string
          product_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_barcodes_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_bom: {
        Row: {
          component_product_id: string
          component_qty_in_base_uom: number
          created_at: string | null
          id: string
          is_optional: boolean | null
          kit_product_id: string
          seq_no: number | null
          updated_at: string | null
        }
        Insert: {
          component_product_id: string
          component_qty_in_base_uom: number
          created_at?: string | null
          id?: string
          is_optional?: boolean | null
          kit_product_id: string
          seq_no?: number | null
          updated_at?: string | null
        }
        Update: {
          component_product_id?: string
          component_qty_in_base_uom?: number
          created_at?: string | null
          id?: string
          is_optional?: boolean | null
          kit_product_id?: string
          seq_no?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_bom_component_product_id_fkey"
            columns: ["component_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_bom_kit_product_id_fkey"
            columns: ["kit_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_categories: {
        Row: {
          code: string
          created_at: string | null
          name_en: string
          name_ko: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          name_en: string
          name_ko: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          name_en?: string
          name_ko?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      product_uom: {
        Row: {
          barcode: string | null
          created_at: string | null
          height_cm: number | null
          id: string
          is_base_uom: boolean | null
          is_orderable: boolean | null
          is_sellable: boolean | null
          length_cm: number | null
          product_id: string
          qty_in_base_uom: number
          uom_code: string
          uom_name: string | null
          updated_at: string | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          barcode?: string | null
          created_at?: string | null
          height_cm?: number | null
          id?: string
          is_base_uom?: boolean | null
          is_orderable?: boolean | null
          is_sellable?: boolean | null
          length_cm?: number | null
          product_id: string
          qty_in_base_uom: number
          uom_code: string
          uom_name?: string | null
          updated_at?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          barcode?: string | null
          created_at?: string | null
          height_cm?: number | null
          id?: string
          is_base_uom?: boolean | null
          is_orderable?: boolean | null
          is_sellable?: boolean | null
          length_cm?: number | null
          product_id?: string
          qty_in_base_uom?: number
          uom_code?: string
          uom_name?: string | null
          updated_at?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_uom_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          barcode: string | null
          brand_id: string | null
          category: string
          cost_price: number | null
          created_at: string | null
          customer_id: string | null
          description: string | null
          expiry_date: string | null
          height_cm: number | null
          hs_code: string | null
          id: string
          length_cm: number | null
          location: string | null
          manage_name: string | null
          manufacture_date: string | null
          min_stock: number
          name: string
          option_color: string | null
          option_etc: string | null
          option_lot: string | null
          option_size: string | null
          partner_id: string | null
          price: number
          product_db_no: string | null
          product_type: string | null
          quantity: number
          sku: string
          status: string | null
          unit: string
          updated_at: string | null
          user_code: string | null
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          barcode?: string | null
          brand_id?: string | null
          category: string
          cost_price?: number | null
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          expiry_date?: string | null
          height_cm?: number | null
          hs_code?: string | null
          id?: string
          length_cm?: number | null
          location?: string | null
          manage_name?: string | null
          manufacture_date?: string | null
          min_stock?: number
          name: string
          option_color?: string | null
          option_etc?: string | null
          option_lot?: string | null
          option_size?: string | null
          partner_id?: string | null
          price?: number
          product_db_no?: string | null
          product_type?: string | null
          quantity?: number
          sku: string
          status?: string | null
          unit?: string
          updated_at?: string | null
          user_code?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          barcode?: string | null
          brand_id?: string | null
          category?: string
          cost_price?: number | null
          created_at?: string | null
          customer_id?: string | null
          description?: string | null
          expiry_date?: string | null
          height_cm?: number | null
          hs_code?: string | null
          id?: string
          length_cm?: number | null
          location?: string | null
          manage_name?: string | null
          manufacture_date?: string | null
          min_stock?: number
          name?: string
          option_color?: string | null
          option_etc?: string | null
          option_lot?: string | null
          option_size?: string | null
          partner_id?: string | null
          price?: number
          product_db_no?: string | null
          product_type?: string | null
          quantity?: number
          sku?: string
          status?: string | null
          unit?: string
          updated_at?: string | null
          user_code?: string | null
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "my_partner_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_calculations: {
        Row: {
          calculated_by: string | null
          calculation_data: Json
          created_at: string
          discount: number | null
          id: string
          inquiry_id: string
          inquiry_type: string
          is_sent: boolean | null
          metadata: Json | null
          notes: string | null
          pricing_rule_id: string | null
          sent_at: string | null
          subtotal: number
          total: number
        }
        Insert: {
          calculated_by?: string | null
          calculation_data: Json
          created_at?: string
          discount?: number | null
          id?: string
          inquiry_id: string
          inquiry_type: string
          is_sent?: boolean | null
          metadata?: Json | null
          notes?: string | null
          pricing_rule_id?: string | null
          sent_at?: string | null
          subtotal: number
          total: number
        }
        Update: {
          calculated_by?: string | null
          calculation_data?: Json
          created_at?: string
          discount?: number | null
          id?: string
          inquiry_id?: string
          inquiry_type?: string
          is_sent?: boolean | null
          metadata?: Json | null
          notes?: string | null
          pricing_rule_id?: string | null
          sent_at?: string | null
          subtotal?: number
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_calculations_calculated_by_fkey"
            columns: ["calculated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_calculations_pricing_rule_id_fkey"
            columns: ["pricing_rule_id"]
            isOneToOne: false
            referencedRelation: "quote_pricing_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_pricing_rules: {
        Row: {
          base_fee: number | null
          created_at: string
          created_by: string | null
          description: string | null
          extra_service_fees: Json | null
          id: string
          is_active: boolean | null
          max_monthly_volume: number | null
          max_sku_count: number | null
          min_monthly_volume: number | null
          min_sku_count: number | null
          name: string
          packing_fee: number | null
          picking_fee: number | null
          priority: number | null
          product_categories: string[] | null
          storage_fee: number | null
          updated_at: string
          updated_by: string | null
          volume_discount: Json | null
        }
        Insert: {
          base_fee?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          extra_service_fees?: Json | null
          id?: string
          is_active?: boolean | null
          max_monthly_volume?: number | null
          max_sku_count?: number | null
          min_monthly_volume?: number | null
          min_sku_count?: number | null
          name: string
          packing_fee?: number | null
          picking_fee?: number | null
          priority?: number | null
          product_categories?: string[] | null
          storage_fee?: number | null
          updated_at?: string
          updated_by?: string | null
          volume_discount?: Json | null
        }
        Update: {
          base_fee?: number | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          extra_service_fees?: Json | null
          id?: string
          is_active?: boolean | null
          max_monthly_volume?: number | null
          max_sku_count?: number | null
          min_monthly_volume?: number | null
          min_sku_count?: number | null
          name?: string
          packing_fee?: number | null
          picking_fee?: number | null
          priority?: number | null
          product_categories?: string[] | null
          storage_fee?: number | null
          updated_at?: string
          updated_by?: string | null
          volume_discount?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "quote_pricing_rules_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_pricing_rules_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_documents: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          file_size: number | null
          id: string
          mime_type: string | null
          org_id: string | null
          public_url: string | null
          receipt_id: string | null
          receipt_no: string | null
          storage_bucket: string
          storage_path: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          org_id?: string | null
          public_url?: string | null
          receipt_id?: string | null
          receipt_no?: string | null
          storage_bucket?: string
          storage_path: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          org_id?: string | null
          public_url?: string | null
          receipt_id?: string | null
          receipt_no?: string | null
          storage_bucket?: string
          storage_path?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_documents_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      return_order: {
        Row: {
          brand_id: string | null
          carrier_code: string | null
          completed_at: string | null
          created_at: string | null
          disposition: string | null
          external_order_ref: string | null
          id: string
          inspected_at: string | null
          inspected_by_user_id: string | null
          note: string | null
          outbound_id: string | null
          reason_code: string | null
          received_at: string | null
          received_by_user_id: string | null
          source_type: string
          status: string
          store_id: string | null
          tracking_no: string | null
          updated_at: string | null
          warehouse_id: string
        }
        Insert: {
          brand_id?: string | null
          carrier_code?: string | null
          completed_at?: string | null
          created_at?: string | null
          disposition?: string | null
          external_order_ref?: string | null
          id?: string
          inspected_at?: string | null
          inspected_by_user_id?: string | null
          note?: string | null
          outbound_id?: string | null
          reason_code?: string | null
          received_at?: string | null
          received_by_user_id?: string | null
          source_type: string
          status: string
          store_id?: string | null
          tracking_no?: string | null
          updated_at?: string | null
          warehouse_id: string
        }
        Update: {
          brand_id?: string | null
          carrier_code?: string | null
          completed_at?: string | null
          created_at?: string | null
          disposition?: string | null
          external_order_ref?: string | null
          id?: string
          inspected_at?: string | null
          inspected_by_user_id?: string | null
          note?: string | null
          outbound_id?: string | null
          reason_code?: string | null
          received_at?: string | null
          received_by_user_id?: string | null
          source_type?: string
          status?: string
          store_id?: string | null
          tracking_no?: string | null
          updated_at?: string | null
          warehouse_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "return_order_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_order_outbound_id_fkey"
            columns: ["outbound_id"]
            isOneToOne: false
            referencedRelation: "outbounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_order_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_order_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      return_order_line: {
        Row: {
          condition_code: string | null
          id: string
          line_no: number | null
          lot_no: string | null
          note: string | null
          product_id: string | null
          qty_accepted: number
          qty_reshipped: number
          qty_restocked: number
          qty_returned: number
          qty_scrapped: number
          return_order_id: string
          uom_code: string | null
        }
        Insert: {
          condition_code?: string | null
          id?: string
          line_no?: number | null
          lot_no?: string | null
          note?: string | null
          product_id?: string | null
          qty_accepted?: number
          qty_reshipped?: number
          qty_restocked?: number
          qty_returned: number
          qty_scrapped?: number
          return_order_id: string
          uom_code?: string | null
        }
        Update: {
          condition_code?: string | null
          id?: string
          line_no?: number | null
          lot_no?: string | null
          note?: string | null
          product_id?: string | null
          qty_accepted?: number
          qty_reshipped?: number
          qty_restocked?: number
          qty_returned?: number
          qty_scrapped?: number
          return_order_id?: string
          uom_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_order_line_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "return_order_line_return_order_id_fkey"
            columns: ["return_order_id"]
            isOneToOne: false
            referencedRelation: "return_order"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_account: {
        Row: {
          account_code: string
          account_name: string | null
          api_password: string | null
          api_token: string | null
          api_username: string | null
          carrier_id: string
          contract_rate: number | null
          created_at: string | null
          customer_master_id: string
          id: string
          is_anh_owned: boolean | null
          rate_currency: string | null
          status: string | null
          updated_at: string | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          account_code: string
          account_name?: string | null
          api_password?: string | null
          api_token?: string | null
          api_username?: string | null
          carrier_id: string
          contract_rate?: number | null
          created_at?: string | null
          customer_master_id: string
          id?: string
          is_anh_owned?: boolean | null
          rate_currency?: string | null
          status?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          account_code?: string
          account_name?: string | null
          api_password?: string | null
          api_token?: string | null
          api_username?: string | null
          carrier_id?: string
          contract_rate?: number | null
          created_at?: string | null
          customer_master_id?: string
          id?: string
          is_anh_owned?: boolean | null
          rate_currency?: string | null
          status?: string | null
          updated_at?: string | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shipping_account_carrier_id_fkey"
            columns: ["carrier_id"]
            isOneToOne: false
            referencedRelation: "shipping_carrier"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_account_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shipping_account_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      shipping_carrier: {
        Row: {
          api_endpoint: string | null
          api_key: string | null
          api_type: string | null
          code: string
          country_code: string | null
          created_at: string | null
          id: string
          is_domestic: boolean | null
          is_international: boolean | null
          name_en: string | null
          name_ko: string
          status: string | null
          updated_at: string | null
        }
        Insert: {
          api_endpoint?: string | null
          api_key?: string | null
          api_type?: string | null
          code: string
          country_code?: string | null
          created_at?: string | null
          id?: string
          is_domestic?: boolean | null
          is_international?: boolean | null
          name_en?: string | null
          name_ko: string
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          api_endpoint?: string | null
          api_key?: string | null
          api_type?: string | null
          code?: string
          country_code?: string | null
          created_at?: string | null
          id?: string
          is_domestic?: boolean | null
          is_international?: boolean | null
          name_en?: string | null
          name_ko?: string
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      stock_transfer: {
        Row: {
          approved_at: string | null
          approved_by_user_id: string | null
          created_at: string | null
          created_by_user_id: string | null
          from_warehouse_id: string
          id: string
          note: string | null
          received_at: string | null
          ref_no: string | null
          requested_at: string | null
          shipped_at: string | null
          status: string
          to_warehouse_id: string
          updated_at: string | null
        }
        Insert: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          from_warehouse_id: string
          id?: string
          note?: string | null
          received_at?: string | null
          ref_no?: string | null
          requested_at?: string | null
          shipped_at?: string | null
          status: string
          to_warehouse_id: string
          updated_at?: string | null
        }
        Update: {
          approved_at?: string | null
          approved_by_user_id?: string | null
          created_at?: string | null
          created_by_user_id?: string | null
          from_warehouse_id?: string
          id?: string
          note?: string | null
          received_at?: string | null
          ref_no?: string | null
          requested_at?: string | null
          shipped_at?: string | null
          status?: string
          to_warehouse_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_from_warehouse_id_fkey"
            columns: ["from_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_transfer_to_warehouse_id_fkey"
            columns: ["to_warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_transfer_line: {
        Row: {
          id: string
          line_no: number | null
          product_id: string
          qty_planned: number
          qty_received: number
          qty_shipped: number
          stock_transfer_id: string
          uom_code: string
        }
        Insert: {
          id?: string
          line_no?: number | null
          product_id: string
          qty_planned: number
          qty_received?: number
          qty_shipped?: number
          stock_transfer_id: string
          uom_code: string
        }
        Update: {
          id?: string
          line_no?: number | null
          product_id?: string
          qty_planned?: number
          qty_received?: number
          qty_shipped?: number
          stock_transfer_id?: string
          uom_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_transfer_line_stock_transfer_id_fkey"
            columns: ["stock_transfer_id"]
            isOneToOne: false
            referencedRelation: "stock_transfer"
            referencedColumns: ["id"]
          },
        ]
      }
      store: {
        Row: {
          api_enabled: boolean | null
          api_endpoint: string | null
          api_key: string | null
          brand_id: string
          country_code: string | null
          created_at: string | null
          external_store_id: string | null
          id: string
          language: string | null
          last_synced_at: string | null
          metadata: Json | null
          name: string
          platform: string
          status: string | null
          store_url: string | null
          sync_interval_min: number | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          api_enabled?: boolean | null
          api_endpoint?: string | null
          api_key?: string | null
          brand_id: string
          country_code?: string | null
          created_at?: string | null
          external_store_id?: string | null
          id?: string
          language?: string | null
          last_synced_at?: string | null
          metadata?: Json | null
          name: string
          platform: string
          status?: string | null
          store_url?: string | null
          sync_interval_min?: number | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          api_enabled?: boolean | null
          api_endpoint?: string | null
          api_key?: string | null
          brand_id?: string
          country_code?: string | null
          created_at?: string | null
          external_store_id?: string | null
          id?: string
          language?: string | null
          last_synced_at?: string | null
          metadata?: Json | null
          name?: string
          platform?: string
          status?: string | null
          store_url?: string | null
          sync_interval_min?: number | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "store_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
        ]
      }
      system_alert: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_type: string
          brand_id: string | null
          created_at: string | null
          id: string
          message: string | null
          ref_id: string | null
          ref_type: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          status: string | null
          title: string
          updated_at: string | null
          warehouse_id: string | null
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type: string
          brand_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          ref_id?: string | null
          ref_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity: string
          status?: string | null
          title: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_type?: string
          brand_id?: string | null
          created_at?: string | null
          id?: string
          message?: string | null
          ref_id?: string | null
          ref_type?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          status?: string | null
          title?: string
          updated_at?: string | null
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "system_alert_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brand"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "system_alert_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      system_announcements: {
        Row: {
          created_at: string | null
          ends_at: string | null
          id: string
          is_active: boolean
          link_url: string | null
          message: string
          starts_at: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          message: string
          starts_at?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          ends_at?: string | null
          id?: string
          is_active?: boolean
          link_url?: string | null
          message?: string
          starts_at?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      user_profiles: {
        Row: {
          avatar_url: string | null
          can_access_admin: boolean | null
          can_access_dashboard: boolean | null
          can_manage_inventory: boolean | null
          can_manage_orders: boolean | null
          can_manage_users: boolean | null
          created_at: string | null
          deleted_at: string | null
          department: string | null
          display_name: string | null
          email: string
          full_name: string | null
          id: string
          language: string | null
          last_login_at: string | null
          locked_reason: string | null
          locked_until: string | null
          org_id: string | null
          partner_id: string | null
          phone: string | null
          role: string
          status: string | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          can_access_admin?: boolean | null
          can_access_dashboard?: boolean | null
          can_manage_inventory?: boolean | null
          can_manage_orders?: boolean | null
          can_manage_users?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          department?: string | null
          display_name?: string | null
          email: string
          full_name?: string | null
          id: string
          language?: string | null
          last_login_at?: string | null
          locked_reason?: string | null
          locked_until?: string | null
          org_id?: string | null
          partner_id?: string | null
          phone?: string | null
          role?: string
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          can_access_admin?: boolean | null
          can_access_dashboard?: boolean | null
          can_manage_inventory?: boolean | null
          can_manage_orders?: boolean | null
          can_manage_users?: boolean | null
          created_at?: string | null
          deleted_at?: string | null
          department?: string | null
          display_name?: string | null
          email?: string
          full_name?: string | null
          id?: string
          language?: string | null
          last_login_at?: string | null
          locked_reason?: string | null
          locked_until?: string | null
          org_id?: string | null
          partner_id?: string | null
          phone?: string | null
          role?: string
          status?: string | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "my_partner_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string | null
          department: string | null
          email: string | null
          id: string
          partner_id: string | null
          role: string
          status: string | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          id: string
          partner_id?: string | null
          role?: string
          status?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          created_at?: string | null
          department?: string | null
          email?: string | null
          id?: string
          partner_id?: string | null
          role?: string
          status?: string | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "users_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "my_partner_info"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      warehouse: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          allow_cross_dock: boolean | null
          allow_inbound: boolean | null
          allow_outbound: boolean | null
          city: string | null
          code: string
          country_code: string | null
          created_at: string | null
          cutoff_time: string | null
          id: string
          is_returns_center: boolean | null
          latitude: number | null
          longitude: number | null
          metadata: Json | null
          name: string
          operating_hours: Json | null
          operator_customer_id: string | null
          org_id: string | null
          owner_customer_id: string | null
          postal_code: string | null
          state: string | null
          status: string | null
          tenant_id: string
          timezone: string | null
          type: string
          updated_at: string | null
        }
        Insert: {
          address_line1?: string | null
          address_line2?: string | null
          allow_cross_dock?: boolean | null
          allow_inbound?: boolean | null
          allow_outbound?: boolean | null
          city?: string | null
          code: string
          country_code?: string | null
          created_at?: string | null
          cutoff_time?: string | null
          id?: string
          is_returns_center?: boolean | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          name: string
          operating_hours?: Json | null
          operator_customer_id?: string | null
          org_id?: string | null
          owner_customer_id?: string | null
          postal_code?: string | null
          state?: string | null
          status?: string | null
          tenant_id: string
          timezone?: string | null
          type: string
          updated_at?: string | null
        }
        Update: {
          address_line1?: string | null
          address_line2?: string | null
          allow_cross_dock?: boolean | null
          allow_inbound?: boolean | null
          allow_outbound?: boolean | null
          city?: string | null
          code?: string
          country_code?: string | null
          created_at?: string | null
          cutoff_time?: string | null
          id?: string
          is_returns_center?: boolean | null
          latitude?: number | null
          longitude?: number | null
          metadata?: Json | null
          name?: string
          operating_hours?: Json | null
          operator_customer_id?: string | null
          org_id?: string | null
          owner_customer_id?: string | null
          postal_code?: string | null
          state?: string | null
          status?: string | null
          tenant_id?: string
          timezone?: string | null
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "warehouse_operator_customer_id_fkey"
            columns: ["operator_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_operator_customer_id_fkey"
            columns: ["operator_customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_owner_customer_id_fkey"
            columns: ["owner_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "warehouse_owner_customer_id_fkey"
            columns: ["owner_customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          assignee: string | null
          attachments: string[] | null
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string
          id: string
          inbound_shipment_id: string | null
          location: string | null
          note: string | null
          outbound_id: string | null
          priority: number | null
          process_stage: string | null
          product_name: string
          quantity: number
          sla_due_at: string | null
          started_at: string | null
          status: string
          task_type: string | null
          title: string
          type: string
          unit: string
          warehouse_id: string | null
        }
        Insert: {
          assignee?: string | null
          attachments?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date: string
          id?: string
          inbound_shipment_id?: string | null
          location?: string | null
          note?: string | null
          outbound_id?: string | null
          priority?: number | null
          process_stage?: string | null
          product_name: string
          quantity: number
          sla_due_at?: string | null
          started_at?: string | null
          status: string
          task_type?: string | null
          title: string
          type: string
          unit: string
          warehouse_id?: string | null
        }
        Update: {
          assignee?: string | null
          attachments?: string[] | null
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string
          id?: string
          inbound_shipment_id?: string | null
          location?: string | null
          note?: string | null
          outbound_id?: string | null
          priority?: number | null
          process_stage?: string | null
          product_name?: string
          quantity?: number
          sla_due_at?: string | null
          started_at?: string | null
          status?: string
          task_type?: string | null
          title?: string
          type?: string
          unit?: string
          warehouse_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_inbound_shipment_id_fkey"
            columns: ["inbound_shipment_id"]
            isOneToOne: false
            referencedRelation: "inbound_shipment"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_outbound_id_fkey"
            columns: ["outbound_id"]
            isOneToOne: false
            referencedRelation: "outbounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_warehouse_id_fkey"
            columns: ["warehouse_id"]
            isOneToOne: false
            referencedRelation: "warehouse"
            referencedColumns: ["id"]
          },
        ]
      }
      work_task_action: {
        Row: {
          action_code: string
          completed_at: string | null
          completed_by: string | null
          created_at: string | null
          id: string
          label: string
          seq_no: number
          status: string
          updated_at: string | null
          work_order_id: string
        }
        Insert: {
          action_code: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          label: string
          seq_no: number
          status?: string
          updated_at?: string | null
          work_order_id: string
        }
        Update: {
          action_code?: string
          completed_at?: string | null
          completed_by?: string | null
          created_at?: string | null
          id?: string
          label?: string
          seq_no?: number
          status?: string
          updated_at?: string | null
          work_order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "work_task_action_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_users: {
        Row: {
          id: string | null
        }
        Insert: {
          id?: string | null
        }
        Update: {
          id?: string | null
        }
        Relationships: []
      }
      my_partner_info: {
        Row: {
          address: string | null
          code: string | null
          contact: string | null
          created_at: string | null
          email: string | null
          id: string | null
          locale: string | null
          name: string | null
          note: string | null
          phone: string | null
          timezone: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: []
      }
      v_active_contracts: {
        Row: {
          auto_renewal: boolean | null
          billing_cycle: string | null
          contract_amount: number | null
          contract_end: string | null
          contract_file_name: string | null
          contract_file_url: string | null
          contract_name: string | null
          contract_no: string | null
          contract_start: string | null
          contract_status_computed: string | null
          contract_type: string | null
          created_at: string | null
          currency: string | null
          customer_code: string | null
          customer_master_id: string | null
          customer_name: string | null
          customer_type: string | null
          days_until_expiry: number | null
          id: string | null
          metadata: Json | null
          note: string | null
          parent_contract_id: string | null
          payment_method: string | null
          payment_terms: number | null
          reminder_sent: boolean | null
          reminder_sent_at: string | null
          renewal_count: number | null
          renewal_notice_days: number | null
          replaced_by_contract_id: string | null
          signed_by_company: string | null
          signed_by_customer: string | null
          signed_date: string | null
          sla_accuracy_rate: number | null
          sla_inbound_processing: number | null
          sla_ontime_ship_rate: number | null
          sla_outbound_cutoff: string | null
          status: string | null
          termination_date: string | null
          termination_notice_date: string | null
          termination_reason: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_contract_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contract_customer_master_id_fkey"
            columns: ["customer_master_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contract_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "customer_contract"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contract_parent_contract_id_fkey"
            columns: ["parent_contract_id"]
            isOneToOne: false
            referencedRelation: "v_active_contracts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contract_replaced_by_contract_id_fkey"
            columns: ["replaced_by_contract_id"]
            isOneToOne: false
            referencedRelation: "customer_contract"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customer_contract_replaced_by_contract_id_fkey"
            columns: ["replaced_by_contract_id"]
            isOneToOne: false
            referencedRelation: "v_active_contracts"
            referencedColumns: ["id"]
          },
        ]
      }
      v_customer_with_contacts: {
        Row: {
          address_line1: string | null
          address_line2: string | null
          billing_currency: string | null
          billing_cycle: string | null
          business_reg_no: string | null
          city: string | null
          code: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contacts: Json | null
          contract_end: string | null
          contract_start: string | null
          country_code: string | null
          created_at: string | null
          id: string | null
          metadata: Json | null
          name: string | null
          note: string | null
          org_id: string | null
          payment_terms: number | null
          postal_code: string | null
          status: string | null
          type: string | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "customer_master_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "org"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inbound_receipt_photo_progress: {
        Row: {
          is_required: boolean | null
          min_photos: number | null
          receipt_id: string | null
          slot_id: string | null
          slot_key: string | null
          slot_ok: boolean | null
          uploaded_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "inbound_photo_slots_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "inbound_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      v_inventory_stock_current: {
        Row: {
          current_stock: number | null
          product_id: string | null
          tenant_id: string | null
        }
        Relationships: []
      }
      v_quote_to_customer_conversion: {
        Row: {
          company_name: string | null
          contact_name: string | null
          converted_at: string | null
          converted_customer_id: string | null
          customer_code: string | null
          customer_name: string | null
          email: string | null
          expected_revenue: number | null
          inquiry_date: string | null
          quote_id: string | null
          quote_type: string | null
          sales_stage: string | null
          status: string | null
          win_probability: number | null
        }
        Relationships: [
          {
            foreignKeyName: "external_quote_inquiry_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "customer_master"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_quote_inquiry_converted_customer_id_fkey"
            columns: ["converted_customer_id"]
            isOneToOne: false
            referencedRelation: "v_customer_with_contacts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      archive_audit_logs: {
        Args: { p_batch_size?: number; p_retention_days?: number }
        Returns: number
      }
      attach_audit_trigger: {
        Args: { p_schema: string; p_table: string }
        Returns: undefined
      }
      bump_api_rate_limit: {
        Args: {
          p_actor_key: string
          p_actor_key_type: string
          p_scope: string
          p_window_seconds: number
        }
        Returns: {
          request_count: number
          window_end: string
          window_start: string
        }[]
      }
      confirm_inbound_receipt: {
        Args: { p_receipt_id: string; p_user_id: string }
        Returns: Json
      }
      confirm_inventory_transaction: {
        Args: {
          p_product_id: string
          p_quantity: number
          p_tenant_id: string
          p_type: string
          p_user_id: string
        }
        Returns: undefined
      }
      has_permission: {
        Args: { permission: string; user_id: string }
        Returns: boolean
      }
      is_admin: { Args: { user_id: string }; Returns: boolean }
      is_admin_safe: { Args: never; Returns: boolean }
      purge_audit_logs_archive: {
        Args: { p_batch_size?: number; p_keep_days?: number }
        Returns: number
      }
      rls_can_access_admin: { Args: never; Returns: boolean }
      rls_current_role: { Args: never; Returns: string }
      rls_current_tenant_id: { Args: never; Returns: string }
      rls_whitelist_role: { Args: never; Returns: string }
      run_audit_log_retention: {
        Args: {
          p_archive_keep_days?: number
          p_batch_size?: number
          p_hot_retention_days?: number
        }
        Returns: Json
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
