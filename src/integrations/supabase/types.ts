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
      equipment: {
        Row: {
          available_quantity: number
          brand: string | null
          created_at: string
          id: number
          laboratory_id: number | null
          model: string | null
          name: string
          quantity: number
          status: string
          updated_at: string
        }
        Insert: {
          available_quantity?: number
          brand?: string | null
          created_at?: string
          id?: number
          laboratory_id?: number | null
          model?: string | null
          name: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Update: {
          available_quantity?: number
          brand?: string | null
          created_at?: string
          id?: number
          laboratory_id?: number | null
          model?: string | null
          name?: string
          quantity?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_laboratory_id_fkey"
            columns: ["laboratory_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
        ]
      }
      equipment_reservations: {
        Row: {
          adviser_name: string
          batch_id: string | null
          created_at: string
          email: string | null
          end_datetime: string
          equipment_id: number
          id: number
          phone: string | null
          purpose: string
          quantity_reserved: number
          researcher_name: string
          special_requirements: string | null
          stakeholder_type: string
          start_datetime: string
          status: string
          study_title: string
          unit_college: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adviser_name?: string
          batch_id?: string | null
          created_at?: string
          email?: string | null
          end_datetime: string
          equipment_id: number
          id?: number
          phone?: string | null
          purpose: string
          quantity_reserved?: number
          researcher_name: string
          special_requirements?: string | null
          stakeholder_type?: string
          start_datetime: string
          status?: string
          study_title?: string
          unit_college?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adviser_name?: string
          batch_id?: string | null
          created_at?: string
          email?: string | null
          end_datetime?: string
          equipment_id?: number
          id?: number
          phone?: string | null
          purpose?: string
          quantity_reserved?: number
          researcher_name?: string
          special_requirements?: string | null
          stakeholder_type?: string
          start_datetime?: string
          status?: string
          study_title?: string
          unit_college?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "equipment_reservations_equipment_id_fkey"
            columns: ["equipment_id"]
            isOneToOne: false
            referencedRelation: "equipment"
            referencedColumns: ["id"]
          },
        ]
      }
      feedbacks: {
        Row: {
          id: number
          user_id: string
          researcher_name: string
          email: string
          is_anonymous: boolean
          laboratory_id: number | null
          rating: number
          comment: string | null
          submitted_at: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: number
          user_id: string
          researcher_name: string
          email: string
          is_anonymous?: boolean
          laboratory_id?: number | null
          rating: number
          comment?: string | null
          submitted_at?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: number
          user_id?: string
          researcher_name?: string
          email?: string
          is_anonymous?: boolean
          laboratory_id?: number | null
          rating?: number
          comment?: string | null
          submitted_at?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedbacks_laboratory_id_fkey"
            columns: ["laboratory_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
        ]
      }
      laboratories: {
        Row: {
          created_at: string
          current_occupancy: number | null
          description: string | null
          equipment_list: string | null
          floor: string | null
          id: number
          lab_code: string
          lab_name: string
          max_capacity: number | null
          safety_requirements: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_occupancy?: number | null
          description?: string | null
          equipment_list?: string | null
          floor?: string | null
          id?: number
          lab_code: string
          lab_name: string
          max_capacity?: number | null
          safety_requirements?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_occupancy?: number | null
          description?: string | null
          equipment_list?: string | null
          floor?: string | null
          id?: number
          lab_code?: string
          lab_name?: string
          max_capacity?: number | null
          safety_requirements?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      paper_submissions: {
        Row: {
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_type: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_name: string
          file_path: string
          file_type?: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          file_name?: string
          file_path?: string
          file_type?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reservations: {
        Row: {
          adviser_name: string
          batch_id: string | null
          created_at: string
          email: string | null
          end_datetime: string
          equipment_needed: string | null
          id: number
          laboratory_id: number
          phone: string | null
          research_purpose: string
          researcher_name: string
          special_requirements: string | null
          stakeholder_type: string
          start_datetime: string
          status: string
          study_title: string
          unit_college: string
          updated_at: string
          user_id: string
        }
        Insert: {
          adviser_name?: string
          batch_id?: string | null
          created_at?: string
          email?: string | null
          end_datetime: string
          equipment_needed?: string | null
          id?: number
          laboratory_id: number
          phone?: string | null
          research_purpose: string
          researcher_name: string
          special_requirements?: string | null
          stakeholder_type?: string
          start_datetime: string
          status?: string
          study_title?: string
          unit_college?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          adviser_name?: string
          batch_id?: string | null
          created_at?: string
          email?: string | null
          end_datetime?: string
          equipment_needed?: string | null
          id?: number
          laboratory_id?: number
          phone?: string | null
          research_purpose?: string
          researcher_name?: string
          special_requirements?: string | null
          stakeholder_type?: string
          start_datetime?: string
          status?: string
          study_title?: string
          unit_college?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reservations_laboratory_id_fkey"
            columns: ["laboratory_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_unavailability: {
        Row: {
          id: string
          user_id: string
          unavailable_date: string
          reason: string | null
          staff_name: string | null
          laboratory_id: number | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          unavailable_date: string
          reason?: string | null
          staff_name?: string | null
          laboratory_id?: number | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          unavailable_date?: string
          reason?: string | null
          staff_name?: string | null
          laboratory_id?: number | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_unavailability_laboratory_id_fkey"
            columns: ["laboratory_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_room_assignments: {
        Row: {
          id: string
          user_id: string
          laboratory_id: number
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          laboratory_id: number
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          laboratory_id?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_room_assignments_laboratory_id_fkey"
            columns: ["laboratory_id"]
            isOneToOne: false
            referencedRelation: "laboratories"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          assigned_floor: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          assigned_floor?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          assigned_floor?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_delete_submission: {
        Args: { p_file_path: string; p_id: string }
        Returns: undefined
      }
      admin_update_submission_status: {
        Args: { p_id: string; p_status: string }
        Returns: undefined
      }
      get_all_submissions: {
        Args: never
        Returns: {
          created_at: string
          description: string | null
          file_name: string
          file_path: string
          file_type: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "paper_submissions"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_staff_list: {
        Args: never
        Returns: {
          user_id: string
          email: string
          full_name: string | null
          created_at: string
          assigned_rooms: Json
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "staff" | "user"
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
      app_role: ["admin", "staff", "user"],
    },
  },
} as const