const puppeteer = require('puppeteer');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const fs = require('fs');
const path = require('path');

// ==== CONFIGURATION ====
const WEBSITE_URL = 'https://drugtestcheck.com';
const PIN = '8929856';
const LAST_NAME = 'Ross';
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1423721130363191368/8-an_fshquIFgxQ7PRlZE_Qe_PwMSBSMaBE3Oe5Y3NhkMXkIvkSLCmDTnRR9RZ1IVqNb';

// Helper: Send message to Discord
async function sendToDiscord(message) {
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: message }),
    });
    console.log('Sent to Discord:', message);
  } catch (err) {
    console.error('Failed to send to Discord:', err.message);
  }
}

// Core task
async function checkDrugTest() {
  const today = new Date();
  const nyTime = today.toLocaleString('en-US', { timeZone: 'America/New_York' });
  const dateNY = new Date(nyTime);
  
  if (dateNY.getDay() === 0) {
    console.log('Sunday: skipping check.');
    return;
  }

  let browser;
  try {
    console.log('Launching browser...');
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });

    const page = await browser.newPage();
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    );

    console.log('Navigating to website...');
    await page.goto(WEBSITE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    console.log('Waiting for PIN input...');
    await page.waitForSelector('#callInputCode', { timeout: 15000 });
    await page.type('#callInputCode', PIN);
    console.log('PIN entered');
    
    console.log('Waiting for last name input...');
    await page.waitForSelector('#lettersInputLastName', { timeout: 15000 });
    await page.type('#lettersInputLastName', LAST_NAME);
    console.log('Last name entered');

    console.log('Clicking submit button...');
    await page.click('button[type="submit"]');
    
    console.log('Waiting for page to process...');
    await new Promise(resolve => setTimeout(resolve, 4000));

    // Save screenshot to current directory
    const screenshotPath = path.join(process.cwd(), 'debug-screenshot.png');
    await page.screenshot({ path: screenshotPath });
    console.log('Screenshot saved to:', screenshotPath);

    // Get all text content from page
    const allText = await page.evaluate(() => document.body.innerText);
    console.log('=== PAGE TEXT CONTENT ===');
    console.log(allText);
    console.log('=== END PAGE TEXT ===');

    // Save HTML to file for inspection
    const htmlPath = path.join(process.cwd(), 'debug-page.html');
    const pageHTML = await page.content();
    fs.writeFileSync(htmlPath, pageHTML);
    console.log('HTML saved to:', htmlPath);

    // Try to find the result message
    let message = await page.evaluate(() => {
      // Try multiple selectors
      const selectors = [
        'label[for="reply"]',
        '#en-result',
        '#en-result label',
        '.result',
        '.message',
        '[class*="result"]',
        '[id*="result"]',
        'div.alert',
        'p.message'
      ];
      
      for (const sel of selectors) {
        const el = document.querySelector(sel);
        if (el && el.innerText && el.innerText.trim()) {
          console.log('Found with selector:', sel);
          return el.innerText.trim();
        }
      }
      
      // If nothing found, return all visible text
      return document.body.innerText.trim();
    });

    const dateStr = dateNY.toLocaleDateString('en-US');
    console.log(`[${dateStr}] Found message:`, message);

    if (message && message.toLowerCase().includes('scheduled') && message.toLowerCase().includes('drug test') && message.toLowerCase().includes('today')) {
      await sendToDiscord(`Drug test today - ${dateStr}`);
    } else if (!message || message.length < 10) {
      await sendToDiscord(`Warning: Could not verify result on ${dateStr}. Check debug files. Message: "${message}"`);
    } else {
      await sendToDiscord(`No drug test today - ${dateStr}`);
    }

  } catch (err) {
    console.error('ERROR:', err);
    await sendToDiscord(`Error checking drug test: ${err.message}`);
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
  }
}

// Run once then exit
if (require.main === module) {
  checkDrugTest().finally(() => {
    console.log('Script finished');
    process.exit(0);
  });
}
