const puppeteer = require('puppeteer');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// ==== CONFIGURATION ====
const WEBSITE_URL = 'https://drugtestcheck.com';
const PIN = '8929856';
const LAST_NAME = 'Ross';
const DISCORD_WEBHOOK_URL = 'https://discord.com/api/webhooks/1423721130363191368/8-an_fshquIFgxQ7PRlZE_Qe_PwMSBSMaBE3Oe5Y3NhkMXkIvkSLCmDTnRR9RZ1IVqNb';

// Helper: Send message to Discord
async function sendToDiscord(message) {
  await fetch(DISCORD_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: message }),
  });
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

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const page = await browser.newPage();
  await page.setUserAgent(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  );

  try {
    await page.goto(WEBSITE_URL, { waitUntil: 'networkidle2', timeout: 30000 });

    // Fill in the form
    await page.waitForSelector('#callInputCode', { timeout: 15000 });
    await page.type('#callInputCode', PIN);
    
    await page.waitForSelector('#lettersInputLastName', { timeout: 15000 });
    await page.type('#lettersInputLastName', LAST_NAME);

    // Click submit and wait for response
    await page.click('button[type="submit"]');
    
    // Wait a moment for the page to process
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Try multiple possible selectors for the result
    let message = 'Message not found';
    
    try {
      // First, try waiting for the result container
      await page.waitForSelector('#en-result', { timeout: 15000 });
      
      // Then try to get the message from label
      message = await page.evaluate(() => {
        const label = document.querySelector('label[for="reply"]');
        if (label) return label.innerText.trim();
        
        // Fallback: try to get any text from #en-result
        const result = document.querySelector('#en-result');
        if (result) return result.innerText.trim();
        
        return 'Message not found';
      });
    } catch (selectorError) {
      console.log('Primary selector failed, trying fallback...');
      
      // Fallback: look for any result text on the page
      message = await page.evaluate(() => {
        // Try common result selectors
        const selectors = [
          'label[for="reply"]',
          '#en-result',
          '.result-message',
          '[class*="result"]',
          '[id*="result"]'
        ];
        
        for (const sel of selectors) {
          const el = document.querySelector(sel);
          if (el && el.innerText.trim()) {
            return el.innerText.trim();
          }
        }
        
        return 'Could not find result message';
      });
    }

    const dateStr = dateNY.toLocaleDateString('en-US');
    console.log(`[${dateStr}] Website message:`, message);

    if (message.startsWith('You are scheduled for a drug test today')) {
      await sendToDiscord(`Drug test today - ${dateStr}`);
    } else if (message.includes('Message not found') || message.includes('Could not find')) {
      await sendToDiscord(`Warning: Could not verify result on ${dateStr}. Please check manually.`);
    } else {
      await sendToDiscord(`No drug test today - ${dateStr}`);
    }

  } catch (err) {
    console.error('Error during check:', err);
    await sendToDiscord(`Error checking drug test: ${err.message}`);
  } finally {
    await browser.close();
  }
}

// Run once then exit
if (require.main === module) {
  checkDrugTest().finally(() => process.exit(0));
}
