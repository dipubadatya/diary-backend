import nodemailer from 'nodemailer';

// ─────────────────────────────────────────────────────────────────────────────
// TRANSPORTER
// ─────────────────────────────────────────────────────────────────────────────

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const YEAR = new Date().getFullYear();
const FROM = `"Diary" <${process.env.EMAIL_USER}>`;

// ─────────────────────────────────────────────────────────────────────────────
// STYLES
// Defined once, injected into every template via <style> tag.
// Note: Gmail clips <style> blocks — critical styles are also inlined per element.
// ─────────────────────────────────────────────────────────────────────────────

const styles = `
  /* ── Reset ── */
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background-color: #F9F9F6;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
  }

  /* ── Layout ── */
  .wrapper {
    max-width: 540px;
    margin: 0 auto;
    padding: 56px 20px;
  }

  /* ── Logo ── */
  .logo-area {
    display: flex;
    align-items: center;
    margin-bottom: 40px;
  }
  .logo-icon {
    width: 26px;
    height: 26px;
    background-color: #1A1C23;
    border-radius: 7px;
    display: inline-block;
    margin-right: 10px;
    flex-shrink: 0;
  }
  .logo-text {
    font-size: 20px;
    font-weight: 800;
    color: #1A1C23;
    letter-spacing: -0.4px;
  }

  /* ── Header ── */
  .eyebrow {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #78716C;
    margin-bottom: 10px;
  }
  .page-title {
    font-family: Georgia, 'Times New Roman', Times, serif;
    font-size: 36px;
    font-weight: 700;
    color: #1A1C23;
    margin: 0 0 28px 0;
    line-height: 1.1;
    letter-spacing: -0.5px;
  }

  /* ── Card ── */
  .card {
    background-color: #FFFFFF;
    border-radius: 14px;
    padding: 36px 40px 40px;
    border: 1px solid #E7E5E4;
    box-shadow:
      0 1px 3px rgba(0, 0, 0, 0.04),
      0 4px 12px rgba(0, 0, 0, 0.03);
  }

  /* ── Typography ── */
  .greeting {
    font-size: 16px;
    font-weight: 600;
    color: #1A1C23;
    margin: 0 0 16px 0;
  }
  .body-text {
    font-size: 15px;
    line-height: 1.7;
    color: #44403C;
    margin: 0 0 24px 0;
  }
  .small-text {
    font-size: 13px;
    line-height: 1.6;
    color: #57534E;
    margin: 16px 0 0 0;
  }

  /* ── Button ── */
  .btn {
    display: inline-block;
    background-color: #C6F547;
    color: #1A1C23 !important;
    font-weight: 700;
    font-size: 14px;
    text-decoration: none;
    padding: 13px 26px;
    border-radius: 9px;
    letter-spacing: 0.01em;
  }

  /* ── Divider ── */
  .divider {
    border: none;
    border-top: 1px solid #F0EEEA;
    margin: 28px 0 0 0;
  }

  /* ── Fallback URL block ── */
  .fallback-wrap {
    padding-top: 20px;
  }
  .fallback-label {
    font-size: 12px;
    color: #78716C;
    margin: 0 0 8px 0;
    line-height: 1.5;
  }
  .fallback-url {
    display: block;
    background-color: #F9F9F6;
    border-radius: 7px;
    padding: 12px 14px;
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    font-size: 11px;
    color: #57534E;
    word-break: break-all;
    line-height: 1.6;
    text-decoration: none;
  }

  /* ── Footer ── */
  .footer {
    margin-top: 28px;
    font-size: 12px;
    color: #A8A29E;
    line-height: 1.6;
  }
  .footer a {
    color: #78716C;
    text-decoration: underline;
  }
`;

// ─────────────────────────────────────────────────────────────────────────────
// LAYOUT BUILDER
// Wraps every template with the shared chrome: doctype, head, logo, title, footer.
// ─────────────────────────────────────────────────────────────────────────────

const buildLayout = ({
  eyebrow,
  title,
  card,
}: {
  eyebrow: string;
  title: string;        // supports <br/> for line breaks
  card: string;
}) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no,url=no"/>
  <title>Diary</title>
  <style>${styles}</style>
</head>
<body>
<div class="wrapper">

  <!-- Logo -->
  <div class="logo-area">
    <div class="logo-icon"></div>
    <span class="logo-text">Diary</span>
  </div>

  <!-- Page header -->
  <p class="eyebrow">${eyebrow}</p>
  <h1 class="page-title">${title}</h1>

  <!-- Card -->
  <div class="card">
    ${card}
  </div>

  <!-- Footer -->
  <div class="footer">
    &copy; ${YEAR} Diary. All rights reserved.<br/>
  </div>

</div>
</body>
</html>
`;

// ─────────────────────────────────────────────────────────────────────────────
// CARD COMPONENTS
// Small HTML snippets composed inside each card body.
// ─────────────────────────────────────────────────────────────────────────────

/** Personalised salutation */
const Greeting = (name: string) =>
  `<p class="greeting">Hi ${name},</p>`;

/** Standard body paragraph */
const BodyText = (text: string) =>
  `<p class="body-text">${text}</p>`;

/** Smaller muted note paragraph */
const SmallText = (text: string) =>
  `<p class="small-text">${text}</p>`;

/** Primary lime CTA button */
const Button = (label: string, url: string) =>
  `<a href="${url}" class="btn">${label}</a>`;

/** Horizontal rule */
const Divider = () =>
  `<hr class="divider"/>`;

/** Monospace URL fallback block shown below every action button */
const FallbackUrl = (url: string, label = "If the button doesn't work, copy and paste this link into your browser:") => `
  ${Divider()}
  <div class="fallback-wrap">
    <p class="fallback-label">${label}</p>
    <a href="${url}" class="fallback-url">${url}</a>
  </div>
`;

// ─────────────────────────────────────────────────────────────────────────────
// HELPER — resolve base client URL
// ─────────────────────────────────────────────────────────────────────────────

const clientUrl = (host: string, protocol: string) =>
  process.env.CLIENT_URL || `${protocol}://${host}`;

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 1 — VERIFY EMAIL
// Sent immediately after account registration.
// ─────────────────────────────────────────────────────────────────────────────

export const sendVerificationEmail = async (
  email: string,
  username: string,
  token: string,
  host: string,
  protocol: string,
): Promise<void> => {
  const url = `${clientUrl(host, protocol)}/verify-email?token=${token}`;

  const card = `
    ${Greeting(username)}
    ${BodyText("We're glad you're here. Before you can start writing and sharing your stories, we just need to verify your email address to keep your account secure.")}
    ${Button('Verify email address', url)}
    ${FallbackUrl(url)}
  `;

  await transporter.sendMail({
    to: email,
    from: FROM,
    subject: 'Verify your email for Diary',
    html: buildLayout({
      eyebrow: 'Account Setup',
      title: 'Welcome to<br/>Diary',
      card,
    }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 2 — RESET PASSWORD
// Sent when a user requests a password reset.
// Link expires after 30 minutes (enforced server-side).
// ─────────────────────────────────────────────────────────────────────────────

export const sendResetPasswordEmail = async (
  email: string,
  username: string,
  token: string,
  host: string,
  protocol: string,
): Promise<void> => {
  const url = `${clientUrl(host, protocol)}/reset-password/${token}`;

  const card = `
    ${Greeting(username)}
    ${BodyText("We received a request to reset the password for your Diary account. If you made this request, click the button below to set a new one. This link will expire in <strong>30 minutes</strong>.")}
    ${Button('Set new password', url)}
    ${SmallText("If you didn't request this, you can safely ignore this email. Your password will remain exactly the same.")}
    ${FallbackUrl(url, "If the button doesn't work, copy and paste this link:")}
  `;

  await transporter.sendMail({
    to: email,
    from: FROM,
    subject: 'Reset your Diary password',
    html: buildLayout({
      eyebrow: 'Security',
      title: 'Reset your<br/>password',
      card,
    }),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL 3 — PASSWORD UPDATED CONFIRMATION
// Sent after a successful password change as a security receipt.
// ─────────────────────────────────────────────────────────────────────────────

export const sendPasswordConfirmationEmail = async (
  email: string,
  username: string,
  host: string,
  protocol: string,
): Promise<void> => {
  const url = `${clientUrl(host, protocol)}/login`;

  const card = `
    ${Greeting(username)}
    ${BodyText("Your password has been successfully updated. You can now use your new password to sign in to your Diary account and get back to writing.")}
    ${Button('Go to sign in', url)}
    ${Divider()}
    <div class="fallback-wrap">
      <p class="fallback-label" style="margin-bottom:0;">
        If you did not perform this action, please <a href="mailto:${process.env.EMAIL_USER}" style="color:#57534E;">contact us immediately</a> to secure your account.
      </p>
    </div>
  `;

  await transporter.sendMail({
    to: email,
    from: FROM,
    subject: 'Your Diary password was updated',
    html: buildLayout({
      eyebrow: 'Security Update',
      title: 'Password<br/>updated',
      card,
    }),
  });
};