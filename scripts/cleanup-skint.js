const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

async function cleanup() {
    try {
        console.log('Connecting to database...');

        // Check count before deletion
        const beforeResult = await pool.query("SELECT COUNT(*) as count FROM events WHERE url LIKE '%theskint.com%'");
        const countBefore = parseInt(beforeResult.rows[0].count);
        console.log(`Found ${countBefore} events from The Skint.`);

        if (countBefore > 0) {
            console.log('Deleting events...');
            await pool.query("DELETE FROM events WHERE url LIKE '%theskint.com%'");
            console.log('✅ Deleted successfully.');
        } else {
            console.log('No events to delete.');
        }

        pool.end();
    } catch (error) {
        console.error('Error during cleanup:', error);
        pool.end();
        process.exit(1);
    }
}

cleanup();
