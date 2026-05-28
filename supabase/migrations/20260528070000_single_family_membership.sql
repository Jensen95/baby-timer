create or replace function public.is_family_member(target_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
	select exists (
		select 1
		from public.family_members
		where family_id = target_family_id
			and user_id = auth.uid()
			and joined_at is not null
	);
$$;

create or replace function public.is_family_owner(target_family_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
	select exists (
		select 1
		from public.family_members
		where family_id = target_family_id
			and user_id = auth.uid()
			and role = 'owner'
			and joined_at is not null
	);
$$;

drop policy if exists "family members read" on public.families;
create policy "family members read"
	on public.families for select
	using (
		id in (
			select family_id
			from public.family_members
			where user_id = auth.uid()
				and joined_at is not null
		)
	);

drop policy if exists "family member baby access" on public.babies;
create policy "family member baby access"
	on public.babies for all
	using (
		family_id in (
			select family_id
			from public.family_members
			where user_id = auth.uid()
				and joined_at is not null
		)
	)
	with check (
		family_id in (
			select family_id
			from public.family_members
			where user_id = auth.uid()
				and joined_at is not null
		)
	);

create or replace function public.create_family(family_name text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
	new_family public.families;
begin
	if exists (
		select 1
		from public.family_members
		where user_id = auth.uid()
			and joined_at is not null
	) then
		raise exception 'You can only be part of one family at a time.';
	end if;

	insert into public.families (name, created_by)
	values (family_name, auth.uid())
	returning * into new_family;

	insert into public.family_members (family_id, user_id, role, joined_at)
	values (new_family.id, auth.uid(), 'owner', now());

	return new_family;
end;
$$;

create or replace function public.add_family_member_by_email(
	target_family_id uuid,
	target_email text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
	normalized_email text := lower(trim(target_email));
	target_user_id uuid;
begin
	if not public.is_family_owner(target_family_id) then
		raise exception 'Only family owners can invite members.';
	end if;

	if normalized_email = '' then
		raise exception 'Email is required.';
	end if;

	select id into target_user_id
	from auth.users
	where lower(email) = normalized_email
	limit 1;

	if target_user_id is not null then
		insert into public.family_members (family_id, user_id, role, joined_at)
		select target_family_id, target_user_id, 'member', null
		where not exists (
			select 1
			from public.family_members existing_membership
			where existing_membership.user_id = target_user_id
				and existing_membership.family_id <> target_family_id
				and existing_membership.joined_at is not null
		)
		on conflict (family_id, user_id) do nothing;
	else
		insert into public.family_invites (family_id, email)
		values (target_family_id, normalized_email)
		on conflict (family_id, email) do nothing;
	end if;

	return jsonb_build_object('invited', true);
end;
$$;

create or replace function public.accept_family_membership(target_family_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	if exists (
		select 1
		from public.family_members
		where user_id = auth.uid()
			and joined_at is not null
			and family_id <> target_family_id
	) then
		raise exception 'You can only be part of one family at a time.';
	end if;

	update public.family_members
	set joined_at = now()
	where family_id = target_family_id
		and user_id = auth.uid()
		and joined_at is null;

	if not found then
		raise exception 'No pending invitation found for this family.';
	end if;
end;
$$;

create or replace function public.join_family_by_code(code_input text)
returns uuid
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

	if exists (
		select 1
		from public.family_members
		where user_id = auth.uid()
			and joined_at is not null
			and family_id <> target_family_id
	) then
		raise exception 'You can only be part of one family at a time.';
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

	return target_family_id;
end;
$$;
