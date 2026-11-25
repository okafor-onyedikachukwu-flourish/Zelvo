// Generated from the Supabase schema, then kept up to date by hand. Regenerate after database changes.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.18';
  };
  public: {
    Tables: {
      announcements: {
        Row: {
          body: string;
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          stopped_at: string | null;
          title: string;
        };
        Insert: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          stopped_at?: string | null;
          title: string;
        };
        Update: {
          body?: string;
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          stopped_at?: string | null;
          title?: string;
        };
        Relationships: [];
      };
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
      exams: {
        Row: {
          answer_key: string;
          class_id: string;
          created_at: string;
          created_by: string | null;
          exam_date: string | null;
          id: string;
          mark_per_question: number;
          option_count: number;
          question_count: number;
          record_out_of: number | null;
          results_released: boolean;
          school_id: string;
          subject_id: string;
          title: string;
          updated_at: string;
        };
        Insert: {
          answer_key: string;
          class_id: string;
          created_at?: string;
          created_by?: string | null;
          exam_date?: string | null;
          id?: string;
          mark_per_question?: number;
          option_count?: number;
          question_count: number;
          record_out_of?: number | null;
          results_released?: boolean;
          school_id: string;
          subject_id: string;
          title: string;
          updated_at?: string;
        };
        Update: {
          answer_key?: string;
          class_id?: string;
          created_at?: string;
          created_by?: string | null;
          exam_date?: string | null;
          id?: string;
          mark_per_question?: number;
          option_count?: number;
          question_count?: number;
          record_out_of?: number | null;
          results_released?: boolean;
          school_id?: string;
          subject_id?: string;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'exams_class_id_school_id_fkey';
            columns: ['class_id', 'school_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id', 'school_id'];
          },
          {
            foreignKeyName: 'exams_subject_id_school_id_fkey';
            columns: ['subject_id', 'school_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id', 'school_id'];
          },
          {
            foreignKeyName: 'exams_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      lessons: {
        Row: {
          class_id: string;
          created_at: string;
          day: number;
          id: string;
          period_id: string;
          room: string | null;
          school_id: string;
          subject_id: string;
          teacher_id: string | null;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          day: number;
          id?: string;
          period_id: string;
          room?: string | null;
          school_id: string;
          subject_id: string;
          teacher_id?: string | null;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          day?: number;
          id?: string;
          period_id?: string;
          room?: string | null;
          school_id?: string;
          subject_id?: string;
          teacher_id?: string | null;
        };
        Relationships: [];
      };
      periods: {
        Row: {
          created_at: string;
          ends_at: string;
          id: string;
          is_break: boolean;
          label: string;
          position: number;
          school_id: string;
          starts_at: string;
        };
        Insert: {
          created_at?: string;
          ends_at: string;
          id?: string;
          is_break?: boolean;
          label: string;
          position: number;
          school_id: string;
          starts_at: string;
        };
        Update: {
          created_at?: string;
          ends_at?: string;
          id?: string;
          is_break?: boolean;
          label?: string;
          position?: number;
          school_id?: string;
          starts_at?: string;
        };
        Relationships: [];
      };
      schools: {
        Row: {
          country: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          name: string;
          school_days: number[];
          suspended_at: string | null;
          suspended_reason: string | null;
          timezone: string;
        };
        Insert: {
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name: string;
          school_days?: number[];
          suspended_at?: string | null;
          suspended_reason?: string | null;
          timezone?: string;
        };
        Update: {
          country?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          name?: string;
          school_days?: number[];
          suspended_at?: string | null;
          suspended_reason?: string | null;
          timezone?: string;
        };
        Relationships: [];
      };
      scripts: {
        Row: {
          answers: string;
          created_at: string;
          exam_id: string;
          id: string;
          pages_scanned: number[];
          scanned_by: string | null;
          school_id: string;
          student_id: string | null;
          student_name: string | null;
          updated_at: string;
        };
        Insert: {
          answers: string;
          created_at?: string;
          exam_id: string;
          id: string;
          pages_scanned?: number[];
          scanned_by?: string | null;
          school_id: string;
          student_id?: string | null;
          student_name?: string | null;
          updated_at?: string;
        };
        Update: {
          answers?: string;
          created_at?: string;
          exam_id?: string;
          id?: string;
          pages_scanned?: number[];
          scanned_by?: string | null;
          school_id?: string;
          student_id?: string | null;
          student_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'scripts_exam_id_school_id_fkey';
            columns: ['exam_id', 'school_id'];
            isOneToOne: false;
            referencedRelation: 'exams';
            referencedColumns: ['id', 'school_id'];
          },
          {
            foreignKeyName: 'scripts_student_id_school_id_fkey';
            columns: ['student_id', 'school_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id', 'school_id'];
          },
        ];
      };
      staff: {
        Row: {
          created_at: string;
          full_name: string;
          head_title: string | null;
          id: string;
          joined_at: string | null;
          role: string;
          school_id: string;
          subject_id: string | null;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          full_name: string;
          head_title?: string | null;
          id?: string;
          joined_at?: string | null;
          role?: string;
          school_id: string;
          subject_id?: string | null;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          head_title?: string | null;
          id?: string;
          joined_at?: string | null;
          role?: string;
          school_id?: string;
          subject_id?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_subject_school_fkey';
            columns: ['subject_id', 'school_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id', 'school_id'];
          },
          {
            foreignKeyName: 'staff_school_id_fkey';
            columns: ['school_id'];
            isOneToOne: false;
            referencedRelation: 'schools';
            referencedColumns: ['id'];
          },
        ];
      };
      student_invites: {
        Row: { code: string; created_at: string; created_by: string | null; email: string; school_id: string; student_id: string };
        Insert: { code: string; created_at?: string; created_by?: string | null; email: string; school_id: string; student_id: string };
        Update: { code?: string; created_at?: string; created_by?: string | null; email?: string; school_id?: string; student_id?: string };
        Relationships: [];
      };
      staff_requests: {
        Row: {
          applied_as: string;
          created_at: string;
          decided_by: string | null;
          full_name: string;
          id: string;
          school_id: string;
          status: string;
          subject_ids: string[];
          user_id: string;
        };
        Insert: {
          applied_as: string;
          created_at?: string;
          decided_by?: string | null;
          full_name: string;
          id?: string;
          school_id: string;
          status?: string;
          subject_ids?: string[];
          user_id?: string;
        };
        Update: {
          applied_as?: string;
          created_at?: string;
          decided_by?: string | null;
          full_name?: string;
          id?: string;
          school_id?: string;
          status?: string;
          subject_ids?: string[];
          user_id?: string;
        };
        Relationships: [];
      };
      staff_subjects: {
        Row: { school_id: string; staff_id: string; subject_id: string };
        Insert: { school_id: string; staff_id: string; subject_id: string };
        Update: { school_id?: string; staff_id?: string; subject_id?: string };
        Relationships: [
          {
            foreignKeyName: 'staff_subjects_subject_id_school_id_fkey';
            columns: ['subject_id', 'school_id'];
            isOneToOne: false;
            referencedRelation: 'subjects';
            referencedColumns: ['id', 'school_id'];
          },
          {
            foreignKeyName: 'staff_subjects_staff_id_school_id_fkey';
            columns: ['staff_id', 'school_id'];
            isOneToOne: false;
            referencedRelation: 'staff';
            referencedColumns: ['id', 'school_id'];
          },
        ];
      };
      staff_invites: {
        Row: { code: string; created_at: string; email: string | null; school_id: string; staff_id: string };
        Insert: { code: string; created_at?: string; email?: string | null; school_id: string; staff_id: string };
        Update: { code?: string; created_at?: string; email?: string | null; school_id?: string; staff_id?: string };
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
      student_accounts: {
        Row: {
          class_id: string;
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          id: string;
          school_id: string;
          status: string;
          student_id: string | null;
          typed_name: string;
          user_id: string;
        };
        Insert: {
          class_id: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          school_id: string;
          status?: string;
          student_id?: string | null;
          typed_name: string;
          user_id?: string;
        };
        Update: {
          class_id?: string;
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          id?: string;
          school_id?: string;
          status?: string;
          student_id?: string | null;
          typed_name?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'student_accounts_class_id_school_id_fkey';
            columns: ['class_id', 'school_id'];
            isOneToOne: false;
            referencedRelation: 'classes';
            referencedColumns: ['id', 'school_id'];
          },
          {
            foreignKeyName: 'student_accounts_student_id_school_id_fkey';
            columns: ['student_id', 'school_id'];
            isOneToOne: false;
            referencedRelation: 'students';
            referencedColumns: ['id', 'school_id'];
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
      confirm_new_student: { Args: { p_request: string }; Returns: undefined };
      decide_staff_request: { Args: { p_request: string; p_approve: boolean }; Returns: undefined };
      decide_student_access: { Args: { p_request: string; p_student: string | null; p_approve: boolean }; Returns: undefined };
      exam_performance: {
        Args: { p_school: string };
        Returns: {
          exam_id: string;
          title: string;
          exam_date: string | null;
          created_at: string;
          class_id: string;
          class_name: string;
          subject_id: string;
          subject_name: string;
          scripts: number;
          average: number | null;
          highest: number | null;
          lowest: number | null;
        }[];
      };
      find_schools: { Args: { p_query: string }; Returns: { id: string; name: string; country: string | null }[] };
      import_lessons: { Args: { p_school: string; p_lessons: Json; p_replace: boolean }; Returns: number };
      is_platform_admin: { Args: Record<string, never>; Returns: boolean };
      join_class: { Args: { p_school: string; p_class: string; p_name: string }; Returns: string };
      join_as_student: { Args: { p_code: string }; Returns: string };
      join_school: { Args: { p_code: string }; Returns: string };
      my_results: {
        Args: Record<string, never>;
        Returns: {
          exam_id: string;
          school_id: string;
          title: string;
          subject: string;
          exam_date: string | null;
          question_count: number;
          option_count: number;
          mark_per_question: number;
          record_out_of: number | null;
          answer_key: string;
          answers: string;
          updated_at: string;
        }[];
      };
      my_timetable: {
        Args: Record<string, never>;
        Returns: {
          school_id: string;
          class_id: string;
          day: number;
          period_no: number;
          label: string;
          starts_at: string;
          ends_at: string;
          is_break: boolean;
          subject: string;
          teacher: string | null;
          room: string | null;
        }[];
      };
      my_staff_requests: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          school_id: string;
          school_name: string;
          full_name: string;
          applied_as: string;
          subject_names: string[];
          status: string;
          created_at: string;
        }[];
      };
      my_student_accounts: {
        Args: Record<string, never>;
        Returns: {
          id: string;
          school_id: string;
          school_name: string;
          class_id: string;
          class_name: string;
          typed_name: string;
          student_name: string | null;
          status: string;
          school_suspended: boolean;
        }[];
      };
      owner_school: { Args: { p_school: string }; Returns: Json };
      owner_stats: { Args: Record<string, never>; Returns: Json };
      peek_code: {
        Args: { p_code: string };
        Returns: {
          kind: string;
          school_name: string;
          person_name: string;
          role: string;
          subject_name: string | null;
          class_name: string | null;
          email: string | null;
        }[];
      };
      platform_overview: {
        Args: Record<string, never>;
        Returns: {
          school_id: string;
          name: string;
          country: string | null;
          created_at: string;
          staff: number;
          staff_joined: number;
          students: number;
          student_accounts: number;
          exams: number;
          scripts: number;
          suspended: boolean;
          last_active: string | null;
        }[];
      };
      record_activity: { Args: { p_build: number | null; p_platform: string }; Returns: undefined };
      record_scan: {
        Args: {
          p_answers: string;
          p_exam_id: string;
          p_first: number;
          p_page: number;
          p_script_id: string;
          p_student_id: string | null;
          p_student_name: string | null;
        };
        Returns: string;
      };
      regenerate_invite: { Args: { p_staff_id: string }; Returns: string };
      request_staff_access: {
        Args: { p_school: string; p_applied_as: string; p_name: string; p_subjects?: string[] };
        Returns: string;
      };
      request_student_access: { Args: { p_school: string; p_class: string; p_name: string }; Returns: string };
      send_student_code: { Args: { p_student: string; p_email: string; p_new?: boolean }; Returns: string };
      set_school_suspended: { Args: { p_school: string; p_suspend: boolean; p_reason?: string | null }; Returns: undefined };
      set_bell_times: { Args: { p_school: string; p_periods: Json }; Returns: undefined };
      set_invite_email: { Args: { p_staff_id: string; p_email: string | null }; Returns: undefined };
      school_openings: { Args: { p_school: string }; Returns: { has_vp: boolean; full_departments: string[] }[] };
      school_staff_requests: {
        Args: { p_school: string };
        Returns: {
          id: string;
          full_name: string;
          email: string;
          applied_as: string;
          subject_names: string[];
          created_at: string;
        }[];
      };
      school_subjects: { Args: { p_school: string }; Returns: { id: string; name: string }[] };
      school_classes: { Args: { p_school: string }; Returns: { id: string; name: string }[] };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
