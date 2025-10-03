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
    await page.goto(WEBSITE_URL, { waitUntil: 'networkidle2' });

    // Fill in the form
    await page.waitForSelector('#callInputCode');
    await page.type('#callInputCode', PIN);
    await page.waitForSelector('#lettersInputLastName');
    await page.type('#lettersInputLastName', LAST_NAME);

    // Submit the form
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForSelector('#en-result', { timeout: 10000 })
    ]);


    // Extract the result message
    const message = await page.evaluate(() => {
      const label = document.querySelector('label[for="reply"]');
      return label ? label.innerText.trim() : 'Message not found';
    });

    const dateStr = dateNY.toLocaleDateString('en-US');
    console.log(`[${dateStr}] Website message:`, message);

    if (message.startsWith('You are scheduled for a drug test today')) {
      await sendToDiscord(`Drug test today - ${dateStr}`);
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


