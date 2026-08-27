const express = require('express');
const cors = require('cors');
const app = express();
const pool = require('./db.js');
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

app.get('/public/test', (req, res) => {
    res.json({message: 'Hello from the widget platfrom'});
})