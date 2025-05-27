require('dotenv').config();
const puppeteer = require('puppeteer'); // Změna na puppeteer místo puppeteer-core
const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const CHANNEL_URL = 'https://kick.com/bigwsonny';
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

let notifiedToday = false;

// Funkce pro kontrolu, zda je stream živý
async function checkIfStreamIsLive() {
  try {
    const res = await fetch(CHANNEL_URL);
    const html = await res.text();
    const data = JSON.parse(html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/)[1]);
    const status = data?.props?.pageProps?.stream?.status || 'OFFLINE';
    return status === 'LIVE';
  } catch (error) {
    console.error('❌ Chyba při kontrole streamu:', error);
    return false;
  }
}

// Funkce pro odeslání notifikace na Discord
async function sendDiscordNotification(message) {
  try {
    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (channel) {
      await channel.send(message);
      console.log('📢 Notifikace poslána:', message);
    }
  } catch (err) {
    console.error('❌ Nelze poslat zprávu:', err.message);
  }
}

// Funkce pro monitorování streamu
async function monitorStream() {
  const isLive = await checkIfStreamIsLive();
  if (isLive && !notifiedToday) {
    await sendDiscordNotification(`🚀 Stream začal! Sleduj zde: ${CHANNEL_URL}`);
    notifiedToday = true;
  }
}

// Reset notifikace o půlnoci
function scheduleMidnightReset() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const msUntilMidnight = nextMidnight - now;

  setTimeout(() => {
    notifiedToday = false;
    console.log('✅ Reset notifikace, nový den.');
    scheduleMidnightReset();
  }, msUntilMidnight);
}
scheduleMidnightReset();

client.once('ready', () => {
  console.log(`✅ Bot je online jako ${client.user.tag}`);
  setInterval(monitorStream, 5 * 60 * 1000); // Každých 5 minut kontrola streamu
});

client.login(process.env.DISCORD_TOKEN);
