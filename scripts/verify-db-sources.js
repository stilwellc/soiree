const { Pool } = require('pg');
require('dotenv').config({ path: '.env.local' });

const pool = new Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false }
});

async function verifySources() {
    try {
        console.log('--- Event Source Counts ---');
        const sourceCounts = await pool.query(`
      SELECT source, COUNT(*) 
      FROM events 
      GROUP BY source 
      ORDER BY count DESC
    `);

        sourceCounts.rows.forEach(row => {
            console.log(`${row.source || 'Unknown'}: ${row.count}`);
        });

        console.log('\n--- Recent Events from "The Local Girl" ---');
        const localGirlEvents = await pool.query(`
      SELECT name, date, start_date, created_at 
      FROM events 
      WHERE source = 'The Local Girl' 
      ORDER BY created_at DESC 
      LIMIT 5
    `);

        if (localGirlEvents.rows.length === 0) {
            console.log('No events found from "The Local Girl".');
        } else {
            localGirlEvents.rows.forEach(evt => {
                console.log(`- ${evt.name} (${evt.date}) [Added: ${evt.created_at}]`);
            });
        }

    } catch (err) {
        console.error('Database query failed:', err.message);
    } finally {
        await pool.end();
    }
}

verifySources();
