import nodemailer from 'nodemailer';

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
    <div style="width:100%!important;min-width:100%;margin:0;padding:0;background-color:#ffffff">
    
    <table style="border-spacing:0;border-collapse:collapse;vertical-align:top;height:100%;width:100%;table-layout:fixed" cellpadding="0" cellspacing="0" width="100%" border="0">
        <tbody>
            <tr style="vertical-align:top">
                <td style="word-break:break-word;border-collapse:collapse!important;vertical-align:top;text-align:center;background-color:#ffffff" align="center" valign="top">
                    <table style="border-spacing:0;border-collapse:collapse;vertical-align:top;background-color:transparent" cellpadding="0" cellspacing="0" align="center" width="100%" border="0">
                        <tbody>
                            <tr style="vertical-align:top">
                                <td style="word-break:break-word;border-collapse:collapse!important;vertical-align:top" width="100%">
                                    
                                    
                                    <table style="border-spacing:0;border-collapse:collapse;vertical-align:top;max-width:500px;margin:0 auto;text-align:inherit" cellpadding="0" cellspacing="0" align="center" width="100%" border="0">
                                        <tbody>
                                            <tr style="vertical-align:top">
                                                <td style="word-break:break-word;border-collapse:collapse!important;vertical-align:top" width="100%">
                                                    <table style="border-spacing:0;border-collapse:collapse;vertical-align:top;width:100%;max-width:500px;color:#000000;background-color:transparent" cellpadding="0" cellspacing="0" width="100%" bgcolor="transparent">
                                                        <tbody>
                                                            <tr style="vertical-align:top">
                                                                <td style="word-break:break-word;border-collapse:collapse!important;vertical-align:top;text-align:center;font-size:0">
                                                                    
                                                                    
                                                                    <div style="display:inline-block;vertical-align:top;width:500px">
                                                                        <table style="border-spacing:0;border-collapse:collapse;vertical-align:top" cellpadding="0" cellspacing="0" align="center" width="100%" border="0">
                                                                            <tbody>
                                                                                <tr style="vertical-align:top">
                                                                                    <td style="word-break:break-word;border-collapse:collapse!important;vertical-align:top;background-color:transparent;padding-top:5px;padding-right:0px;padding-bottom:5px;padding-left:0px;border-top:0px solid transparent;border-right:0px solid transparent;border-bottom:0px solid transparent;border-left:0px solid transparent">
                                                                                        <table style="border-spacing:0;border-collapse:collapse;vertical-align:top" cellpadding="0" cellspacing="0" width="100%" border="0">
                                                                                            <tbody>
                                                                                                <tr style="vertical-align:top">
                                                                                                    <td style="word-break:break-word;border-collapse:collapse!important;vertical-align:top;width:100%;padding-top:10px;padding-right:30px;padding-bottom:10px;padding-left:30px" align="center">
                                                                                                        <div align="center">
                                                                                                            <img style="outline:none;text-decoration:none;clear:both;display:block;border:0;height:auto;line-height:100%;margin:0 auto;float:none;max-height:40px" align="center" border="0" src="" alt="Image" title="Image" class="CToWUd" >
                                                                                                        </div>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            </tbody>
                                                                                        </table>
                                                                                    </td>
                                                                                </tr>
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                    
                                                                    
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    
                                    
                                </td>
                            </tr>
                        </tbody>
                    </table>
                    <table style="border-spacing:0;border-collapse:collapse;vertical-align:top;background-color:transparent" cellpadding="0" cellspacing="0" align="center" width="100%" border="0">
                        <tbody>
                            <tr style="vertical-align:top">
                                <td style="word-break:break-word;border-collapse:collapse!important;vertical-align:top" width="100%">
                                    
                                    
                                    <table style="border-spacing:0;border-collapse:collapse;vertical-align:top;max-width:500px;margin:0 auto;text-align:inherit" cellpadding="0" cellspacing="0" align="center" width="100%" border="0">
                                        <tbody>
                                            <tr style="vertical-align:top">
                                                <td style="word-break:break-word;border-collapse:collapse!important;vertical-align:top" width="100%">
                                                    <table style="border-spacing:0;border-collapse:collapse;vertical-align:top;width:100%;max-width:500px;color:#000000;background-color:transparent" cellpadding="0" cellspacing="0" width="100%" bgcolor="transparent">
                                                        <tbody>
                                                            <tr style="vertical-align:top">
                                                                <td style="word-break:break-word;border-collapse:collapse!important;vertical-align:top;text-align:center;font-size:0">
                                                                    
                                                                    
                                                                    <div style="display:inline-block;vertical-align:top;width:500px">
                                                                        <table style="border-spacing:0;border-collapse:collapse;vertical-align:top" cellpadding="0" cellspacing="0" align="center" width="100%" border="0">
                                                                            <tbody>
                                                                              
                                                                                <tr style="vertical-align:top">
                                                                                    <td style="word-break:break-word;border-collapse:collapse!important;vertical-align:top;background-color:transparent;padding-top:0;padding-right:0;padding-bottom:30px;padding-left:0;border-top:1px solid #ededed;border-right:1px solid #ededed;border-bottom:1px solid #ededed;border-left:1px solid #ededed">
                                                                                        
                                                                                       
                                                                                        <table style="border-spacing:0;border-collapse:collapse;vertical-align:top" cellpadding="0" cellspacing="0" width="100%">
                                                                                           
                                                                                        <tbody>
                                                                                                
                                                                                                <tr style="vertical-align:top">
                                                                                                    <td style="word-break:break-word;border-collapse:collapse!important;vertical-align:top;padding-top:10px;padding-right:10px;padding-bottom:20px;padding-left:10px">
                                                                                                        <div style="color:#555555;line-height:120%;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif">
                                                                                                            <div style="font-size:14px;line-height:17px;text-align:center;color:#555555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif">
                                                                                                                <p style="margin:20px 0 0;font-size:14px;line-height:17px;text-align:center">
                                                                                                                    <strong>
                                                                                                                        <span style="font-size:16px;line-height:19px">`+ header + `</span>
                                                                                                                    </strong>
                                                                                                                    <br>
                                                                                                                </p>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    </td>
                                                                                                </tr>
                                                                                            </tbody>
                                                                                        </table>
                                                                                        <table style="border-spacing:0;border-collapse:collapse;vertical-align:top" cellpadding="0" cellspacing="0" width="100%">
                                                                                            <tbody>
                                                                                        <tr style="vertical-align:top">
                                                                                        <td style="word-break:break-word;border-collapse:collapse!important;vertical-align:top;background-color:transparent;padding-top:0;padding-right:20px;padding-bottom:20px;padding-left:20px">
                                                                                            <div style="font-size:12px;line-height:14px;text-align:center;color:#555555;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Roboto','Oxygen','Ubuntu','Cantarell','Fira Sans','Droid Sans','Helvetica Neue',sans-serif">
                                                                                                <p style="margin:0;font-size:12px;line-height:14px;text-align:center">`+ body + `
                                                                                                </p>
                                                                                            </div>
                                                                                        </td>
                                                                                        </tr>
                                                                                        </tbody>
                                                                                        </table>
                                                                                       
                                                                    </div>
                                                                    
                                                                    
                                                                </td>
                                                            </tr>
                                                        </tbody>
                                                    </table>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                    
                                    
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </td>
            </tr>
        </tbody>
    </table><div class="yj6qo"></div><div class="adL">
</div>
</div>`;
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




export default { sendEmailtoUser };