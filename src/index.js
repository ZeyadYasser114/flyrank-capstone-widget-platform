const express = require('express');
const cors = require('cors');
const app = express();
const pool = require('./db.js');
const rateLimit = require('express-rate-limit');
const { sendNotification } = require('./services/notifications.service.js');
const { enrichIp } = require('./services/enrichment.service.js');

const submissionLimiter = rateLimit({
    windowMs: 60  * 1000,
    max: 5,
    message: {error: 'Too many submissions, please try again later.'}
});

app.use(express.json());
app.use(cors());

const PORT = 3000;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}/`);
})

app.post('/widgets', async (req, res) => {
    const { type, title, description, fields, button_text } = req.body;
    if (!type || !title) {
        return res.status(400).json({error: 'type and title are required'});
    }
    const result = await pool.query(
        "INSERT INTO widgets (type, title, description, fields, button_text) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [type, title, description, JSON.stringify(fields), button_text]
    );

    res.status(201).json(result.rows[0]);
});

app.get('/widgets/:id/config', async (req, res) => {
    const id = parseInt(req.params.id);
    const resultId = await pool.query('SELECT * FROM widgets WHERE id = $1', [id]);
    if (resultId.rows.length === 0) {
        return res.status(404).json({ error: 'Widget not found' });
    }
    res.set('Cache-Control', 'public, max-age=300');
    res.json(resultId.rows[0]);
});

app.post('/submissions', submissionLimiter, async (req, res) => {
    const { widget_id, honeypot } = req.body;

    if (honeypot) {
        return res.status(201).json({ message: 'Submission recieved' });
    }

    const widgetCheck = await pool.query('SELECT * FROM widgets WHERE id = $1', [widget_id]);
    if (widgetCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Widget not found' });
    }

    const requiredField = widgetCheck.rows[0].fields;
    const submittedData = req.body.data;
    const isValid = requiredField.every(field => submittedData[field] !== undefined);
    if (!isValid) {
        return res.status(400).json({ error: 'Missing required fields' });
    }

    const { country, city } = await enrichIp(req.ip);

    const resultSubmission = await pool.query(
        "INSERT INTO submissions (widget_id, data, ip_address, country, city) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [widget_id, JSON.stringify(submittedData), req.ip, country, city]
    );

    try {
        await sendNotification(resultSubmission.rows[0]);
    } catch (err) {
        console.log('Notification failed (non-critical):', err.message);
    }

    res.status(201).json(resultSubmission.rows[0]);
});



app.get('/public/test', (req, res) => {
    res.json({message: 'Hello from the widget platfrom'});
})