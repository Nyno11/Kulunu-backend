

import cors from 'cors';
import database from './config/db.js';
import express from 'express';
// const https from 'https');
import https from 'http';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config({ path: `.env.${process.env.NODE_ENV}` })

var port = process.env.PORT || 8000;



import parse from 'url';


// var key = fs.readFileSync(__dirname + '/config/keys/selfsigned.key');
// var cert = fs.readFileSync(__dirname + '/config/keys/selfsigned.crt');
// var options = {
//   key: key,
//   cert: cert
// };

// const { initializeApp, applicationDefault } from 'firebase-admin/app');


// var serviceAccount from `./config/${process.env.GOOGLE_APPLICATION_CREDENTIALS}`);



// initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });



var app = express();

app.get('/', async (req, res) => {


  var ip = "102.89.32.84";
  var geo = geoip.lookup(ip);

  console.log(geo);


  console.log(req.ip);

  const results = await database.query('select * from trial.users');
  console.table(results.rows);


  res.send('Now using https..');
});

// var server = https.createServer(options, app);
var server = https.createServer(app);






// const wss1 = new WebSocketServer({ noServer: true });
// const wss2 = new WebSocketServer({ noServer: true });


const maxClients = 20;
let rooms = {};
let matches = {};


function noop() { }

function heartbeat() {
  this.isAlive = true;
}



// This module is to allow our api for cross-origin resource sharing
app.use(cors());

//This is to allow our api for parsing json
app.use(express.json());

app.set('trust proxy', true);

app.use(express.urlencoded({
  extended: true
}));

//Register routes in the main index.js


import authRoutes from './routes/auth.js';
import flightsRoutes from './routes/flights.js';
import bookingsRoutes from './routes/bookings.js';
import paymentRoutes from './routes/payment.js';
import adminRoutes from './routes/admin.js';
app.use('/', [
  authRoutes,
  flightsRoutes,
  bookingsRoutes,
  paymentRoutes,
  adminRoutes,
]);

//Folders the app uses
// app.use('/assets', express.static(__dirname + '/assets'));

// http://localhost:3005/tweets -GET,POST
// http://localhost:3005/tweets/user/:id-GET
// http://localhost:3005/tweets/:id- DELETE
// http://localhost:3005/authenticate - POST for Login session


// app.listen(port, () => {
//     console.log(`Listening at https://localhost:${port}`);
// });

server.listen(port, "0.0.0.0", () => {
  console.log("server starting on port : " + port)
});