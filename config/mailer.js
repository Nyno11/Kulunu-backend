
const nodemailer = require('nodemailer');
var transporter = nodemailer.createTransport({
    pool: true,
    host: "mail.kulunu.app",
    port: 465,
    secure: true, // use TLS
    auth: {
        user: "info@kulunu.app",
        pass: "sep6$YsQXSyB",
    },
    tls: {
        rejectUnauthorized: false
    }
});


function getHTMLWelcome(header, body) {
    return `
   <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Kulunu Travel</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <style>
    body, table, td, a {
      -webkit-text-size-adjust: 100%;
      -ms-text-size-adjust: 100%;
    }
    table {
      border-collapse: collapse !important;
    }
    body {
      margin: 0;
      padding: 0;
      width: 100% !important;
      background-color: #f5f6fa;
      font-family: Arial, Helvetica, sans-serif;
    }

    .wrapper {
      width: 100%;
      background-color: #f5f6fa;
      padding: 20px 0;
    }

    .container {
      max-width: 600px;
      background-color: #ffffff;
      border-radius: 12px;
      overflow: hidden;
    }

    /* Header */
    .header {
      background-color: #0CA6EF;
      padding: 18px 20px;
      color: #ffffff;
    }

    .header-title {
      font-size: 22px;
      font-weight: bold;
      margin: 0;
    }

    .header-sub {
      font-size: 13px;
      margin: 4px 0 0;
      opacity: 0.95;
    }

    /* Body */
    .content {
      padding: 26px 24px;
      color: #333333;
    }

    .content h2 {
      font-size: 20px;
      margin: 0 0 12px;
      color: #0CA6EF;
    }

    .content p {
      font-size: 15px;
      line-height: 1.6;
      margin: 0 0 16px;
    }

    /* Info card */
    .card {
      background-color: #f1f5f9;
      border-radius: 10px;
      padding: 16px;
      margin: 20px 0;
    }

    .card-row {
      font-size: 14px;
      margin-bottom: 8px;
    }

    .card-row strong {
      color: #0b2030;
    }

    /* Button */
    .btn {
      display: inline-block;
      background-color: #0CA6EF;
      color: #ffffff !important;
      text-decoration: none;
      padding: 12px 22px;
      border-radius: 8px;
      font-size: 15px;
      font-weight: bold;
    }

    /* Footer */
    .footer {
      background-color: #f1f5f9;
      padding: 16px;
      text-align: center;
      font-size: 12px;
      color: #666666;
    }

    .footer a {
      color: #0CA6EF;
      text-decoration: none;
    }

    /* Mobile */
    @media screen and (max-width: 480px) {
      .content {
        padding: 20px 16px;
      }
      .header-title {
        font-size: 20px;
      }
    }
  </style>
</head>

<body>

<table class="wrapper" width="100%" role="presentation">
  <tr>
    <td align="center">

      <table class="container" width="100%" role="presentation">

        <!-- HEADER -->
        <tr>
          <td class="header">
            <table width="100%" role="presentation">
              <tr>
                <!-- Logo (LEFT) -->
                <td align="left" width="40%">
                  <img
                    src="https://kulunu.app/assets/img/ku.png"
                    alt="Kulunu"
                    width="110"
                    style="display:block; max-width:110px;"
                  >
                </td>

                <!-- Brand text (RIGHT) -->
                <td align="left" width="60%">
                  <p class="header-title">Kulunu ✈</p>
                  <p class="header-sub">Your Travel Partner</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- BODY -->
        <tr>
          <td class="content">

            <h2> `+ header + ` 🎉</h2>

            <p>Dear <strong>User</strong>,</p>

            <p>
              `+ body + `
            </p>

            <!-- INFO CARD -->
            <table class="card" width="100%" role="presentation">
              <tr>
                <td class="card-row"><strong>Route:</strong> Lagos → Abuja</td>
              </tr>
              <tr>
                <td class="card-row"><strong>Date:</strong> 22 July 2025</td>
              </tr>
              <tr>
                <td class="card-row"><strong>Airline:</strong> Air Peace</td>
              </tr>
              <tr>
                <td class="card-row"><strong>Booking ID:</strong> WK123ABC</td>
              </tr>
            </table>

            <table width="100%" role="presentation">
              <tr>
                <td align="center">
                  <a href="#" class="btn">View Booking</a>
                </td>
              </tr>
            </table>

            <p style="margin-top:20px;">
              Need help? Our support team is always available to assist you.
            </p>

          </td>
        </tr>

        <!-- FOOTER -->
        <tr>
          <td class="footer">
            <p>
              © 2025 Kulunu. All rights reserved.<br>
              <a href="#">Unsubscribe</a> | <a href="#">Support</a>
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
        if (info.response.error) {
            console.log(info.response.error);
            return false;
        } else {
            console.log('Email sent: ' + info.response);


            return true;

        }
    } catch (e) {
        console.log(e);
    }

}


// --- FILE: emailService.js ---
// ```js
// // emailService.js - send confirmation emails with an attached PDF ticket
// const nodemailer = require('nodemailer');
// const PDFDocument = require('pdfkit');
// const { Readable } = require('stream');
// require('dotenv').config();

// const transporter = nodemailer.createTransport({
//   host: process.env.EMAIL_HOST,
//   port: parseInt(process.env.EMAIL_PORT || '587'),
//   secure: false,
//   auth: {
//     user: process.env.EMAIL_USER,
//     pass: process.env.EMAIL_PASS
//   }
// });

// function pdfBufferFromBooking(booking, orderData) {
//   // booking: DB booking row; orderData: Amadeus order response
//   const doc = new PDFDocument();
//   const buffers = [];
//   doc.on('data', buffers.push.bind(buffers));
//   return new Promise((resolve, reject) => {
//     doc.on('end', () => {
//       const pdfData = Buffer.concat(buffers);
//       resolve(pdfData);
//     });

//     doc.fontSize(20).text('Flight Itinerary', { align: 'center' });
//     doc.moveDown();
//     doc.fontSize(12).text(`Booking ID: ${booking.id}`);
//     doc.text(`PNR: ${orderData.data && orderData.data.itineraries ? (orderData.data && orderData.data.id) : 'N/A'}`);
//     doc.moveDown();

//     // Simplified passenger and segments rendering
//     if (orderData.data && orderData.data.travelers) {
//       doc.text('Passengers:');
//       orderData.data.travelers.forEach((t, i) => {
//         doc.text(`${i + 1}. ${t.gender} ${t.name.lastName}, ${t.name.firstName}`);
//       });
//       doc.moveDown();
//     }

//     if (orderData.data && orderData.data.itineraries) {
//       doc.text('Itineraries:');
//       orderData.data.itineraries.forEach((it, idx) => {
//         doc.text(`Itinerary ${idx + 1}:`);
//         it.segments.forEach((s) => {
//           doc.text(` - ${s.departure.iataCode} (${s.departure.at}) -> ${s.arrival.iataCode} (${s.arrival.at}) Airline: ${s.carrierCode} ${s.number}`);
//         });
//       });
//     }

//     doc.end();
//   });
// }

// async function sendTicketEmail(to, subject, text, booking, orderData) {
//   const pdf = await pdfBufferFromBooking(booking, orderData);

//   const info = await transporter.sendMail({
//     from: process.env.FROM_EMAIL,
//     to,
//     subject,
//     text,
//     attachments: [
//       {
//         filename: `itinerary_${booking.id}.pdf`,
//         content: pdf
//       }
//     ]
//   });
//   return info;
// }

// module.exports = { sendTicketEmail };



module.exports = { sendEmailtoUser };