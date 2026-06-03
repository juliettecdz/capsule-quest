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
      album_feedback: {
        Row: {
          capsule_id: string
          created_at: string
          id: string
          rating: number
          style: string
          user_id: string
        }
        Insert: {
          capsule_id: string
          created_at?: string
          id?: string
          rating: number
          style: string
          user_id: string
        }
        Update: {
          capsule_id?: string
          created_at?: string
          id?: string
          rating?: number
          style?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "album_feedback_capsule_id_fkey"
            columns: ["capsule_id"]
            isOneToOne: false
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
        ]
      }
      capsule_members: {
        Row: {
          capsule_id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          capsule_id: string
          joined_at?: string
          user_id: string
        }
        Update: {
          capsule_id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "capsule_members_capsule_id_fkey"
            columns: ["capsule_id"]
            isOneToOne: false
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
        ]
      }
      capsules: {
        Row: {
          admin_id: string
          cover_url: string | null
          created_at: string
          id: string
          max_uploads: number
          status: Database["public"]["Enums"]["capsule_status"]
          title: string
          type: Database["public"]["Enums"]["capsule_type"]
          unlock_at: string
        }
        Insert: {
          admin_id: string
          cover_url?: string | null
          created_at?: string
          id?: string
          max_uploads?: number
          status?: Database["public"]["Enums"]["capsule_status"]
          title: string
          type?: Database["public"]["Enums"]["capsule_type"]
          unlock_at: string
        }
        Update: {
          admin_id?: string
          cover_url?: string | null
          created_at?: string
          id?: string
          max_uploads?: number
          status?: Database["public"]["Enums"]["capsule_status"]
          title?: string
          type?: Database["public"]["Enums"]["capsule_type"]
          unlock_at?: string
        }
        Relationships: []
      }
      media_items: {
        Row: {
          capsule_id: string
          created_at: string
          duration_ms: number | null
          file_path: string
          id: string
          kind: Database["public"]["Enums"]["media_kind"]
          mime_type: string | null
          user_id: string
        }
        Insert: {
          capsule_id: string
          created_at?: string
          duration_ms?: number | null
          file_path: string
          id?: string
          kind: Database["public"]["Enums"]["media_kind"]
          mime_type?: string | null
          user_id: string
        }
        Update: {
          capsule_id?: string
          created_at?: string
          duration_ms?: number | null
          file_path?: string
          id?: string
          kind?: Database["public"]["Enums"]["media_kind"]
          mime_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_items_capsule_id_fkey"
            columns: ["capsule_id"]
            isOneToOne: false
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          capsule_id: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          capsule_id: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          capsule_id?: string
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_capsule_id_fkey"
            columns: ["capsule_id"]
            isOneToOne: false
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          username: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          username: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          username?: string
        }
        Relationships: []
      }
    }
    Views: {
      media_notifications: {
        Row: {
          capsule_id: string | null
          created_at: string | null
          id: string | null
          user_id: string | null
        }
        Insert: {
          capsule_id?: string | null
          created_at?: string | null
          id?: string | null
          user_id?: string | null
        }
        Update: {
          capsule_id?: string | null
          created_at?: string | null
          id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "media_items_capsule_id_fkey"
            columns: ["capsule_id"]
            isOneToOne: false
            referencedRelation: "capsules"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      capsule_can_upload: {
        Args: { _capsule: string; _user: string }
        Returns: boolean
      }
      is_capsule_admin: {
        Args: { _capsule: string; _user: string }
        Returns: boolean
      }
      is_capsule_member: {
        Args: { _capsule: string; _user: string }
        Returns: boolean
      }
      is_capsule_revealed: { Args: { _capsule: string }; Returns: boolean }
    }
    Enums: {
      capsule_status: "active" | "sealed" | "revealed"
      capsule_type: "standard" | "transformation" | "individual"
      media_kind: "photo" | "video" | "voice"
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
      capsule_status: ["active", "sealed", "revealed"],
      capsule_type: ["standard", "transformation", "individual"],
      media_kind: ["photo", "video", "voice"],
    },
  },
} as const
