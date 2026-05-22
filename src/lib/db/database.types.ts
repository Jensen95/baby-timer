export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	public: {
		Tables: {
			profiles: {
				Row: {
					id: string;
					display_name: string | null;
					created_at: string;
				};
				Insert: {
					id: string;
					display_name?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					display_name?: string | null;
					created_at?: string;
				};
			};
			families: {
				Row: {
					id: string;
					name: string;
					created_by: string;
					created_at: string;
				};
				Insert: {
					id?: string;
					name: string;
					created_by: string;
					created_at?: string;
				};
				Update: {
					id?: string;
					name?: string;
					created_by?: string;
					created_at?: string;
				};
			};
			family_members: {
				Row: {
					family_id: string;
					user_id: string;
					role: 'owner' | 'member';
					invited_at: string;
					joined_at: string | null;
				};
				Insert: {
					family_id: string;
					user_id: string;
					role?: 'owner' | 'member';
					invited_at?: string;
					joined_at?: string | null;
				};
				Update: {
					family_id?: string;
					user_id?: string;
					role?: 'owner' | 'member';
					invited_at?: string;
					joined_at?: string | null;
				};
			};
			babies: {
				Row: {
					id: string;
					family_id: string;
					name: string;
					birth_date: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					family_id: string;
					name: string;
					birth_date?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					family_id?: string;
					name?: string;
					birth_date?: string | null;
					created_at?: string;
				};
			};
			feeding_sessions: {
				Row: {
					id: string;
					baby_id: string;
					family_id: string;
					side: 'left' | 'right' | 'both';
					started_at: string;
					ended_at: string | null;
					duration_seconds: number | null;
					note: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					baby_id: string;
					family_id: string;
					side: 'left' | 'right' | 'both';
					started_at?: string;
					ended_at?: string | null;
					note?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					baby_id?: string;
					family_id?: string;
					side?: 'left' | 'right' | 'both';
					started_at?: string;
					ended_at?: string | null;
					note?: string | null;
					created_at?: string;
				};
			};
			sleep_sessions: {
				Row: {
					id: string;
					baby_id: string;
					family_id: string;
					side: 'left' | 'right' | 'back' | 'tummy';
					started_at: string;
					ended_at: string | null;
					duration_seconds: number | null;
					note: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					baby_id: string;
					family_id: string;
					side: 'left' | 'right' | 'back' | 'tummy';
					started_at?: string;
					ended_at?: string | null;
					note?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					baby_id?: string;
					family_id?: string;
					side?: 'left' | 'right' | 'back' | 'tummy';
					started_at?: string;
					ended_at?: string | null;
					note?: string | null;
					created_at?: string;
				};
			};
		};
		Views: Record<string, never>;
		Functions: {
			daily_summary: {
				Args: { p_baby_id: string; p_day: string };
				Returns: Array<{
					feed_count: number;
					feed_minutes: number;
					sleep_count: number;
					sleep_minutes: number;
				}>;
			};
			create_family: {
				Args: { family_name: string };
				Returns: {
					id: string;
					name: string;
					created_by: string;
					created_at: string;
				};
			};
		};
		Enums: {
			breast_side: 'left' | 'right' | 'both';
			head_side: 'left' | 'right' | 'back' | 'tummy';
			family_role: 'owner' | 'member';
		};
	};
};

export type Tables<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Row'];
export type Insert<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Insert'];
export type Update<T extends keyof Database['public']['Tables']> =
	Database['public']['Tables'][T]['Update'];
export type Enums<T extends keyof Database['public']['Enums']> = Database['public']['Enums'][T];
