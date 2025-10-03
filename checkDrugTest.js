const puppeteer = require('puppeteer');
const fetch = require('node-fetch');
const cron = require('node-cron');

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

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();
  try {
    await page.goto(WEBSITE_URL, { waitUntil: 'networkidle2' });

    // Fill in the form
    await page.type('input[name="pin"]', PIN);
    await page.type('input[name="lname"]', LAST_NAME);

    // Submit the form
    await Promise.all([
      page.click('button[type="submit"]'),
      page.waitForNavigation({ waitUntil: 'networkidle2' }),
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

// Schedule: 7:01 AM New York Time (Mon–Sat)
cron.schedule('1 7 * * 1-6', () => {
  console.log('Running scheduled check...');
  checkDrugTest();
}, {
  timezone: 'America/New_York'
});

// For manual testing
if (require.main === module) {
  checkDrugTest();
}
