const axios = require('axios');
const cheerio = require('cheerio');

export default async function handler(req, res) {
    try {
        const url = 'https://thelocalgirl.com/calendar/hoboken/';
        console.log(`Fetching ${url}...`);

        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        const html = response.data;
        const $ = cheerio.load(html);
        const h2Count = $('h2').length;

        // Extract first few H2s
        const h2Texts = [];
        $('h2').each((i, el) => {
            if (i < 5) h2Texts.push($(el).text().trim());
        });

        res.status(200).json({
            status: 'success',
            url,
            contentLength: html.length,
            h2Count,
            h2Sample: h2Texts,
            first500Chars: html.substring(0, 500)
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            stack: error.stack
        });
    }
}
