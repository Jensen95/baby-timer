import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@^8';
import { corsHeaders } from '../_shared/cors.ts';
import { captureException, flush, initErrorTracking } from '../_shared/error-tracking.ts';

const supabase = createClient(
	Deno.env.get('SUPABASE_URL')!,
	Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

initErrorTracking('send-invite');

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
		'If the button does not work, copy and paste the link into your browser.',
	].join('\n');
}

function buildInviteEmailHtml(args: { familyName: string; magicLink: string }) {
	const familyName = escapeHtml(args.familyName);
	const magicLink = escapeHtml(args.magicLink);
	return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>You're invited to join ${familyName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f6f1eb;font-family:Arial,Helvetica,sans-serif;color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f6f1eb;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
          <tr>
            <td style="padding:32px 16px 12px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;letter-spacing:1px;text-transform:uppercase;">Baby Timer</p>
              <h1 style="margin:0 0 12px;font-size:28px;line-height:36px;font-weight:700;color:#102a43;">You're invited to join ${familyName}</h1>
              <p style="margin:0;color:#52606d;">Tap the button below to accept the invite and open your family space.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 16px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fffdf9;border-radius:16px;padding:28px;">
                <tr>
                  <td style="text-align:center;padding-bottom:16px;">
                    <h2 style="margin:0 0 16px;font-size:18px;font-weight:700;color:#102a43;">Join link</h2>
                    <a href="${magicLink}" style="display:inline-block;background-color:#1f4b3f;color:#ffffff;text-decoration:none;border-radius:10px;font-size:16px;font-weight:600;padding:12px 24px;">Accept invitation</a>
                  </td>
                </tr>
                <tr>
                  <td style="text-align:center;padding-top:16px;">
                    <p style="margin:0 0 8px;color:#52606d;font-size:14px;">If the button doesn't open, use this link:</p>
                    <p style="margin:0;font-size:13px;line-height:20px;"><a href="${magicLink}" style="color:#1f4b3f;word-break:break-all;">${magicLink}</a></p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 16px 32px;text-align:center;">
              <p style="margin:0;color:#829ab1;font-size:12px;">This invite was sent from Baby Timer.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
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
			pass: smtp.pass,
		},
	});
	const text = buildInviteEmailText(args);
	const html = buildInviteEmailHtml(args);

	await transport.sendMail({
		from: smtp.from,
		to: args.inviteeEmail,
		subject: `You're invited to join ${args.familyName}`,
		text,
		html,
	});
}

Deno.serve(async (req: Request) => {
	try {
		if (req.method === 'OPTIONS') {
			return new Response('ok', {
				headers: {
					...corsHeaders,
					'Access-Control-Allow-Methods': 'POST, OPTIONS',
				},
			});
		}

		if (req.method !== 'POST') {
			return new Response('Method not allowed', {
				status: 405,
				headers: corsHeaders,
			});
		}

		let payload: InvitePayload;
		try {
			payload = await req.json();
		} catch {
			return new Response('Invalid JSON', {
				status: 400,
				headers: corsHeaders,
			});
		}

		const { familyId, inviteeEmail, familyName } = payload;

		if (!familyId || !inviteeEmail) {
			return new Response('Missing required fields', {
				status: 400,
				headers: corsHeaders,
			});
		}

		console.log(`Invite: ${inviteeEmail} invited to family "${familyName}" (${familyId})`);

		const { data: magicLinkData, error: magicLinkError } = await supabase.auth.admin.generateLink({
			type: 'magiclink',
			email: inviteeEmail,
			options: {
				redirectTo: `${Deno.env.get('APP_URL') ?? 'https://your-app.github.io'}/app/family`,
			},
		});

		if (magicLinkError) {
			captureException(magicLinkError);
			return new Response(
				JSON.stringify({ success: true, emailSent: false, error: magicLinkError.message }),
				{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
			);
		}

		const magicLink = magicLinkData.properties?.action_link;
		console.log(`Magic link for ${inviteeEmail}: ${magicLink}`);

		if (!magicLink) {
			return new Response(
				JSON.stringify({ success: true, emailSent: false, error: 'Missing invite link' }),
				{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
			);
		}

		try {
			await sendInviteEmail({
				inviteeEmail,
				familyName,
				magicLink,
			});
		} catch (error) {
			captureException(error);
			return new Response(
				JSON.stringify({
					success: true,
					emailSent: false,
					magicLink,
					error: error instanceof Error ? error.message : 'Failed to send email',
				}),
				{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
			);
		}

		return new Response(
			JSON.stringify({
				success: true,
				emailSent: true,
				magicLinkGenerated: true,
				magicLink,
			}),
			{ headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
		);
	} catch (error) {
		captureException(error);
		await flush();
		return new Response(
			JSON.stringify({
				success: false,
				emailSent: false,
				error: error instanceof Error ? error.message : 'Unexpected error',
			}),
			{
				status: 500,
				headers: { ...corsHeaders, 'Content-Type': 'application/json' },
			},
		);
	}
});
