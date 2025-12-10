import express from 'express';
var app = express.Router();
export default app;



// 4) Stripe webhook to confirm payment succeeded, then call Amadeus Create Orders and email ticket
app.post('/webhook/paystack', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['paystack-signature'];
    let event;
    try {
        event = paystack.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed.', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'payment_intent.succeeded') {
        const pi = event.data.object;
        const bookingId = pi.metadata.booking_id;
        // update payment status
        const conn = await pool.getConnection();
        try {
            await conn.beginTransaction();
            await conn.query('UPDATE payments SET status = ? WHERE paystack_payment_intent = ?', [pi.status, pi.id]);

            // Load booking info - in real app you'd also store the chosen offer and passengers; here we assume client sent them to Amadeus only after payment
            // For demonstration: we'll assume the client attached the full Amadeus pricedOffer and passengers in metadata (not recommended for prod due to size).

            // Retrieve booking and user
            const [bk] = await conn.query('SELECT * FROM bookings WHERE id = ?', [bookingId]);
            const booking = bk[0];
            const [u] = await conn.query('SELECT * FROM users WHERE id = ?', [booking.user_id]);
            const user = u[0];

            // IMPORTANT: in real flow you must store the chosen pricedOffer and passenger data earlier in DB securely.
            // For demo, we will assume we have a small sample payload (you must replace this with real stored offer & passengers)
            const sampleOrderPayload = {
                "data": {
                    "type": "flight-order",
                    "flightOffers": [],
                    "travelers": [
                        {
                            "id": "1",
                            "dateOfBirth": "1990-01-01",
                            "name": { "firstName": "John", "lastName": "Doe" },
                            "gender": "MALE",
                            "contact": { "emailAddress": user.email }
                        }
                    ]
                }
            };

            // call Amadeus Create Order
            const orderData = await amadeusSvc.createOrder(sampleOrderPayload);

            // update booking with amadeus order id and pnr if available
            const amadeusOrderId = orderData.data && orderData.data.id ? orderData.data.id : null;
            const pnr = (orderData.data && orderData.data.remarks) ? JSON.stringify(orderData.data.remarks) : null;
            await conn.query('UPDATE bookings SET status=?, amadeus_order_id=?, pnr=? WHERE id=?', ['booked', amadeusOrderId, pnr, bookingId]);

            // Send an email with attached PDF ticket
            await sendTicketEmail(user.email, 'Your flight booking confirmation', 'Thank you for booking. See attached itinerary.', booking, orderData);

            await conn.commit();
        } catch (err) {
            await conn.rollback();
            console.error(err);
        } finally {
            conn.release();
        }
    }

    res.json({ received: true });
});