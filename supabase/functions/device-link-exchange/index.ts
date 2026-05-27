import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL')!,
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

type ExchangePayload = {
	pollToken?: string;
};

Deno.serve(async (req: Request) => {
	if (req.method === 'OPTIONS') {
		return new Response('ok', {
			headers: {
				...corsHeaders,
				'Access-Control-Allow-Methods': 'POST, OPTIONS'
			}
		});
	}

	if (req.method !== 'POST') {
		return new Response('Method not allowed', {
			status: 405,
			headers: corsHeaders
		});
	}

	let payload: ExchangePayload;
	try {
		payload = await req.json();
	} catch {
		return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
			status: 400,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	const pollToken = payload.pollToken?.trim();
	if (!pollToken) {
		return new Response(JSON.stringify({ error: 'Missing pollToken' }), {
			status: 400,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	const { data: sessionRow, error: sessionError } = await supabase
		.from('device_link_sessions')
		.select('id, requester_user_id, approved_at, consumed_at, denied_at, expires_at')
		.eq('poll_token', pollToken)
		.maybeSingle();

	if (sessionError) {
		return new Response(JSON.stringify({ error: sessionError.message }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	if (!sessionRow) {
		return new Response(JSON.stringify({ status: 'not_found' }), {
			status: 404,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	if (sessionRow.consumed_at) {
		return new Response(JSON.stringify({ status: 'consumed' }), {
			status: 409,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	if (sessionRow.denied_at) {
		return new Response(JSON.stringify({ status: 'denied' }), {
			status: 409,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	if (!sessionRow.approved_at) {
		return new Response(JSON.stringify({ status: 'pending' }), {
			status: 409,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	if (new Date(sessionRow.expires_at).getTime() <= Date.now()) {
		return new Response(JSON.stringify({ status: 'expired' }), {
			status: 409,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	if (!sessionRow.requester_user_id) {
		return new Response(JSON.stringify({ error: 'Missing requester_user_id' }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	const { data: requesterUser, error: requesterError } = await supabase.auth.admin.getUserById(
		sessionRow.requester_user_id
	);

	if (requesterError || !requesterUser.user?.email) {
		return new Response(
			JSON.stringify({ error: requesterError?.message ?? 'User lookup failed' }),
			{
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			}
		);
	}

	const appUrl = Deno.env.get('APP_URL') ?? 'https://your-app.github.io';
	const redirectTo = `${appUrl}/app`;

	const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
		type: 'magiclink',
		email: requesterUser.user.email,
		options: {
			redirectTo
		}
	});

	if (linkError || !linkData.properties?.action_link) {
		return new Response(
			JSON.stringify({ error: linkError?.message ?? 'Failed to generate link' }),
			{
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' }
			}
		);
	}

	const { error: consumeError } = await supabase
		.from('device_link_sessions')
		.update({ consumed_at: new Date().toISOString() })
		.eq('id', sessionRow.id)
		.is('consumed_at', null)
		.is('denied_at', null);

	if (consumeError) {
		return new Response(JSON.stringify({ error: consumeError.message }), {
			status: 500,
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		});
	}

	return new Response(
		JSON.stringify({ status: 'approved', actionLink: linkData.properties.action_link }),
		{
			headers: { ...corsHeaders, 'Content-Type': 'application/json' }
		}
	);
});
