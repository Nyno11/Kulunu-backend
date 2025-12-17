// # Project: Amadeus Flight Booking (Node.js + MySQL + HTML)

// This single file contains the backend and frontend files you'll need for:
// - Flight search (Amadeus Flight Offers Search)
// - Price confirmation (Flight Offers Price)
// - Booking (Flight Create Orders)
// - Payment (Stripe Payment Intents)
// - Emailing confirmation + attaching generated PDF ticket (Nodemailer + PDFKit)
// - MySQL schema for storing users, orders, bookings

// --- FILE: package.json ---
// ```json
// {
//   "name": "amadeus-flight-booking",
//   "version": "1.0.0",
//   "main": "index.js",
//   "scripts": {
//     "start": "node index.js"
//   },
//   "dependencies": {
//     "amadeus": "^3.2.0",
//     "body-parser": "^1.20.2",
//     "dotenv": "^16.1.4",
//     "express": "^4.18.2",
//     "mysql2": "^3.4.0",
//     "stripe": "^12.0.0",
//     "nodemailer": "^6.9.4",
//     "pdfkit": "^0.13.0",
//     "uuid": "^9.0.0"
//   }
// }
// ```



// --- FILE: schema.sql ---
// ```sql
// CREATE DATABASE IF NOT EXISTS amadeus_booking;
// USE amadeus_booking;

// CREATE TABLE users (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   email VARCHAR(255) NOT NULL,
//   name VARCHAR(255),
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
// );

// CREATE TABLE bookings (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   user_id INT,
//   amadeus_order_id VARCHAR(255),
//   pnr VARCHAR(255),
//   currency VARCHAR(10),
//   total_amount DECIMAL(10,2),
//   status VARCHAR(50), -- pending, paid, booked, cancelled
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY (user_id) REFERENCES users(id)
// );

// CREATE TABLE payments (
//   id INT AUTO_INCREMENT PRIMARY KEY,
//   booking_id INT,
//   stripe_payment_intent VARCHAR(255),
//   amount DECIMAL(10,2),
//   currency VARCHAR(10),
//   status VARCHAR(50),
//   created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//   FOREIGN KEY (booking_id) REFERENCES bookings(id)
// );
// ```



// amadeusService.js
import Amadeus from 'amadeus';

import dotenv from 'dotenv';
// const env = "production"; 
const env = "development";


dotenv.config({ path: `.env.${env}` })

const amadeus = new Amadeus({
    clientId: process.env.AMADEUS_CLIENT_ID,
    clientSecret: process.env.AMADEUS_CLIENT_SECRET,
});

const api = {
    searchFlights: async (params) => {
        const resp = await amadeus.shopping.flightOffersSearch.get({
            originLocationCode: params.origin,
            destinationLocationCode: params.destination,
            departureDate: params.departureDate,
            returnDate: params.returnDate,
            adults: params.adults || 1,
            travelClass: params.travelClass || 'ECONOMY',
            max: params.max || 20,
        });
        return resp.result;
    },

    getPricedOffer: async (offer) => {
        const resp = await amadeus.shopping.flightOffers.pricing.post({
            data: offer,
        });
        return resp.result;
    },

    createOrder: async (orderPayload) => {
        const resp = await amadeus.booking.flightOrders.post({
            data: orderPayload,
        });
        return resp.result;
    },

    getOrder: async (orderId) => {
        const resp = await amadeus.booking.flightOrders.get({
            orderId,
        });
        return resp.result;
    },

    // Search airports by name or code
    searchAirports: async (keyword) => {
        if (!keyword || keyword.length < 2) {
            throw new Error("Keyword must be at least 2 characters");
        }


        const resp = await amadeus.referenceData.locations.get({
            keyword,
            subType: "AIRPORT",

        });

        return resp.data.map(airport => ({
            iataCode: airport.iataCode,
            name: airport.name,
            city: airport.address?.cityName || airport.cityName,
            country: airport.address?.countryCode || airport.countryCode
        }));
    },

};

export default api;





// app.listen(process.env.PORT || 3000, () => console.log('Server started on', process.env.PORT || 3000));


// --- NOTES / SECURITY ---
// 1. This project is a simplified end-to-end example. **Do not** use as-is in production. You must:
//    - Store the chosen pricedOffer and passenger data in DB before creating PaymentIntent.
//    - Properly validate all inputs, sanitize, and follow PCI DSS when handling payments.
//    - Implement retry logic and idempotency for booking creation with Amadeus.
//    - Use HTTPS and secure your webhook endpoints.
//    - Keep secrets out of source control.

// 2. Amadeus APIs require an account, correct credentials, and sometimes commercial agreements for booking/ticketing with real airlines.

// 3. The Flight Create Orders API requires a correctly-built payload (passengers, contact, flightOffers) and may return ticket numbers or require additional ticketing steps depending on airline.

// 4. Save the Amadeus pricedOffer response in your DB (it contains pricing/fare details and traveler pricing) — you must send this to the Create Orders endpoint as `flightOffers`.

// --- END ---
