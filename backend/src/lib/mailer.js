const nodemailer = require("nodemailer");

let _transporter = null;

function getTransporter() {
    if (_transporter) return _transporter;
    const user = process.env.GMAIL_USER;
    const pass = process.env.GMAIL_APP_PASSWORD;
    if (!user || !pass) throw new Error("GMAIL_USER and GMAIL_APP_PASSWORD must be set to send emails.");
    _transporter = nodemailer.createTransport({
        host:   "smtp.gmail.com",
        port:   587,
        secure: false,
        auth:   { user, pass },
    });
    return _transporter;
}

function escHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

// ─── Donation alert to campaign creator ───────────────────────────────────────
function buildDonationEmail({ amountUsd, campaignTitle, totalRaised, campaignUrl }) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>New donation received</title></head>
<body style="margin:0;padding:0;background:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#030712;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:32px;text-align:center;">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
            Nexus<span style="color:#6366f1;">Fund</span>
          </span>
        </td></tr>
        <tr><td style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:32px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#6366f1;text-transform:uppercase;letter-spacing:1px;">New Donation Received</p>
          <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">
            Someone just donated to<br/>your campaign!
          </h1>
          <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;">
            Campaign: <strong style="color:#ffffff;">${escHtml(campaignTitle)}</strong>
          </p>
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
            <tr>
              <td width="48%" style="background:#1f2937;border-radius:12px;padding:16px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;">Amount donated</p>
                <p style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">$${escHtml(String(amountUsd))}</p>
              </td>
              <td width="4%"></td>
              <td width="48%" style="background:#1f2937;border-radius:12px;padding:16px;text-align:center;">
                <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;">Total raised</p>
                <p style="margin:0;font-size:26px;font-weight:700;color:#ffffff;">$${escHtml(String(totalRaised))}</p>
              </td>
            </tr>
          </table>
          <a href="${escHtml(campaignUrl)}" style="display:block;text-align:center;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:10px;">
            View your campaign →
          </a>
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center;">
          <p style="margin:0;font-size:12px;color:#374151;">
            You're receiving this because you created a campaign on NexusFund.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendDonationAlert({ creatorEmail, amountUsd, campaignTitle, totalRaised, campaignId }) {
    const frontendUrl = process.env.FRONTEND_URL?.split(",")[0] || "http://localhost:5173";
    const campaignUrl = `${frontendUrl}/campaign/${campaignId}`;
    const html        = buildDonationEmail({ amountUsd, campaignTitle, totalRaised, campaignUrl });

    try {
        const transporter = getTransporter();
        await transporter.sendMail({
            from:    `"NexusFund" <${process.env.GMAIL_USER}>`,
            to:      creatorEmail,
            subject: `New donation: $${amountUsd} for "${campaignTitle}"`,
            html,
        });
        console.log(`[mailer] Donation alert sent to ${creatorEmail}`);
    } catch (err) {
        console.error("[mailer] Failed to send donation alert:", err.message);
    }
}

// ─── Withdrawal confirmation to campaign creator ───────────────────────────────
function buildWithdrawalEmail({ campaignTitle, netAmount, txHash, campaignUrl }) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><title>Withdrawal initiated</title></head>
<body style="margin:0;padding:0;background:#030712;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#030712;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <tr><td style="padding-bottom:32px;text-align:center;">
          <span style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
            Nexus<span style="color:#6366f1;">Fund</span>
          </span>
        </td></tr>
        <tr><td style="background:#111827;border:1px solid #1f2937;border-radius:16px;padding:32px;">
          <p style="margin:0 0 8px;font-size:13px;font-weight:600;color:#10b981;text-transform:uppercase;letter-spacing:1px;">Withdrawal Initiated</p>
          <h1 style="margin:0 0 24px;font-size:24px;font-weight:700;color:#ffffff;line-height:1.3;">
            Your funds are being processed!
          </h1>
          <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;">
            Campaign: <strong style="color:#ffffff;">${escHtml(campaignTitle)}</strong>
          </p>
          <div style="background:#1f2937;border-radius:12px;padding:20px;margin-bottom:28px;text-align:center;">
            <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;">You will receive</p>
            <p style="margin:0;font-size:32px;font-weight:700;color:#10b981;">$${escHtml(String(netAmount))}</p>
            <p style="margin:8px 0 0;font-size:12px;color:#6b7280;">after 2.5% platform fee</p>
          </div>
          ${txHash ? `<p style="font-size:12px;color:#6b7280;word-break:break-all;margin-bottom:24px;">Transaction: <span style="color:#a5b4fc;font-family:monospace;">${escHtml(txHash)}</span></p>` : ""}
          <p style="font-size:14px;color:#9ca3af;margin-bottom:28px;">
            Funds will be processed within 24 hours. Thank you for using NexusFund!
          </p>
          <a href="${escHtml(campaignUrl)}" style="display:block;text-align:center;background:#4f46e5;color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 24px;border-radius:10px;">
            View campaign →
          </a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

async function sendWithdrawalConfirmation({ creatorEmail, campaignTitle, netAmount, txHash, campaignId }) {
    const frontendUrl = process.env.FRONTEND_URL?.split(",")[0] || "http://localhost:5173";
    const campaignUrl = `${frontendUrl}/campaign/${campaignId}`;
    const html        = buildWithdrawalEmail({ campaignTitle, netAmount, txHash, campaignUrl });

    try {
        const transporter = getTransporter();
        await transporter.sendMail({
            from:    `"NexusFund" <${process.env.GMAIL_USER}>`,
            to:      creatorEmail,
            subject: `Withdrawal initiated for "${campaignTitle}"`,
            html,
        });
        console.log(`[mailer] Withdrawal confirmation sent to ${creatorEmail}`);
    } catch (err) {
        console.error("[mailer] Failed to send withdrawal confirmation:", err.message);
    }
}

module.exports = { sendDonationAlert, sendWithdrawalConfirmation };
