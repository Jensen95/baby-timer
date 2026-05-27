# Supabase Auth Email Templates

Write these in MJML, compile to HTML, then paste the compiled HTML into **Supabase Dashboard > Auth > Templates**.

Supabase stores the template content as HTML in the dashboard. The MJML below is the source of truth for the repo.

## Magic Link / Sign-in

```mjml
<mjml>
	<mj-head>
		<mj-preview>Your sign-in link</mj-preview>
		<mj-attributes>
			<mj-all font-family="Arial, Helvetica, sans-serif" color="#1f2937" />
			<mj-text font-size="16px" line-height="24px" />
			<mj-button
				background-color="#1f4b3f"
				color="#ffffff"
				border-radius="10px"
				font-size="16px"
				font-weight="600"
			/>
		</mj-attributes>
	</mj-head>
	<mj-body background-color="#f6f1eb" width="600px">
		<mj-section padding="32px 16px 12px">
			<mj-column>
				<mj-text
					align="center"
					font-size="13px"
					color="#6b7280"
					letter-spacing="1px"
					text-transform="uppercase"
					>Baby Timer</mj-text
				>
				<mj-text
					align="center"
					font-size="28px"
					line-height="36px"
					font-weight="700"
					color="#102a43"
					>Your sign-in link</mj-text
				>
				<mj-text align="center" color="#52606d"
					>Follow the link below to sign in. This link expires shortly and can only be used
					once.</mj-text
				>
			</mj-column>
		</mj-section>
		<mj-section padding="0 16px 16px">
			<mj-column background-color="#fffdf9" border-radius="16px" padding="28px">
				<mj-text align="center" font-size="18px" font-weight="700" color="#102a43"
					>Sign in securely</mj-text
				>
				<mj-button href="{{ .ConfirmationURL }}" align="center">Open your sign-in link</mj-button>
				<mj-text align="center" color="#52606d" font-size="14px"
					>If the button does not work, copy and paste this URL into your browser:</mj-text
				>
				<mj-text align="center" font-size="13px" color="#1f4b3f" line-height="20px"
					><a
						href="{{ .ConfirmationURL }}"
						style="color:#1f4b3f;word-break:break-all;"
						>{{ .ConfirmationURL }}</a
					></mj-text
				>
				<mj-divider border-color="#e5ddd4" />
				<mj-text align="center" font-size="14px" color="#52606d"
					><strong>Email:</strong> {{ .Email }}</mj-text
				>
				<mj-text align="center" font-size="14px" color="#52606d"
					><strong>Redirect:</strong> {{ .RedirectTo }}</mj-text
				>
			</mj-column>
		</mj-section>
		<mj-section padding="0 16px 32px">
			<mj-column>
				<mj-text align="center" color="#829ab1" font-size="12px"
					>This link is sent from Baby Timer.</mj-text
				>
			</mj-column>
		</mj-section>
	</mj-body>
</mjml>
```

## Invite

```mjml
<mjml>
	<mj-head>
		<mj-preview>You have been invited</mj-preview>
		<mj-attributes>
			<mj-all font-family="Arial, Helvetica, sans-serif" color="#1f2937" />
			<mj-text font-size="16px" line-height="24px" />
			<mj-button
				background-color="#1f4b3f"
				color="#ffffff"
				border-radius="10px"
				font-size="16px"
				font-weight="600"
			/>
		</mj-attributes>
	</mj-head>
	<mj-body background-color="#f6f1eb" width="600px">
		<mj-section padding="32px 16px 12px">
			<mj-column>
				<mj-text
					align="center"
					font-size="13px"
					color="#6b7280"
					letter-spacing="1px"
					text-transform="uppercase"
					>Baby Timer</mj-text
				>
				<mj-text
					align="center"
					font-size="28px"
					line-height="36px"
					font-weight="700"
					color="#102a43"
					>You have been invited</mj-text
				>
				<mj-text align="center" color="#52606d"
					>You have been invited to create an account on {{ .SiteURL }}. Follow the link below to
					accept the invite.</mj-text
				>
			</mj-column>
		</mj-section>
		<mj-section padding="0 16px 16px">
			<mj-column background-color="#fffdf9" border-radius="16px" padding="28px">
				<mj-button href="{{ .ConfirmationURL }}" align="center">Accept the invite</mj-button>
				<mj-text align="center" color="#52606d" font-size="14px"
					>If the button does not work, copy and paste this URL into your browser:</mj-text
				>
				<mj-text align="center" font-size="13px" color="#1f4b3f" line-height="20px"
					><a
						href="{{ .ConfirmationURL }}"
						style="color:#1f4b3f;word-break:break-all;"
						>{{ .ConfirmationURL }}</a
					></mj-text
				>
			</mj-column>
		</mj-section>
	</mj-body>
</mjml>
```

## Confirmation

```mjml
<mjml>
	<mj-head>
		<mj-preview>Confirm your signup</mj-preview>
		<mj-attributes>
			<mj-all font-family="Arial, Helvetica, sans-serif" color="#1f2937" />
			<mj-text font-size="16px" line-height="24px" />
			<mj-button
				background-color="#1f4b3f"
				color="#ffffff"
				border-radius="10px"
				font-size="16px"
				font-weight="600"
			/>
		</mj-attributes>
	</mj-head>
	<mj-body background-color="#f6f1eb" width="600px">
		<mj-section padding="32px 16px 12px">
			<mj-column>
				<mj-text
					align="center"
					font-size="13px"
					color="#6b7280"
					letter-spacing="1px"
					text-transform="uppercase"
					>Baby Timer</mj-text
				>
				<mj-text
					align="center"
					font-size="28px"
					line-height="36px"
					font-weight="700"
					color="#102a43"
					>Confirm your signup</mj-text
				>
				<mj-text align="center" color="#52606d"
					>Follow the link below to confirm your account.</mj-text
				>
			</mj-column>
		</mj-section>
		<mj-section padding="0 16px 16px">
			<mj-column background-color="#fffdf9" border-radius="16px" padding="28px">
				<mj-button href="{{ .ConfirmationURL }}" align="center">Confirm your signup</mj-button>
				<mj-text align="center" color="#52606d" font-size="14px"
					>If the button does not work, copy and paste this URL into your browser:</mj-text
				>
				<mj-text align="center" font-size="13px" color="#1f4b3f" line-height="20px"
					><a
						href="{{ .ConfirmationURL }}"
						style="color:#1f4b3f;word-break:break-all;"
						>{{ .ConfirmationURL }}</a
					></mj-text
				>
			</mj-column>
		</mj-section>
	</mj-body>
</mjml>
```

## Password reset

```mjml
<mjml>
	<mj-head>
		<mj-preview>Reset your password</mj-preview>
		<mj-attributes>
			<mj-all font-family="Arial, Helvetica, sans-serif" color="#1f2937" />
			<mj-text font-size="16px" line-height="24px" />
			<mj-button
				background-color="#1f4b3f"
				color="#ffffff"
				border-radius="10px"
				font-size="16px"
				font-weight="600"
			/>
		</mj-attributes>
	</mj-head>
	<mj-body background-color="#f6f1eb" width="600px">
		<mj-section padding="32px 16px 12px">
			<mj-column>
				<mj-text
					align="center"
					font-size="13px"
					color="#6b7280"
					letter-spacing="1px"
					text-transform="uppercase"
					>Baby Timer</mj-text
				>
				<mj-text
					align="center"
					font-size="28px"
					line-height="36px"
					font-weight="700"
					color="#102a43"
					>Reset your password</mj-text
				>
				<mj-text align="center" color="#52606d"
					>Follow the link below to reset your password.</mj-text
				>
			</mj-column>
		</mj-section>
		<mj-section padding="0 16px 16px">
			<mj-column background-color="#fffdf9" border-radius="16px" padding="28px">
				<mj-button href="{{ .ConfirmationURL }}" align="center">Reset password</mj-button>
				<mj-text align="center" color="#52606d" font-size="14px"
					>If the button does not work, copy and paste this URL into your browser:</mj-text
				>
				<mj-text align="center" font-size="13px" color="#1f4b3f" line-height="20px"
					><a
						href="{{ .ConfirmationURL }}"
						style="color:#1f4b3f;word-break:break-all;"
						>{{ .ConfirmationURL }}</a
					></mj-text
				>
			</mj-column>
		</mj-section>
	</mj-body>
</mjml>
```

## Email change

```mjml
<mjml>
	<mj-head>
		<mj-preview>Confirm email change</mj-preview>
		<mj-attributes>
			<mj-all font-family="Arial, Helvetica, sans-serif" color="#1f2937" />
			<mj-text font-size="16px" line-height="24px" />
			<mj-button
				background-color="#1f4b3f"
				color="#ffffff"
				border-radius="10px"
				font-size="16px"
				font-weight="600"
			/>
		</mj-attributes>
	</mj-head>
	<mj-body background-color="#f6f1eb" width="600px">
		<mj-section padding="32px 16px 12px">
			<mj-column>
				<mj-text
					align="center"
					font-size="13px"
					color="#6b7280"
					letter-spacing="1px"
					text-transform="uppercase"
					>Baby Timer</mj-text
				>
				<mj-text
					align="center"
					font-size="28px"
					line-height="36px"
					font-weight="700"
					color="#102a43"
					>Confirm email change</mj-text
				>
				<mj-text align="center" color="#52606d"
					>Follow the link below to confirm changing your email from {{ .Email }} to
					{{ .NewEmail }}.</mj-text
				>
			</mj-column>
		</mj-section>
		<mj-section padding="0 16px 16px">
			<mj-column background-color="#fffdf9" border-radius="16px" padding="28px">
				<mj-button href="{{ .ConfirmationURL }}" align="center">Confirm email change</mj-button>
				<mj-text align="center" color="#52606d" font-size="14px"
					>If the button does not work, copy and paste this URL into your browser:</mj-text
				>
				<mj-text align="center" font-size="13px" color="#1f4b3f" line-height="20px"
					><a
						href="{{ .ConfirmationURL }}"
						style="color:#1f4b3f;word-break:break-all;"
						>{{ .ConfirmationURL }}</a
					></mj-text
				>
			</mj-column>
		</mj-section>
	</mj-body>
</mjml>
```

## Notes

- Supabase Auth templates are still HTML at the point you paste them into the dashboard.
- MJML is the authoring format in this repo.
- If you want, I can also add a small script to compile this file into HTML automatically.
