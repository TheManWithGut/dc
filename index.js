require('dotenv').config();
require('./keeprunning.js'); // Mini server

const { Client, GatewayIntentBits } = require('discord.js');
const fetch = require('node-fetch');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const CHANNEL_URL = 'https://kick.com/endermanch1';
const DISCORD_CHANNEL_ID = '1376926766408405113';

let notifiedToday = false;

async function checkIfStreamIsLive() {
  try {
    const res = await fetch(CHANNEL_URL);
    const html = await res.text();
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">(.+?)<\/script>/);
    if (!match || !match[1]) throw new Error("Stream data nenalezena");

    const data = JSON.parse(match[1]);
    const status = data?.props?.pageProps?.stream?.status || 'OFFLINE';
    return status === 'LIVE';
  } catch (error) {
    console.error('❌ Chyba při kontrole streamu:', error.message);
    return false;
  }
}

async function sendDiscordNotification(message) {
  try {
    const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
    if (channel) {
      await channel.send(message);
      console.log('📢 Notifikace poslána:', message);
    } else {
      console.error('❌ Kanál nenalezen.');
    }
  } catch (err) {
    console.error('❌ Nelze poslat zprávu:', err.message);
  }
}

async function monitorStream() {
  const isLive = await checkIfStreamIsLive();
  if (isLive && !notifiedToday) {
    await sendDiscordNotification(`🚀 Stream začal! Sleduj zde: ${CHANNEL_URL}`);
    notifiedToday = true;
  }
}

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
  setInterval(monitorStream, 5 * 60 * 1000);
});

client.login(process.env.DISCORD_TOKEN);
