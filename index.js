require('dotenv').config();
require('./keeprunning'); // Mini Express keep-alive server

const puppeteer = require('puppeteer'); // Změna na puppeteer místo puppeteer-core
const { Client, GatewayIntentBits } = require('discord.js');
const cheerio = require('cheerio');
const fetch = require('node-fetch');
const fs = require('fs');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const CHANNEL_URL = 'https://kick.com/bigwsonny';
const DISCORD_CHANNEL_ID = process.env.DISCORD_CHANNEL_ID;

let usersWhoTypedOne = new Set();
let notifiedToday = false;
let isWatchingStream = false;
let browser = null;
let page = null;

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

async function startKickChatListener() {
  if (browser) return;

  browser = await puppeteer.launch({
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  page = await browser.newPage();
  await page.goto(CHANNEL_URL);

  await page.exposeFunction('onNewChatMessage', (username, message) => {
    if (message.trim() === '1') {
      usersWhoTypedOne.add(username);
      console.log(`✅ ${username} napsal 1`);
    }
  });

  await page.evaluate(() => {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          const username = node?.querySelector('.username')?.innerText;
          const message = node?.querySelector('.message-text')?.innerText;
          if (username && message) {
            window.onNewChatMessage(username, message);
          }
        }
      }
    });

    const chat = document.querySelector('.chat-messages-container');
    if (chat) observer.observe(chat, { childList: true });
  });

  console.log('🎥 Sleduji chat na Kick.com');
}

async function stopKickChatListener() {
  if (!browser) return;
  await browser.close();
  browser = null;
  page = null;
  console.log('🛑 Přestal jsem sledovat chat.');
}

async function checkIfStreamIsLive() {
  try {
    const res = await fetch(CHANNEL_URL);
    const html = await res.text();
    const $ = cheerio.load(html);
    const data = JSON.parse($('#__NEXT_DATA__').html());
    const status = data?.props?.pageProps?.stream?.status || 'OFFLINE';
    return status === 'LIVE';
  } catch {
    return false;
  }
}

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

async function monitorStream() {
  const isLive = await checkIfStreamIsLive();
  if (isLive && !notifiedToday) {
    await sendDiscordNotification(`🚀 Stream začal! Sleduj zde: ${CHANNEL_URL}`);
    notifiedToday = true;
  }
}

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!join') {
    if (isWatchingStream) {
      message.channel.send('✅ Už sleduji stream.');
    } else {
      message.channel.send('🔄 Připojuji se ke streamu...');
      isWatchingStream = true;
      await startKickChatListener();
    }
  }

  if (message.content === '!leave') {
    if (!isWatchingStream) {
      message.channel.send('⚠️ Bot nesleduje žádný stream.');
    } else {
      await stopKickChatListener();
      isWatchingStream = false;
      message.channel.send('🛑 Sledování ukončeno.');
    }
  }

  if (message.content === '!reset') {
    usersWhoTypedOne.clear();
    message.channel.send('🔄 Seznam uživatelů resetován.');
  }

  if (message.content === '!kdo') {
    if (usersWhoTypedOne.size === 0) {
      message.channel.send('❌ Nikdo zatím nenapsal "1".');
    } else {
      message.channel.send(`📝 Uživatele: ${[...usersWhoTypedOne].join(', ')}`);
    }
  }
});

client.once('ready', () => {
  console.log(`✅ Bot je online jako ${client.user.tag}`);
  setInterval(monitorStream, 5 * 60 * 1000); // Každých 5 minut kontrola streamu
});

client.login(process.env.DISCORD_TOKEN);
