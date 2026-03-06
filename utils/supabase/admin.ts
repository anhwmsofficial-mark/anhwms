import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { getEnv } from '@/lib/env'
import type { Database as RawDatabase } from '@/types/supabase.generated'

type InventoryLedgerStagingRow = {
  id: number
  tenant_id: string
  warehouse_id: string
  product_id: string
  occurred_at: string
  raw_row_no: number | null
  opening_stock: number | null
  inbound_qty: number | null
  disposal_qty: number | null
  damage_qty: number | null
  return_b2c_qty: number | null
  outbound_qty: number | null
  adjustment_plus_qty: number | null
  adjustment_minus_qty: number | null
  bundle_break_in_qty: number | null
  bundle_break_out_qty: number | null
  export_pickup_qty: number | null
  outbound_cancel_qty: number | null
  memo: string | null
  source_file_name: string | null
  created_at: string
}

type InventoryLedgerStagingMovementsRow = {
  tenant_id: string
  warehouse_id: string
  product_id: string
  occurred_at: string
  raw_row_no: number | null
  memo: string | null
  source_file_name: string | null
  movement_type: string
  direction: 'IN' | 'OUT'
  quantity: number
}

type Database = {
  public: {
    Tables: {
      [K in keyof RawDatabase['public']['Tables']]: RawDatabase['public']['Tables'][K] & {
        Relationships: []
      }
    } & {
      inventory_ledger_staging: {
        Row: InventoryLedgerStagingRow
        Insert: Omit<InventoryLedgerStagingRow, 'id' | 'created_at'>
        Update: Partial<Omit<InventoryLedgerStagingRow, 'id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: RawDatabase['public']['Views'] & {
      v_inventory_ledger_staging_movements: {
        Row: InventoryLedgerStagingMovementsRow
        Relationships: []
      }
    }
    Functions: RawDatabase['public']['Functions']
    Enums: RawDatabase['public']['Enums']
    CompositeTypes: { [_ in never]: never }
  }
}

export function createAdminClient() {
  const env = getEnv()
  const supabaseUrl = (env.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '').trim()
  const serviceRoleKey = (env.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim()

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY for admin client')
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })
}
