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
      active_sessions: {
        Row: {
          id: string
          last_active_at: string
          session_token: string
          user_id: string
        }
        Insert: {
          id?: string
          last_active_at?: string
          session_token: string
          user_id: string
        }
        Update: {
          id?: string
          last_active_at?: string
          session_token?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          description: string | null
          key: string
          text_value: string | null
          updated_at: string
          updated_by: string | null
          value: boolean
        }
        Insert: {
          description?: string | null
          key: string
          text_value?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: boolean
        }
        Update: {
          description?: string | null
          key?: string
          text_value?: string | null
          updated_at?: string
          updated_by?: string | null
          value?: boolean
        }
        Relationships: []
      }
      attendance_absences: {
        Row: {
          created_at: string
          half_day: string
          id: string
          school_id: string
          school_year: string
          session_date: string
          student_id: string
        }
        Insert: {
          created_at?: string
          half_day: string
          id?: string
          school_id: string
          school_year?: string
          session_date: string
          student_id: string
        }
        Update: {
          created_at?: string
          half_day?: string
          id?: string
          school_id?: string
          school_year?: string
          session_date?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_absences_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_absences_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_sessions: {
        Row: {
          half_day: string
          id: string
          school_id: string
          school_year: string
          session_date: string
          taken_at: string
        }
        Insert: {
          half_day: string
          id?: string
          school_id: string
          school_year?: string
          session_date: string
          taken_at?: string
        }
        Update: {
          half_day?: string
          id?: string
          school_id?: string
          school_year?: string
          session_date?: string
          taken_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_sessions_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          center_id: string
          created_at: string | null
          ecole_provenance: string | null
          id: string
          is_absent: boolean | null
          nom: string
          numero_table: string | null
          prenoms: string | null
          school_year: string
          sexe: string | null
          sort_order: number
        }
        Insert: {
          center_id: string
          created_at?: string | null
          ecole_provenance?: string | null
          id?: string
          is_absent?: boolean | null
          nom: string
          numero_table?: string | null
          prenoms?: string | null
          school_year?: string
          sexe?: string | null
          sort_order?: number
        }
        Update: {
          center_id?: string
          created_at?: string | null
          ecole_provenance?: string | null
          id?: string
          is_absent?: boolean | null
          nom?: string
          numero_table?: string | null
          prenoms?: string | null
          school_year?: string
          sexe?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "candidates_center_id_fkey"
            columns: ["center_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_resources: {
        Row: {
          class_name: string
          created_at: string
          created_by: string
          file_path: string
          file_size: number
          id: string
          kind: string
          original_name: string
          title: string
          updated_at: string
        }
        Insert: {
          class_name: string
          created_at?: string
          created_by?: string
          file_path: string
          file_size: number
          id?: string
          kind: string
          original_name: string
          title: string
          updated_at?: string
        }
        Update: {
          class_name?: string
          created_at?: string
          created_by?: string
          file_path?: string
          file_size?: number
          id?: string
          kind?: string
          original_name?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_resources_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      holidays: {
        Row: {
          holiday_date: string
          id: string
          label: string
          school_year: string
        }
        Insert: {
          holiday_date: string
          id?: string
          label: string
          school_year?: string
        }
        Update: {
          holiday_date?: string
          id?: string
          label?: string
          school_year?: string
        }
        Relationships: []
      }
      notes: {
        Row: {
          candidate_id: string
          created_at: string | null
          dictee: number | null
          ea_dessin: number | null
          ea_poesie: number | null
          eps: number | null
          es: number | null
          est: number | null
          expression_ecrite: number | null
          id: string
          lecture: number | null
          mathematique: number | null
          updated_at: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string | null
          dictee?: number | null
          ea_dessin?: number | null
          ea_poesie?: number | null
          eps?: number | null
          es?: number | null
          est?: number | null
          expression_ecrite?: number | null
          id?: string
          lecture?: number | null
          mathematique?: number | null
          updated_at?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string | null
          dictee?: number | null
          ea_dessin?: number | null
          ea_poesie?: number | null
          eps?: number | null
          es?: number | null
          est?: number | null
          expression_ecrite?: number | null
          id?: string
          lecture?: number | null
          mathematique?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notes_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          kind: string
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          kind?: string
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          class_name: string | null
          created_at: string | null
          display_name: string | null
          generated_password: string | null
          id: string
          identifier: string
          must_change_password: boolean | null
          phone: string | null
          photo_url: string | null
          school_name: string | null
          teacher_name: string | null
        }
        Insert: {
          class_name?: string | null
          created_at?: string | null
          display_name?: string | null
          generated_password?: string | null
          id: string
          identifier: string
          must_change_password?: boolean | null
          phone?: string | null
          photo_url?: string | null
          school_name?: string | null
          teacher_name?: string | null
        }
        Update: {
          class_name?: string | null
          created_at?: string | null
          display_name?: string | null
          generated_password?: string | null
          id?: string
          identifier?: string
          must_change_password?: boolean | null
          phone?: string | null
          photo_url?: string | null
          school_name?: string | null
          teacher_name?: string | null
        }
        Relationships: []
      }
      student_notes: {
        Row: {
          evaluation_key: string
          id: string
          note: number | null
          school_id: string
          school_year: string
          student_id: string
          subject_key: string
          updated_at: string
        }
        Insert: {
          evaluation_key: string
          id?: string
          note?: number | null
          school_id: string
          school_year?: string
          student_id: string
          subject_key: string
          updated_at?: string
        }
        Update: {
          evaluation_key?: string
          id?: string
          note?: number | null
          school_id?: string
          school_year?: string
          student_id?: string
          subject_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_notes_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_notes_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      students: {
        Row: {
          created_at: string
          ecole_provenance: string | null
          id: string
          matricule: string | null
          nom: string
          prenoms: string | null
          school_id: string
          school_year: string
          sexe: string | null
          sort_order: number
        }
        Insert: {
          created_at?: string
          ecole_provenance?: string | null
          id?: string
          matricule?: string | null
          nom: string
          prenoms?: string | null
          school_id: string
          school_year?: string
          sexe?: string | null
          sort_order?: number
        }
        Update: {
          created_at?: string
          ecole_provenance?: string | null
          id?: string
          matricule?: string | null
          nom?: string
          prenoms?: string | null
          school_id?: string
          school_year?: string
          sexe?: string | null
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "students_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      active_school_year: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      normalize_resource_class: { Args: { value: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "center" | "csbante" | "independent" | "school" | "prestataire"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      app_role: ["admin", "center", "csbante", "independent", "school", "prestataire"],
    },
  },
} as const
