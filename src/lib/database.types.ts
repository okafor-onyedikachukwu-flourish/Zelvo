// Generated from the Supabase schema (stage 1). Regenerate after database changes.

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      classes: {
        Row: { created_at: string; id: string; name: string; school_id: string };
        Insert: { created_at?: string; id?: string; name: string; school_id: string };
        Update: { created_at?: string; id?: string; name?: string; school_id?: string };
        Relationships: [
          {
            foreignKeyName: 'classes_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      schools: {
        Row: {
          country: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          timezone: string;
        };
        Insert: {
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          timezone?: string;
        };
        Update: {
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          joined_at: string | null;
          role: string;
          school_id: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          id?: string;
          joined_at?: string | null;
          role?: string;
          school_id: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          joined_at?: string | null;
          role?: string;
          school_id?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_invites: {
        Row: { code: string; created_at: string; school_id: string; staff_id: string };
        Insert: { code: string; created_at?: string; school_id: string; staff_id: string };
        Update: { code?: string; created_at?: string; school_id?: string; staff_id?: string };
        Relationships: [
          {
            foreignKeyName: 'staff_invites_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_invites_staff_id_fkey';
            columns: ['staff_id'];
            isOneToOne: true;
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
      students: {
        Row: { class_id: string; created_at: string; full_name: string; id: string; school_id: string };
        Insert: { class_id: string; created_at?: string; full_name: string; id?: string; school_id: string };
        Update: { class_id?: string; created_at?: string; full_name?: string; id?: string; school_id?: string };
        Relationships: [
          {
            foreignKeyName: 'students_class_id_school_id_fkey';
            columns: ['class_id', 'school_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id', 'school_id'];
          },
          {
            foreignKeyName: 'students_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      subjects: {
        Row: { created_at: string; id: string; name: string; school_id: string };
        Insert: { created_at?: string; id?: string; name: string; school_id: string };
        Update: { created_at?: string; id?: string; name?: string; school_id?: string };
        Relationships: [
          {
            foreignKeyName: 'subjects_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      class_student_counts: {
        Args: { p_school: string };
        Returns: { class_id: string; students: number }[];
      };
      create_school: {
        Args: { p_admin_name: string; p_country?: string; p_name: string; p_timezone?: string };
        Returns: string;
      };
      join_school: { Args: { p_code: string }; Returns: string };
      regenerate_invite: { Args: { p_staff_id: string }; Returns: string };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
