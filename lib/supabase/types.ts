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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
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
  public: {
    Tables: {
      cases: {
        Row: {
          created_at: string
          created_by_id: string | null
          deleted_at: string | null
          id: string
          id_number: string
          name: string
          ngo_id: string
          note: string | null
        }
        Insert: {
          created_at?: string
          created_by_id?: string | null
          deleted_at?: string | null
          id?: string
          id_number: string
          name: string
          ngo_id: string
          note?: string | null
        }
        Update: {
          created_at?: string
          created_by_id?: string | null
          deleted_at?: string | null
          id?: string
          id_number?: string
          name?: string
          ngo_id?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_demand_submissions: {
        Row: {
          id: string
          ngo_id: string
          submitted_at: string
          submitted_by_id: string | null
          year_month: string
        }
        Insert: {
          id?: string
          ngo_id: string
          submitted_at?: string
          submitted_by_id?: string | null
          year_month: string
        }
        Update: {
          id?: string
          ngo_id?: string
          submitted_at?: string
          submitted_by_id?: string | null
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_demand_submissions_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_demand_submissions_submitted_by_id_fkey"
            columns: ["submitted_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_demands: {
        Row: {
          created_at: string
          created_by_id: string | null
          id: string
          ngo_id: string
          quantity: number
          store_id: string
          year_month: string
        }
        Insert: {
          created_at?: string
          created_by_id?: string | null
          id?: string
          ngo_id: string
          quantity: number
          store_id: string
          year_month: string
        }
        Update: {
          created_at?: string
          created_by_id?: string | null
          id?: string
          ngo_id?: string
          quantity?: number
          store_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_demands_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_demands_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_demands_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_monthly_summary_view"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "monthly_demands_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_voucher_issuances: {
        Row: {
          id: string
          issued_at: string
          issued_by_id: string | null
          ngo_id: string
          year_month: string
        }
        Insert: {
          id?: string
          issued_at?: string
          issued_by_id?: string | null
          ngo_id: string
          year_month: string
        }
        Update: {
          id?: string
          issued_at?: string
          issued_by_id?: string | null
          ngo_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "monthly_voucher_issuances_issued_by_id_fkey"
            columns: ["issued_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_voucher_issuances_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      ngos: {
        Row: {
          contact_info: string | null
          created_at: string
          id: string
          name: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      receipts: {
        Row: {
          amount: number
          deleted_at: string | null
          id: string
          ngo_rep_id: string
          photo_url: string
          received_date: string
          settlement_id: string | null
          store_id: string
          uploaded_at: string
        }
        Insert: {
          amount: number
          deleted_at?: string | null
          id?: string
          ngo_rep_id: string
          photo_url: string
          received_date: string
          settlement_id?: string | null
          store_id: string
          uploaded_at?: string
        }
        Update: {
          amount?: number
          deleted_at?: string | null
          id?: string
          ngo_rep_id?: string
          photo_url?: string
          received_date?: string
          settlement_id?: string | null
          store_id?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipts_ngo_rep_id_fkey"
            columns: ["ngo_rep_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_monthly_summary_view"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "receipts_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      settlement_store_breakdown: {
        Row: {
          compensation_amount: number
          id: string
          prepay_amount: number
          settlement_id: string
          store_id: string
          total_amount: number
        }
        Insert: {
          compensation_amount?: number
          id?: string
          prepay_amount?: number
          settlement_id: string
          store_id: string
          total_amount?: number
        }
        Update: {
          compensation_amount?: number
          id?: string
          prepay_amount?: number
          settlement_id?: string
          store_id?: string
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "settlement_store_breakdown_settlement_id_fkey"
            columns: ["settlement_id"]
            isOneToOne: false
            referencedRelation: "settlements"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlement_store_breakdown_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_monthly_summary_view"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "settlement_store_breakdown_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      settlements: {
        Row: {
          approved_at: string | null
          approved_by_id: string | null
          compensation_amount: number
          id: string
          ngo_rep_id: string
          paid_at: string | null
          prepay_amount: number
          status: string
          total_amount: number
          year_month: string
        }
        Insert: {
          approved_at?: string | null
          approved_by_id?: string | null
          compensation_amount?: number
          id?: string
          ngo_rep_id: string
          paid_at?: string | null
          prepay_amount?: number
          status?: string
          total_amount?: number
          year_month: string
        }
        Update: {
          approved_at?: string | null
          approved_by_id?: string | null
          compensation_amount?: number
          id?: string
          ngo_rep_id?: string
          paid_at?: string | null
          prepay_amount?: number
          status?: string
          total_amount?: number
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "settlements_approved_by_id_fkey"
            columns: ["approved_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "settlements_ngo_rep_id_fkey"
            columns: ["ngo_rep_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      store_collection_status: {
        Row: {
          completed_at: string
          completed_by_id: string | null
          id: string
          store_id: string
          year_month: string
        }
        Insert: {
          completed_at?: string
          completed_by_id?: string | null
          id?: string
          store_id: string
          year_month: string
        }
        Update: {
          completed_at?: string
          completed_by_id?: string | null
          id?: string
          store_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "store_collection_status_completed_by_id_fkey"
            columns: ["completed_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "store_collection_status_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_monthly_summary_view"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "store_collection_status_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          contact: string | null
          created_at: string
          deleted_at: string | null
          id: string
          name: string
          owner_ngo_rep_id: string
        }
        Insert: {
          address?: string | null
          contact?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name: string
          owner_ngo_rep_id: string
        }
        Update: {
          address?: string | null
          contact?: string | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          name?: string
          owner_ngo_rep_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stores_owner_ngo_rep_id_fkey"
            columns: ["owner_ngo_rep_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          created_at: string
          created_by_id: string | null
          email: string
          id: string
          name: string
          ngo_id: string
          role: string
        }
        Insert: {
          created_at?: string
          created_by_id?: string | null
          email: string
          id: string
          name: string
          ngo_id: string
          role: string
        }
        Update: {
          created_at?: string
          created_by_id?: string | null
          email?: string
          id?: string
          name?: string
          ngo_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "users_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "users_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_assignments: {
        Row: {
          assigned_at: string
          assigned_by_id: string | null
          case_id: string
          id: string
          serial_number: string
          store_id: string
          year_month: string
        }
        Insert: {
          assigned_at?: string
          assigned_by_id?: string | null
          case_id: string
          id?: string
          serial_number: string
          store_id: string
          year_month: string
        }
        Update: {
          assigned_at?: string
          assigned_by_id?: string | null
          case_id?: string
          id?: string
          serial_number?: string
          store_id?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_assignments_assigned_by_id_fkey"
            columns: ["assigned_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_assignments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "case_usage_view"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "voucher_assignments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_assignments_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "my_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_assignments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "store_monthly_summary_view"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "voucher_assignments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_collections: {
        Row: {
          collected_at_store_id: string
          id: string
          is_cross_store: boolean | null
          originally_assigned_case_id: string | null
          originally_assigned_store_id: string | null
          scanned_at: string
          scanned_by_id: string | null
          serial_number: string
          year_month: string
        }
        Insert: {
          collected_at_store_id: string
          id?: string
          is_cross_store?: boolean | null
          originally_assigned_case_id?: string | null
          originally_assigned_store_id?: string | null
          scanned_at?: string
          scanned_by_id?: string | null
          serial_number: string
          year_month: string
        }
        Update: {
          collected_at_store_id?: string
          id?: string
          is_cross_store?: boolean | null
          originally_assigned_case_id?: string | null
          originally_assigned_store_id?: string | null
          scanned_at?: string
          scanned_by_id?: string | null
          serial_number?: string
          year_month?: string
        }
        Relationships: [
          {
            foreignKeyName: "voucher_collections_collected_at_store_id_fkey"
            columns: ["collected_at_store_id"]
            isOneToOne: false
            referencedRelation: "store_monthly_summary_view"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "voucher_collections_collected_at_store_id_fkey"
            columns: ["collected_at_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_collections_originally_assigned_case_id_fkey"
            columns: ["originally_assigned_case_id"]
            isOneToOne: false
            referencedRelation: "case_usage_view"
            referencedColumns: ["case_id"]
          },
          {
            foreignKeyName: "voucher_collections_originally_assigned_case_id_fkey"
            columns: ["originally_assigned_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_collections_originally_assigned_case_id_fkey"
            columns: ["originally_assigned_case_id"]
            isOneToOne: false
            referencedRelation: "my_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_collections_originally_assigned_store_id_fkey"
            columns: ["originally_assigned_store_id"]
            isOneToOne: false
            referencedRelation: "store_monthly_summary_view"
            referencedColumns: ["store_id"]
          },
          {
            foreignKeyName: "voucher_collections_originally_assigned_store_id_fkey"
            columns: ["originally_assigned_store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_collections_scanned_by_id_fkey"
            columns: ["scanned_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      case_usage_view: {
        Row: {
          case_id: string | null
          case_name: string | null
          ngo_id: string | null
          scanned_at: string | null
          serial_number: string | null
          used_at_store_name: string | null
          year_month: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      my_cases: {
        Row: {
          created_at: string | null
          created_by_id: string | null
          id: string | null
          id_number_last4: string | null
          name: string | null
          ngo_id: string | null
          note: string | null
        }
        Insert: {
          created_at?: string | null
          created_by_id?: string | null
          id?: string | null
          id_number_last4?: never
          name?: string | null
          ngo_id?: string | null
          note?: string | null
        }
        Update: {
          created_at?: string | null
          created_by_id?: string | null
          id?: string | null
          id_number_last4?: never
          name?: string | null
          ngo_id?: string | null
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cases_created_by_id_fkey"
            columns: ["created_by_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_ngo_id_fkey"
            columns: ["ngo_id"]
            isOneToOne: false
            referencedRelation: "ngos"
            referencedColumns: ["id"]
          },
        ]
      }
      store_monthly_summary_view: {
        Row: {
          compensation_owed: number | null
          cross_store_count: number | null
          store_id: string | null
          store_name: string | null
          total_vouchers_received: number | null
          year_month: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_user_ngo_id: { Args: never; Returns: string }
      current_user_role: { Args: never; Returns: string }
      generate_settlements: { Args: { p_year_month: string }; Returns: number }
      is_lixin: { Args: never; Returns: boolean }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
