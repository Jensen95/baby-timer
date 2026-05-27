import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import mjml2html from 'npm:mjml';
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

function buildInviteEmailText(args: { familyName: string; magicLink: string }) {
	return [
		`You've been invited to join ${args.familyName}.`,
		'',
		'Use this link to accept the invite:',
		args.magicLink,
		'',
		'If the button does not work, copy and paste the link into your browser.'
	].join('\n');
}

function buildInviteEmailHtml(args: { familyName: string; magicLink: string }) {
	const familyName = escapeHtml(args.familyName);
	const magicLink = escapeHtml(args.magicLink);
	const template = `
		<mjml>
			<mj-head>
				<mj-preview>Join ${familyName} in Baby Timer</mj-preview>
				<mj-attributes>
					<mj-all font-family="Arial, Helvetica, sans-serif" color="#1f2937" />
					<mj-text font-size="16px" line-height="24px" />
					<mj-button background-color="#1f4b3f" color="#ffffff" border-radius="10px" font-size="16px" font-weight="600" />
				</mj-attributes>
			</mj-head>
			<mj-body background-color="#f6f1eb" width="600px">
				<mj-section padding="32px 16px 12px">
					<mj-column>
						<mj-text align="center" font-size="13px" color="#6b7280" letter-spacing="1px" text-transform="uppercase">Baby Timer</mj-text>
						<mj-text align="center" font-size="28px" line-height="36px" font-weight="700" color="#102a43">You're invited to join ${familyName}</mj-text>
						<mj-text align="center" color="#52606d">Tap the button below to accept the invite and open your family space.</mj-text>
					</mj-column>
				</mj-section>
				<mj-section padding="0 16px 16px">
					<mj-column background-color="#fffdf9" border-radius="16px" padding="28px">
						<mj-text align="center" font-size="18px" font-weight="700" color="#102a43">Join link</mj-text>
						<mj-button href="${magicLink}" align="center">Accept invitation</mj-button>
						<mj-text align="center" color="#52606d" font-size="14px">If the button doesn't open, use this link:</mj-text>
						<mj-text align="center" font-size="13px" color="#1f4b3f" line-height="20px"><a href="${magicLink}" style="color:#1f4b3f;word-break:break-all;">${magicLink}</a></mj-text>
					</mj-column>
				</mj-section>
				<mj-section padding="0 16px 32px">
					<mj-column>
						<mj-text align="center" color="#829ab1" font-size="12px">This invite was sent from Baby Timer.</mj-text>
					</mj-column>
				</mj-section>
			</mj-body>
		</mjml>
	`;
	const { html, errors } = mjml2html(template, { validationLevel: 'soft' });

	if (errors?.length) {
		console.warn('MJML validation warnings:', errors);
	}

	return html;
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
	const text = buildInviteEmailText(args);
	const html = buildInviteEmailHtml(args);

	await transport.sendMail({
		from: smtp.from,
		to: args.inviteeEmail,
		subject: `You're invited to join ${args.familyName}`,
		text,
		html
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
