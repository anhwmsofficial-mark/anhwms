import type {
  Database as GeneratedDatabase,
  Json as GeneratedJson,
} from './supabase.generated'

export type Json = GeneratedJson

type AnyTableDef = {
  Row: any
  Insert: any
  Update: any
  Relationships: any[]
}

type AnyViewDef = {
  Row: any
  Relationships: any[]
}

type GeneratedPublic = GeneratedDatabase['public']

// Compatibility layer:
// - keeps generated DB shape as base
// - allows unresolved table/view names during gradual migration
export type Database = Omit<GeneratedDatabase, 'public'> & {
  public: Omit<GeneratedPublic, 'Tables' | 'Views'> & {
    Tables: GeneratedPublic['Tables'] & Record<string, AnyTableDef>
    Views: GeneratedPublic['Views'] & Record<string, AnyViewDef>
  }
}

type GeneratedSchema = Omit<GeneratedDatabase, '__InternalSupabase'>
type PublicGeneratedTableName = keyof GeneratedDatabase['public']['Tables']
type PublicGeneratedEnumName = keyof GeneratedDatabase['public']['Enums']
type PublicGeneratedCompositeTypeName = keyof GeneratedDatabase['public']['CompositeTypes']

export type Tables<
  PublicTableNameOrOptions extends string | { schema: keyof GeneratedSchema },
  TableName extends PublicTableNameOrOptions extends { schema: keyof GeneratedSchema }
    ? keyof GeneratedSchema[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: infer S extends keyof GeneratedSchema }
  ? TableName extends keyof GeneratedSchema[S]['Tables']
    ? GeneratedSchema[S]['Tables'][TableName] extends { Row: infer R }
      ? R
      : any
    : any
  : PublicTableNameOrOptions extends PublicGeneratedTableName
    ? GeneratedDatabase['public']['Tables'][PublicTableNameOrOptions] extends { Row: infer R }
      ? R
      : any
    : any

export type TablesInsert<
  PublicTableNameOrOptions extends string | { schema: keyof GeneratedSchema },
  TableName extends PublicTableNameOrOptions extends { schema: keyof GeneratedSchema }
    ? keyof GeneratedSchema[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: infer S extends keyof GeneratedSchema }
  ? TableName extends keyof GeneratedSchema[S]['Tables']
    ? GeneratedSchema[S]['Tables'][TableName] extends { Insert: infer I }
      ? I
      : any
    : any
  : PublicTableNameOrOptions extends PublicGeneratedTableName
    ? GeneratedDatabase['public']['Tables'][PublicTableNameOrOptions] extends { Insert: infer I }
      ? I
      : any
    : any

export type TablesUpdate<
  PublicTableNameOrOptions extends string | { schema: keyof GeneratedSchema },
  TableName extends PublicTableNameOrOptions extends { schema: keyof GeneratedSchema }
    ? keyof GeneratedSchema[PublicTableNameOrOptions['schema']]['Tables']
    : never = never,
> = PublicTableNameOrOptions extends { schema: infer S extends keyof GeneratedSchema }
  ? TableName extends keyof GeneratedSchema[S]['Tables']
    ? GeneratedSchema[S]['Tables'][TableName] extends { Update: infer U }
      ? U
      : any
    : any
  : PublicTableNameOrOptions extends PublicGeneratedTableName
    ? GeneratedDatabase['public']['Tables'][PublicTableNameOrOptions] extends { Update: infer U }
      ? U
      : any
    : any

export type Enums<
  PublicEnumNameOrOptions extends string | { schema: keyof GeneratedSchema },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof GeneratedSchema }
    ? keyof GeneratedSchema[PublicEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = PublicEnumNameOrOptions extends { schema: infer S extends keyof GeneratedSchema }
  ? EnumName extends keyof GeneratedSchema[S]['Enums']
    ? GeneratedSchema[S]['Enums'][EnumName]
    : any
  : PublicEnumNameOrOptions extends PublicGeneratedEnumName
    ? GeneratedDatabase['public']['Enums'][PublicEnumNameOrOptions]
    : any

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends string | { schema: keyof GeneratedSchema },
  CompositeTypeName extends
    PublicCompositeTypeNameOrOptions extends { schema: keyof GeneratedSchema }
      ? keyof GeneratedSchema[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
      : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: infer S extends keyof GeneratedSchema }
  ? CompositeTypeName extends keyof GeneratedSchema[S]['CompositeTypes']
    ? GeneratedSchema[S]['CompositeTypes'][CompositeTypeName]
    : any
  : PublicCompositeTypeNameOrOptions extends PublicGeneratedCompositeTypeName
    ? GeneratedDatabase['public']['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : any
