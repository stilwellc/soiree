const axios = require('axios');
const cheerio = require('cheerio');

async function inspect() {
    const url = 'https://thelocalgirl.com/calendar/event/the-lola-grand-opening-in-hoboken/';
    console.log(`Fetching ${url}...`);
    const res = await axios.get(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' }
    });
    const $ = cheerio.load(res.data);

    console.log('--- Date Candidates ---');

    // Method 1: Common Event Classes
    console.log('1. Classes:');
    ['.event-date', '.date', '.time', '.tribe-event-date-start', '.tribe-events-schedule', '.eventitem-meta-date', '.entry-date', '.published'].forEach(sel => {
        const txt = $(sel).text().trim();
        if (txt) console.log(`   ${sel}: "${txt}"`);
    });

    // Method 2: Meta Tags
    console.log('\n2. Meta Tags:');
    $('meta[property*="time"], meta[property*="date"]').each((i, el) => {
        console.log(`   ${$(el).attr('property')}: "${$(el).attr('content')}"`);
    });

    // Method 3: JSON-LD
    console.log('\n3. JSON-LD:');
    const jsonLd = $('script[type="application/ld+json"]').html();
    if (jsonLd) {
        console.log(jsonLd.substring(0, 500) + '...');
    } else {
        console.log('   No JSON-LD found');
    }

    // Method 4: Header Siblings
    console.log('\n4. H1 Siblings:');
    console.log('   H1 Text:', $('h1').text().trim());
    console.log('   Next P:', $('h1').next('p').text().trim());
    console.log('   Next Div:', $('h1').next('div').text().trim());

    // Method 5: Look for "February 7, 2026" specifically context
    console.log('\n5. Context for target date:');
    const body = $('body').text();
    const idx = body.indexOf('February 7, 2026');
    if (idx !== -1) {
        console.log('   Found date in body text. Context:');
        console.log(body.substring(idx - 50, idx + 50).replace(/\n/g, ' '));
    } else {
        console.log('   Target date text not found in body dump?');
    }
}

inspect();
