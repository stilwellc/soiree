const { Pool } = require('pg');
const crypto = require('crypto');

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Create subscribers table if it doesn't exist
        await pool.query(`
      CREATE TABLE IF NOT EXISTS subscribers (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        region VARCHAR(50) NOT NULL DEFAULT 'nyc',
        categories JSONB DEFAULT '[]'::jsonb,
        unsubscribe_token VARCHAR(64) UNIQUE NOT NULL,
        active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      )
    `);

        // POST — subscribe or update preferences
        if (req.method === 'POST') {
            const { email, region, categories } = req.body || {};

            if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
                return res.status(400).json({ success: false, error: 'Valid email is required' });
            }

            const cleanEmail = email.toLowerCase().trim();
            const cleanRegion = region || 'nyc';
            const cleanCategories = Array.isArray(categories) ? categories : [];
            const token = crypto.randomBytes(32).toString('hex');

            // Upsert: insert or update if email already exists
            const result = await pool.query(`
        INSERT INTO subscribers (email, region, categories, unsubscribe_token)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (email) DO UPDATE SET
          region = EXCLUDED.region,
          categories = EXCLUDED.categories,
          active = true,
          updated_at = NOW()
        RETURNING id, email, region, categories
      `, [cleanEmail, cleanRegion, JSON.stringify(cleanCategories), token]);

            return res.status(200).json({
                success: true,
                message: 'Subscribed successfully',
                subscriber: result.rows[0]
            });
        }

        // DELETE — unsubscribe via token
        if (req.method === 'DELETE') {
            const { token } = req.query;

            if (!token) {
                return res.status(400).json({ success: false, error: 'Unsubscribe token is required' });
            }

            const result = await pool.query(`
        UPDATE subscribers SET active = false, updated_at = NOW()
        WHERE unsubscribe_token = $1
        RETURNING email
      `, [token]);

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Subscription not found' });
            }

            return res.status(200).json({
                success: true,
                message: `${result.rows[0].email} has been unsubscribed`
            });
        }

        // GET — count of active subscribers (public)
        if (req.method === 'GET') {
            const result = await pool.query(`
        SELECT COUNT(*) as count FROM subscribers WHERE active = true
      `);

            return res.status(200).json({
                success: true,
                count: parseInt(result.rows[0].count)
            });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Subscribe API Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
