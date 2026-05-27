import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer';
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

function escapeHtml(value: string) {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

function getSmtpConfig() {
	const host = Deno.env.get('SMTP_HOST');
	const port = Number(Deno.env.get('SMTP_PORT') ?? '587');
	const user = Deno.env.get('SMTP_USER');
	const pass = Deno.env.get('SMTP_PASS');
	const from = Deno.env.get('SMTP_FROM') ?? user;
	const secure = Deno.env.get('SMTP_SECURE') === 'true' || port === 465;

	if (!host || !user || !pass || !from) {
		throw new Error('SMTP configuration is incomplete');
	}

	return { host, port, user, pass, from, secure };
}

async function sendInviteEmail(args: {
	inviteeEmail: string;
	familyName: string;
	magicLink: string;
}) {
	const smtp = getSmtpConfig();
	const transport = nodemailer.createTransport({
		host: smtp.host,
		port: smtp.port,
		secure: smtp.secure,
		auth: {
			user: smtp.user,
			pass: smtp.pass
		}
	});
	const escapedMagicLink = escapeHtml(args.magicLink);

	await transport.sendMail({
		from: smtp.from,
		to: args.inviteeEmail,
		subject: `You're invited to join ${args.familyName}`,
		text: [
			`You've been invited to join ${args.familyName}.`,
			'',
			'Use this link to accept the invite:',
			args.magicLink
		].join('\n'),
		html: `
			<p>You've been invited to join <strong>${escapeHtml(args.familyName)}</strong>.</p>
			<p><a href="${escapedMagicLink}">Accept the invite</a></p>
			<p>If the link does not work, copy and paste this URL into your browser:</p>
			<p><code>${escapedMagicLink}</code></p>
		`
	});
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

	console.log(`Invite: ${inviteeEmail} invited to family "${familyName}" (${familyId})`);

	const { data: magicLinkData, error: magicLinkError } = await supabase.auth.admin.generateLink({
		type: 'magiclink',
		email: inviteeEmail,
		options: {
			redirectTo: `${Deno.env.get('APP_URL') ?? 'https://your-app.github.io'}/app/family`
		}
	});

	if (magicLinkError) {
		console.error('Failed to generate magic link:', magicLinkError);
		return new Response(
			JSON.stringify({ success: true, emailSent: false, error: magicLinkError.message }),
			{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
		);
	}

	const magicLink = magicLinkData.properties?.action_link;
	console.log(`Magic link for ${inviteeEmail}: ${magicLink}`);

	if (!magicLink) {
		return new Response(
			JSON.stringify({ success: true, emailSent: false, error: 'Missing invite link' }),
			{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
		);
	}

	try {
		await sendInviteEmail({
			inviteeEmail,
			familyName,
			magicLink
		});
	} catch (error) {
		console.error('Failed to send invite email:', error);
		return new Response(
			JSON.stringify({
				success: true,
				emailSent: false,
				magicLink,
				error: error instanceof Error ? error.message : 'Failed to send email'
			}),
			{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
		);
	}

	return new Response(
		JSON.stringify({
			success: true,
			emailSent: true,
			magicLinkGenerated: true,
			magicLink
		}),
		{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
	);
});
