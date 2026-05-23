const nodemailer = require("nodemailer");

// Lazy-initialise the transporter so missing env vars only error at send-time,
// not at server startup — allows the app to boot even if email isn't configured.
let _transporter = null;

function getTransporter() {
    if (_transporter) return _transporter;

    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;

    if (!user || !pass) {
        throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set in .env to send emails.");
    }

    _transporter = nodemailer.createTransport({
        host:   "smtp.gmail.com",
        port:   587,
        secure: false, // STARTTLS — Gmail upgrades the connection after the initial handshake
        auth:   { user, pass },
    });

    return _transporter;
}

// ─── HTML email template ──────────────────────────────────────────────────────
function buildDonationEmail({ donorWallet, amountUsdc, campaignTitle, totalRaised, campaignUrl }) {
    const shortWallet = `${donorWallet.slice(0, 6)}…${donorWallet.slice(-4)}`;

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>New donation received</title>
</head>
<body style="margin:0;padding:0;background:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#030712;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Logo -->
          <tr>
            <td style="padding-bottom:32px;text-align:center;">
              <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
                Nexus<span style="color:#6366f1;">Fund</span>
              </span>
            </td>
          </tr>

          <!-- Card -->
          <tr>
            <td style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:32px;">

              <!-- Heading -->
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:1px;">
                New Donation Received
              </p>
              <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">
                Someone just donated to<br/>your campaign!
              </h1>

              <!-- Campaign name -->
              <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;">
                Campaign: <strong style="color:#ffffff;">${escHtml(campaignTitle)}</strong>
              </p>

              <!-- Stats row -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td width="48%" style="background:#1f2937;border-radius:12px;padding:16px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Amount donated</p>
                    <p style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">${escHtml(String(amountUsdc))} <span style="font-size:14px;color:#6b7280;">USDC</span></p>
                  </td>
                  <td width="4%"></td>
                  <td width="48%" style="background:#1f2937;border-radius:12px;padding:16px;text-align:center;">
                    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Total raised</p>
                    <p style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">${escHtml(String(totalRaised))} <span style="font-size:14px;color:#6b7280;">USDC</span></p>
                  </td>
                </tr>
              </table>

              <!-- Donor wallet -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#1f2937;border-radius:10px;padding:14px 16px;margin-bottom:28px;">
                <tr>
                  <td>
                    <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Donor wallet</p>
                    <p style="margin:0;font-size:13px;font-family:monospace;color:#a5b4fc;">${escHtml(donorWallet)}</p>
                  </td>
                </tr>
              </table>

              <!-- CTA -->
              <a href="${escHtml(campaignUrl)}"
                 style="display:block;text-align:center;background:#4f46e5;color:#ffffff;text-decoration:none;
                        font-size:15px;font-weight:600;padding:14px 24px;border-radius:10px;">
                View your campaign →
              </a>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:24px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#374151;">
                You're receiving this because you created a campaign on NexusFund.<br/>
                Donations are held in your smart contract on the Polygon network.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Minimal HTML escaping to prevent XSS in the email template
function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ─── Public API ───────────────────────────────────────────────────────────────
// Fire-and-forget safe: caller should NOT await this if they want to avoid
// blocking the HTTP response on email delivery.
async function sendDonationAlert({ creatorEmail, donorWallet, amountUsdc, campaignTitle, totalRaised, campaignId }) {
    const frontendUrl  = process.env.FRONTEND_URL?.split(",")[0] || "http://localhost:5173";
    const campaignUrl  = `${frontendUrl}/campaign/${campaignId}`;

    const html = buildDonationEmail({ donorWallet, amountUsdc, campaignTitle, totalRaised, campaignUrl });

    try {
        const transporter = getTransporter();
        await transporter.sendMail({
            from:    `"NexusFund" <${process.env.GMAIL_USER}>`,
            to:      creatorEmail,
            subject: `💰 New donation: ${amountUsdc} USDC for "${campaignTitle}"`,
            html,
        });
        console.log(`[mailer] Donation alert sent to ${creatorEmail}`);
    } catch (err) {
        // Log but never throw — email failure must not break the donation API response
        console.error("[mailer] Failed to send donation alert:", err.message);
    }
}

module.exports = { sendDonationAlert };
