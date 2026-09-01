const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function init() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS widgets (
            id SERIAL PRIMARY KEY,
            type TEXT NOT NULL,
            title TEXT NOT NULL,
            description TEXT,
            fields JSONB NOT NULL,
            button_text TEXT NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);

    await pool.query(`
        CREATE TABLE IF NOT EXISTS submissions (
            id SERIAL PRIMARY KEY,
            widget_id INT NOT NULL,
            data JSONB NOT NULL,
            ip_address TEXT NOT NULL,
            country TEXT,
            city TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);

    await pool.query(`
        ALTER TABLE widgets ADD COLUMN IF NOT EXISTS tenant_id TEXT
    `);
}

init();

module.exports = pool;