export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
	public: {
		Tables: {
			family_invites: {
				Row: {
					id: string;
					family_id: string;
					email: string;
					invited_at: string;
				};
				Insert: {
					id?: string;
					family_id: string;
					email: string;
					invited_at?: string;
				};
				Update: {
					id?: string;
					family_id?: string;
					email?: string;
					invited_at?: string;
				};
			};
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
			breast_pump_sessions: {
				Row: {
					id: string;
					baby_id: string;
					family_id: string;
					side: 'left' | 'right' | 'both';
					started_at: string;
					ended_at: string | null;
					duration_seconds: number | null;
					yield_left_ml: number | null;
					yield_right_ml: number | null;
					note: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					baby_id: string;
					family_id: string;
					side?: 'left' | 'right' | 'both';
					started_at?: string;
					ended_at?: string | null;
					yield_left_ml?: number | null;
					yield_right_ml?: number | null;
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
					yield_left_ml?: number | null;
					yield_right_ml?: number | null;
					note?: string | null;
					created_at?: string;
				};
			};
			diaper_change_sessions: {
				Row: {
					id: string;
					baby_id: string;
					family_id: string;
					started_at: string;
					has_poop: boolean;
					has_pee: boolean;
					note: string | null;
					created_at: string;
				};
				Insert: {
					id?: string;
					baby_id: string;
					family_id: string;
					started_at?: string;
					has_poop?: boolean;
					has_pee?: boolean;
					note?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					baby_id?: string;
					family_id?: string;
					started_at?: string;
					has_poop?: boolean;
					has_pee?: boolean;
					note?: string | null;
					created_at?: string;
				};
			};
			sleep_sessions: {
				Row: {
					id: string;
					baby_id: string;
					family_id: string;
					side: 'left' | 'right' | 'back' | 'tummy' | 'side';
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
					side: 'left' | 'right' | 'back' | 'tummy' | 'side';
					started_at?: string;
					ended_at?: string | null;
					note?: string | null;
					created_at?: string;
				};
				Update: {
					id?: string;
					baby_id?: string;
					family_id?: string;
					side?: 'left' | 'right' | 'back' | 'tummy' | 'side';
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
			add_family_member_by_email: {
				Args: { target_family_id: string; target_email: string };
				Returns: Json;
			};
			accept_family_membership: {
				Args: { target_family_id: string };
				Returns: void;
			};
			decline_family_membership: {
				Args: { target_family_id: string };
				Returns: void;
			};
			get_pending_memberships: {
				Args: Record<string, never>;
				Returns: Array<{
					family_id: string;
					family_name: string;
					invited_at: string;
					invited_by: string | null;
				}>;
			};
			list_family_members_with_profiles: {
				Args: { target_family_id: string };
				Returns: Array<{
					user_id: string | null;
					role: 'owner' | 'member';
					invited_at: string;
					joined_at: string | null;
					display_name: string | null;
					email: string | null;
					status: 'joined' | 'pending' | 'invited';
				}>;
			};
		};
		Enums: {
			breast_side: 'left' | 'right' | 'both';
			head_side: 'left' | 'right' | 'back' | 'tummy' | 'side';
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
