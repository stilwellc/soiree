const puppeteer = require('puppeteer');

/**
 * Debug script to inspect page structure
 */
async function inspectPage(url) {
    let browser;
    try {
        console.log('Launching browser...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36');

        console.log(`Navigating to ${url}...`);
        await page.goto(url, {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        await new Promise(resolve => setTimeout(resolve, 3000));

        console.log('\n=== Page Structure Analysis ===\n');

        const analysis = await page.evaluate(() => {
            const results = {
                title: document.title,
                bodyClasses: document.body.className,
                mainSelectors: {},
                sampleLinks: []
            };

            // Check common selectors
            const selectors = [
                'article',
                '.event',
                '.card',
                '[class*="event"]',
                '[class*="Event"]',
                '[class*="card"]',
                '[class*="Card"]',
                '.listing',
                '[class*="listing"]'
            ];

            selectors.forEach(sel => {
                const elems = document.querySelectorAll(sel);
                if (elems.length > 0) {
                    results.mainSelectors[sel] = {
                        count: elems.length,
                        sampleClasses: elems[0].className,
                        sampleText: elems[0].textContent.trim().substring(0, 100)
                    };
                }
            });

            // Get sample links
            const links = document.querySelectorAll('a[href*="event"], a[href*="/event"]');
            links.forEach((link, i) => {
                if (i < 5) {
                    results.sampleLinks.push({
                        text: link.textContent.trim().substring(0, 80),
                        href: link.href,
                        classes: link.className
                    });
                }
            });

            return results;
        });

        console.log('Page Title:', analysis.title);
        console.log('\nBody Classes:', analysis.bodyClasses);

        console.log('\n--- Selectors Found ---');
        Object.entries(analysis.mainSelectors).forEach(([sel, data]) => {
            console.log(`\n${sel}:`);
            console.log(`  Count: ${data.count}`);
            console.log(`  Classes: ${data.sampleClasses}`);
            console.log(`  Sample: ${data.sampleText}...`);
        });

        console.log('\n--- Sample Event Links ---');
        analysis.sampleLinks.forEach((link, i) => {
            console.log(`\n${i + 1}. ${link.text}...`);
            console.log(`   URL: ${link.href}`);
            console.log(`   Classes: ${link.classes}`);
        });

        await browser.close();

    } catch (error) {
        console.error('Error:', error.message);
        if (browser) await browser.close();
    }
}

const url = process.argv[2] || 'https://visitnj.org/nj/events';
inspectPage(url);
