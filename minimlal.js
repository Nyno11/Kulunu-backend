const express = require('express');
const app = express();

app.use(express.json());

app.post('/test', (req, res) => {
    res.json({ success: true });
});

app.listen(8080, () => {
    console.log('Server running on 8080');
});
