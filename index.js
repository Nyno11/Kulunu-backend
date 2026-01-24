

const cors = require('cors');
const database = require('./config/db.js');
const express = require('express');


const https = require('https');

// const fs = require('fs');
const dotenv = require('dotenv');
// const env = "production";
const env = "development";


// dotenv.config({ path: `.env.${env}` })

var port = process.env.PORT || 8080;





// // var key = fs.readFileSync(__dirname + '/config/keys/selfsigned.key');
// // var cert = fs.readFileSync(__dirname + '/config/keys/selfsigned.crt');
// // var options = {
// //   key: key,
// //   cert: cert
// // };

// // const { initializeApp, applicationDefault } from 'firebase-admin/app');


// // var serviceAccount from `./config/${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);



// // initializeApp({
// //   credential: admin.credential.cert(serviceAccount),
// // });



var app = express();

// // process.on('uncaughtException', err => {
// //   console.error('UNCAUGHT EXCEPTION:', err)
// // })

// // process.on('unhandledRejection', err => {
// //   console.error('UNHANDLED PROMISE:', err)
// // })

// // app.get('/', async (req, res) => {




// //   const results = database.query('select * from users');
// //   console.log(results);


// //   res.send('Now using https..');
// // });

// // var server = https.createServer(options, app);
// var server = https.createServer(app);






// // const wss1 = new WebSocketServer({ noServer: true });
// // const wss2 = new WebSocketServer({ noServer: true });




// // This module is to allow our api for cross-origin resource sharing
// // app.use(cors());

// //This is to allow our api for parsing json
app.use(express.json({ strict: false }));


app.post('/test', (req, res) => {
  res.json({ success: true });
});

// // app.set('trust proxy', true);

// // app.use(express.urlencoded({
// //   extended: true
// // }));

// //Register routes in the main index.js


const authRoutes = require('./routes/auth.js');
const flightsRoutes = require('./routes/flights.js');
const bookingsRoutes = require('./routes/bookings.js');
const paymentRoutes = require('./routes/payment.js');
const adminRoutes = require('./routes/admin.js');
app.use('/', [
  authRoutes,
  flightsRoutes,
  bookingsRoutes,
  paymentRoutes,
  adminRoutes,
]);

// //Folders the app uses
// // app.use('/assets', express.static(__dirname + '/assets'));

// // http://localhost:3005/tweets -GET,POST
// // http://localhost:3005/tweets/user/:id-GET
// // http://localhost:3005/tweets/:id- DELETE
// // http://localhost:3005/authenticate - POST for Login session




app.listen(port, () => {
  console.log("server starting on port : " + port)
});