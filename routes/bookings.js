import express from 'express';
import amadeusSvc from '../config/amadeus.js';
import db from '../config/db.js';
var app = express.Router();
import validation from '../utils/validation.js';
export default app;


// index.js - main Express server + endpoints

import bodyParser from 'body-parser';
// import uuid from 'uuid';


// Endpoint: search airports by code or name
// POST /api/airports/autocomplete

app.post('/api/airports/autocomplete', async (req, res) => {
    try {
        console.log(req.body);
        const { keyword } = req.body;
        const results = await amadeusSvc.searchAirports(keyword);
        res.json(results);
    } catch (err) {
        console.error(err.response?.body || err.message);
        res.status(500).json({ error: err.message });
    }
});



// 1) Flight search
app.post('/api/search', async (req, res) => {
    try {

        const results = await amadeusSvc.searchFlights(req.body);
        res.json(results);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 2) Price confirm (you should call Flight Offers Price)
app.post('/api/price', async (req, res) => {
    // req.body.offer = chosen offer object from search
    try {
        const priced = await amadeusSvc.getPricedOffer(req.body.offer);
        res.json(priced);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
});

// 3) Create booking (bookings table and create an Amadeus Order) - but delay payment until after client pays
app.post('/api/create-booking', async (req, res) => {
    // req.body: { user: {email,name}, offer, passengers }
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const [userRows] = await conn.query('SELECT * FROM users WHERE email = ?', [req.body.user.email]);
        let userId;
        if (userRows.length === 0) {
            // const [r] = await conn.query('INSERT INTO users (email,name) VALUES (?,?)', [req.body.user.email, req.body.user.name]);
            // userId = r.insertId;
        } else {
            userId = userRows[0].id;
        }

        const [b] = await conn.query('INSERT INTO bookings (user_id,status,currency,total_amount) VALUES (?,?,?,?)', [userId, 'pending', req.body.currency || 'USD', req.body.total || 0]);
        const bookingId = b.insertId;

        // Create a Stripe PaymentIntent for the amount
        // const paymentIntent = await paystack.paymentIntents.create({
        //     amount: Math.round((req.body.total || 0) * 100),
        //     currency: req.body.currency || 'usd',
        //     metadata: { booking_id: bookingId.toString() }
        // });

        await conn.query('INSERT INTO payments (booking_id,paystack_payment_intent,amount,currency,status) VALUES (?,?,?,?,?)', [bookingId, paymentIntent.id, req.body.total, req.body.currency || 'USD', paymentIntent.status]);

        await conn.commit();
        res.json({ bookingId, clientSecret: paymentIntent.client_secret });
    } catch (err) {
        await conn.rollback();
        console.error(err);
        res.status(500).json({ error: err.message });
    } finally {
        conn.release();
    }
});

// Add Travel Information
app.post('/add-traveler', async (req, res) => {

    // 1. Validation using Joi Library
    // Make sure to define 'travelCheck' in your validation file
    const { error } = validation.travelCheck(req.body);

    if (error) {
        console.log(error);
        return res.status(400).json({
            success: false,
            message: error.details[0].message
        });
    }

    try {
        // 2. Prepare the SQL query
        const sql = `
            INSERT INTO travel_info (
                id_user, title, traveler_type, first_name, last_name, 
                middle_name, gender, date_of_birth, email, 
                mobile_number, nationality, passport_number, passport_expiry_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

        const values = [
            req.body.id_user,
            req.body.title,
            req.body.traveler_type,
            req.body.first_name,
            req.body.last_name,
            req.body.middle_name || null, // Handle optional field
            req.body.gender,
            req.body.date_of_birth,
            req.body.email,
            req.body.mobile_number,
            req.body.nationality,
            req.body.passport_number,
            req.body.passport_expiry_date
        ];

        // 3. Execute the query
        const [result] = await db.query(sql, values);

        if (result.affectedRows > 0) {
            res.status(200).json({
                success: true,
                message: "Travel information saved successfully",
                insertId: result.insertId // Returns the ID of the new row
            });
        } else {
            res.status(400).json({
                success: false,
                message: "Failed to save information"
            });
        }

    } catch (err) {
        console.error(err);
        res.status(500).json({
            success: false,
            message: "An internal server error occurred"
        });
    }
});