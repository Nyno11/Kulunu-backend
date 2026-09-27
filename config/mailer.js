
const nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
  pool: true,
  host: "mail.kulunu.app",
  port: 465,
  secure: true,
  auth: {
    user: "info@kulunu.app",
    pass: "sep6$YsQXSyB",
  },
  tls: {
    rejectUnauthorized: false
  }
});

function getHTMLWelcome(header, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kulunu</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700&family=Roboto:wght@400;600&display=swap" rel="stylesheet">
  <style>
    body, table, td, a { -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse !important; }
    body {
      margin:0; padding:0; width:100% !important;
      background-color:#f5f6fa;
      font-family:'Roboto',system-ui,-apple-system,'Segoe UI',sans-serif;
      color:#444444;
    }
    a { color:#0CA6EF; text-decoration:none; }
    @media screen and (max-width:480px) {
      .content { padding:20px 16px !important; }
    }
  </style>
</head>
<body>

<table width="100%" cellpadding="0" cellspacing="0" role="presentation"
  style="background:#f5f6fa;padding:28px 0;">
  <tr>
    <td align="center">
      <table width="600" cellpadding="0" cellspacing="0" role="presentation"
        style="max-width:600px;width:100%;background:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,0.08);">

        <!-- HEADER -->
        <tr>
          <td style="background:linear-gradient(90deg,#0CA6EF 0%,#302B63 100%);padding:20px 28px;">
            <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
              <tr>
                <td width="40" style="vertical-align:middle;">
                  <img src="https://kulunu.app/assets/img/ku.png" alt="Kulunu"
                    width="36" height="36" style="display:block;border-radius:6px;">
                </td>
                <td style="padding-left:10px;vertical-align:middle;">
                  <span style="font-family:'Montserrat',sans-serif;font-size:22px;font-weight:700;color:#ffffff;letter-spacing:0.5px;">KULUNU</span>
                  <span style="display:block;font-size:12px;color:rgba(255,255,255,0.85);margin-top:2px;">Your Travel Partner ✈</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ACCENT BAR -->
        <tr>
          <td style="height:4px;background:linear-gradient(90deg,#0CA6EF,#302B63);"></td>
        </tr>

        <!-- BODY -->
        <tr>
          <td class="content" style="padding:32px 28px;">
            <h2 style="font-family:'Montserrat',sans-serif;font-size:20px;font-weight:700;color:#0CA6EF;margin:0 0 4px;">${header}</h2>
            <p style="font-size:12px;color:#0CA6EF;margin:0 0 24px;font-weight:600;letter-spacing:0.5px;text-transform:uppercase;">Kulunu Notification</p>
            <div style="font-size:15px;line-height:1.7;color:#444444;">
              ${body}
            </div>
            <p style="margin-top:28px;font-size:13px;color:#888888;">
              Need help? Contact us at <a href="mailto:info@kulunu.app" style="color:#0CA6EF;">info@kulunu.app</a>
            </p>
          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td style="background:#f5f6fa;padding:18px 28px;text-align:center;border-top:1px solid #e8ecf0;">
            <p style="margin:0;font-size:12px;color:#888888;">
              &copy; ${new Date().getFullYear()} Kulunu. All rights reserved.<br>
              <a href="https://kulunu.app" style="color:#0CA6EF;">kulunu.app</a>
              &nbsp;&middot;&nbsp;
              <a href="mailto:info@kulunu.app" style="color:#0CA6EF;">Support</a>
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

async function sendEmailtoUser(email, subject, header, body) {
  var mailOptions = {
    from: 'info@kulunu.app',
    to: email,
    subject: subject,
    html: getHTMLWelcome(header, body)
  };

  try {
    var info = await transporter.sendMail(mailOptions);
    console.log('Email sent: ' + info.response);
    return true;
  } catch (e) {
    console.log(e);
    return false;
  }
}

module.exports = { sendEmailtoUser };
