-- QR-based family invite codes and device-link pairing sessions.

create table public.family_invite_codes (
	id uuid primary key default gen_random_uuid(),
	family_id uuid not null references public.families(id) on delete cascade,
	code_hash text not null,
	code_hint text not null,
	created_by uuid not null references auth.users(id) on delete cascade,
	created_at timestamptz not null default now(),
	expires_at timestamptz not null,
	max_uses integer not null default 25 check (max_uses > 0),
	uses integer not null default 0 check (uses >= 0),
	revoked_at timestamptz
);

create index family_invite_codes_family_id_idx
	on public.family_invite_codes (family_id, created_at desc);

create unique index family_invite_codes_active_hash_idx
	on public.family_invite_codes (family_id, code_hash)
	where revoked_at is null;

alter table public.family_invite_codes enable row level security;

create policy "family owner can manage invite codes"
	on public.family_invite_codes for all
	using (public.is_family_owner(family_id))
	with check (public.is_family_owner(family_id));

create policy "family member can read invite codes"
	on public.family_invite_codes for select
	using (public.is_family_member(family_id));

create table public.device_link_sessions (
	id uuid primary key default gen_random_uuid(),
	requester_user_id uuid references auth.users(id) on delete cascade,
	requester_family_id uuid references public.families(id) on delete set null,
	device_label text,
	user_code_hash text not null,
	user_code_hint text not null,
	approval_qr_token uuid not null unique default gen_random_uuid(),
	poll_token uuid not null unique default gen_random_uuid(),
	created_at timestamptz not null default now(),
	expires_at timestamptz not null,
	approved_at timestamptz,
	approved_by_user_id uuid references auth.users(id) on delete set null,
	consumed_at timestamptz,
	denied_at timestamptz,
	denied_by_user_id uuid references auth.users(id) on delete set null,
	attempt_count integer not null default 0 check (attempt_count >= 0),
	last_attempt_at timestamptz
);

create index device_link_sessions_requester_idx
	on public.device_link_sessions (requester_user_id, created_at desc);

create index device_link_sessions_active_expiry_idx
	on public.device_link_sessions (expires_at)
	where consumed_at is null and denied_at is null;

create index device_link_sessions_poll_token_idx
	on public.device_link_sessions (poll_token);

alter table public.device_link_sessions enable row level security;

create policy "requester can read own device sessions"
	on public.device_link_sessions for select
	using (requester_user_id = auth.uid());

create policy "family members can read pending device sessions"
	on public.device_link_sessions for select
	using (
		requester_family_id in (
			select family_id
			from public.family_members
			where user_id = auth.uid()
		)
		and denied_at is null
		and consumed_at is null
	);

create policy "family members can update pending device sessions"
	on public.device_link_sessions for update
	using (
		requester_family_id in (
			select family_id
			from public.family_members
			where user_id = auth.uid()
		)
	)
	with check (
		requester_family_id in (
			select family_id
			from public.family_members
			where user_id = auth.uid()
		)
	);

create or replace function public.normalize_short_code(raw text)
returns text
language sql
immutable
as $$
	select upper(regexp_replace(coalesce(raw, ''), '[^A-Z0-9]', '', 'g'));
$$;

create or replace function public.short_code_hash(raw text)
returns text
language sql
immutable
as $$
	select encode(digest(public.normalize_short_code(raw), 'sha256'), 'hex');
$$;

create or replace function public.generate_short_code()
returns text
language sql
volatile
as $$
	select upper(substr(encode(gen_random_bytes(6), 'hex'), 1, 8));
$$;

create or replace function public.create_family_invite_code(
	target_family_id uuid,
	ttl_minutes integer default 60,
	max_uses integer default 25
)
returns table (
	code_id uuid,
	code text,
	expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
	generated_code text;
	generated_hash text;
	effective_ttl integer := greatest(5, least(coalesce(ttl_minutes, 60), 10080));
	effective_max_uses integer := greatest(1, least(coalesce(max_uses, 25), 1000));
begin
	if not public.is_family_owner(target_family_id) then
		raise exception 'Only family owners can generate invite codes.';
	end if;

	loop
		begin
			generated_code := public.generate_short_code();
			generated_hash := public.short_code_hash(generated_code);

			insert into public.family_invite_codes (
				family_id,
				code_hash,
				code_hint,
				created_by,
				expires_at,
				max_uses
			)
			values (
				target_family_id,
				generated_hash,
				right(generated_code, 4),
				auth.uid(),
				now() + make_interval(mins => effective_ttl),
				effective_max_uses
			)
			returning id, family_invite_codes.expires_at into code_id, expires_at;

			code := generated_code;
			return next;
			return;
		exception
			when unique_violation then
				-- retry on rare collisions
		end;
	end loop;
end;
$$;

create or replace function public.list_active_family_invite_codes(target_family_id uuid)
returns table (
	code_id uuid,
	code_hint text,
	created_at timestamptz,
	expires_at timestamptz,
	max_uses integer,
	uses integer
)
language sql
security definer
stable
set search_path = public
as $$
	select
		fic.id,
		fic.code_hint,
		fic.created_at,
		fic.expires_at,
		fic.max_uses,
		fic.uses
	from public.family_invite_codes fic
	where fic.family_id = target_family_id
		and fic.revoked_at is null
		and fic.expires_at > now()
		and fic.uses < fic.max_uses
		and public.is_family_member(target_family_id)
	order by fic.created_at desc;
$$;

create or replace function public.revoke_family_invite_code(
	target_family_id uuid,
	target_code_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	if not public.is_family_owner(target_family_id) then
		raise exception 'Only family owners can revoke invite codes.';
	end if;

	update public.family_invite_codes
	set revoked_at = now()
	where id = target_code_id
		and family_id = target_family_id
		and revoked_at is null;

	if not found then
		raise exception 'Invite code not found.';
	end if;
end;
$$;

create or replace function public.join_family_by_code(code_input text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	target_code_hash text := public.short_code_hash(code_input);
	target_family_id uuid;
begin
	select fic.family_id
	into target_family_id
	from public.family_invite_codes fic
	where fic.code_hash = target_code_hash
		and fic.revoked_at is null
		and fic.expires_at > now()
		and fic.uses < fic.max_uses
	limit 1;

	if target_family_id is null then
		raise exception 'Invalid or expired invite code.';
	end if;

	insert into public.family_members (family_id, user_id, role, joined_at)
	values (target_family_id, auth.uid(), 'member', now())
	on conflict (family_id, user_id)
	do update
	set joined_at = coalesce(public.family_members.joined_at, now());

	update public.family_invite_codes
	set uses = uses + 1
	where family_id = target_family_id
		and code_hash = target_code_hash
		and revoked_at is null
		and expires_at > now()
		and uses < max_uses;

	if not found then
		raise exception 'Invalid or expired invite code.';
	end if;
end;
$$;

create or replace function public.create_device_link_request(
	device_label text default null,
	ttl_minutes integer default 10
)
returns table (
	request_id uuid,
	user_code text,
	approval_qr_token uuid,
	poll_token uuid,
	expires_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
	generated_code text;
	generated_hash text;
	effective_ttl integer := greatest(3, least(coalesce(ttl_minutes, 10), 30));
	resolved_family_id uuid;
begin
	select fm.family_id
	into resolved_family_id
	from public.family_members fm
	where fm.user_id = auth.uid()
		and fm.joined_at is not null
	order by fm.invited_at
	limit 1;

	loop
		begin
			generated_code := public.generate_short_code();
			generated_hash := public.short_code_hash(generated_code);

			insert into public.device_link_sessions (
				requester_user_id,
				requester_family_id,
				device_label,
				user_code_hash,
				user_code_hint,
				expires_at
			)
			values (
				auth.uid(),
				resolved_family_id,
				device_label,
				generated_hash,
				right(generated_code, 4),
				now() + make_interval(mins => effective_ttl)
			)
			returning
				id,
				device_link_sessions.approval_qr_token,
				device_link_sessions.poll_token,
				device_link_sessions.expires_at
			into
				request_id,
				create_device_link_request.approval_qr_token,
				create_device_link_request.poll_token,
				create_device_link_request.expires_at;

			user_code := generated_code;

			return next;
			return;
		exception
			when unique_violation then
				-- retry on rare collisions
				null;
		end;
	end loop;
end;
$$;

create or replace function public.get_device_link_status(input_poll_token uuid)
returns table (
	status text,
	expires_at timestamptz,
	approved_at timestamptz,
	denied_at timestamptz,
	approved_by_user_id uuid
)
language sql
security definer
stable
set search_path = public
as $$
	select
		case
			when dls.consumed_at is not null then 'consumed'
			when dls.denied_at is not null then 'denied'
			when dls.expires_at <= now() then 'expired'
			when dls.approved_at is not null then 'approved'
			else 'pending'
		end as status,
		dls.expires_at,
		dls.approved_at,
		dls.denied_at,
		dls.approved_by_user_id
	from public.device_link_sessions dls
	where dls.poll_token = input_poll_token
	limit 1;
$$;

create or replace function public.approve_device_link_by_qr(input_approval_qr_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	resolved_family_id uuid;
begin
	if auth.uid() is null then
		raise exception 'Authentication required.';
	end if;

	select fm.family_id
	into resolved_family_id
	from public.family_members fm
	where fm.user_id = auth.uid()
		and fm.joined_at is not null
	order by fm.invited_at
	limit 1;

	update public.device_link_sessions dls
	set
		requester_user_id = coalesce(dls.requester_user_id, auth.uid()),
		requester_family_id = coalesce(dls.requester_family_id, resolved_family_id),
		approved_at = now(),
		approved_by_user_id = auth.uid(),
		denied_at = null,
		denied_by_user_id = null
	where dls.approval_qr_token = input_approval_qr_token
		and dls.approved_at is null
		and dls.denied_at is null
		and dls.consumed_at is null
		and dls.expires_at > now();

	if not found then
		raise exception 'Request not found or no longer valid.';
	end if;
end;
$$;

create or replace function public.approve_device_link_by_code(input_user_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	target_hash text := public.short_code_hash(input_user_code);
	resolved_family_id uuid;
begin
	if auth.uid() is null then
		raise exception 'Authentication required.';
	end if;

	select fm.family_id
	into resolved_family_id
	from public.family_members fm
	where fm.user_id = auth.uid()
		and fm.joined_at is not null
	order by fm.invited_at
	limit 1;

	update public.device_link_sessions dls
	set
		requester_user_id = coalesce(dls.requester_user_id, auth.uid()),
		requester_family_id = coalesce(dls.requester_family_id, resolved_family_id),
		approved_at = now(),
		approved_by_user_id = auth.uid(),
		denied_at = null,
		denied_by_user_id = null,
		attempt_count = dls.attempt_count + 1,
		last_attempt_at = now()
	where dls.user_code_hash = target_hash
		and dls.approved_at is null
		and dls.denied_at is null
		and dls.consumed_at is null
		and dls.expires_at > now();

	if not found then
		raise exception 'Request not found or no longer valid.';
	end if;
end;
$$;

create or replace function public.deny_device_link_request(input_poll_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	if auth.uid() is null then
		raise exception 'Authentication required.';
	end if;

	update public.device_link_sessions dls
	set
		denied_at = now(),
		denied_by_user_id = auth.uid()
	where dls.poll_token = input_poll_token
		and dls.denied_at is null
		and dls.consumed_at is null
		and dls.expires_at > now();

	if not found then
		raise exception 'Request not found or no longer valid.';
	end if;
end;
$$;

create or replace function public.consume_device_link_request(input_poll_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	session_row public.device_link_sessions%rowtype;
begin
	select *
	into session_row
	from public.device_link_sessions
	where poll_token = input_poll_token
	limit 1;

	if session_row.id is null then
		return jsonb_build_object('status', 'not_found');
	end if;

	if session_row.consumed_at is not null then
		return jsonb_build_object('status', 'consumed');
	end if;

	if session_row.denied_at is not null then
		return jsonb_build_object('status', 'denied');
	end if;

	if session_row.expires_at <= now() then
		return jsonb_build_object('status', 'expired');
	end if;

	if session_row.approved_at is null then
		update public.device_link_sessions
		set attempt_count = attempt_count + 1,
			last_attempt_at = now()
		where id = session_row.id;
		return jsonb_build_object('status', 'pending');
	end if;

	update public.device_link_sessions
	set consumed_at = now()
	where id = session_row.id
		and consumed_at is null;

	return jsonb_build_object(
		'status', 'approved',
		'user_id', session_row.requester_user_id,
		'approved_by_user_id', session_row.approved_by_user_id
	);
end;
$$;
