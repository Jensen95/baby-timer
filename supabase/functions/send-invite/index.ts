import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL')!,
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);

interface InvitePayload {
	familyId: string;
	inviteeEmail: string;
	familyName: string;
}

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

	let payload: InvitePayload;
	try {
		payload = await req.json();
	} catch {
		return new Response('Invalid JSON', {
			status: 400,
			headers: corsHeaders
		});
	}

	const { familyId, inviteeEmail, familyName } = payload;

	if (!familyId || !inviteeEmail) {
		return new Response('Missing required fields', {
			status: 400,
			headers: corsHeaders
		});
	}

	// In production: use Resend / SendGrid / Supabase Auth admin to send magic link email
	// For now, log the invite and return success
	console.log(`Invite: ${inviteeEmail} invited to family "${familyName}" (${familyId})`);

	// Generate a magic link via Supabase Auth admin API
	const { data: magicLinkData, error: magicLinkError } = await supabase.auth.admin.generateLink({
		type: 'magiclink',
		email: inviteeEmail,
		options: {
			redirectTo: `${Deno.env.get('APP_URL') ?? 'https://your-app.github.io'}/app/family`
		}
	});

	if (magicLinkError) {
		console.error('Failed to generate magic link:', magicLinkError);
		// Don't fail the whole request — the invite row was created, just email failed
		return new Response(
			JSON.stringify({ success: true, emailSent: false, error: magicLinkError.message }),
			{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
		);
	}

	const magicLink = magicLinkData.properties?.action_link;
	console.log(`Magic link for ${inviteeEmail}: ${magicLink}`);

	// TODO: Send email with magic link using your preferred email provider

	return new Response(
		JSON.stringify({ success: true, emailSent: false, magicLinkGenerated: true }),
		{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
	);
});
