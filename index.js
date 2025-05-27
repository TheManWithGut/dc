require('dotenv').config();
const puppeteer = require('puppeteer-core');
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const cheerio = require('cheerio');
const fetch = require('node-fetch'); // pokud nemáš, nainstaluj npm i node-fetch@2

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const CHANNEL_URL = 'https://kick.com/bigwsonny';
const DISCORD_CHANNEL_ID = 'TVŮJ_DISCORD_KANÁL_ID'; // nahraď správným ID kanálu

let usersWhoTypedOne = new Set();
let notifiedToday = false;
let isWatchingStream = false;
let browser = null;
let page = null;

// Pomocná funkce pro reset notifikace o půlnoci
function scheduleMidnightReset() {
  const now = new Date();
  const nextMidnight = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0, 0, 0, 0
  );
  const msUntilMidnight = nextMidnight.getTime() - now.getTime();

  setTimeout(() => {
    notifiedToday = false;
    console.log('✅ Reset notifikace, nový den.');
    scheduleMidnightReset();
  }, msUntilMidnight);
}

scheduleMidnightReset();

// Funkce pro sledování chatu na Kick.com
async function startKickChatListener() {
  if (browser) {
    console.log('Bot už sleduje stream.');
    return;
  }

  browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    headless: true,
  });

  page = await browser.newPage();

  await page.goto(CHANNEL_URL);

  await page.waitForSelector('.chat-message'); // uprav podle skutečné třídy na Kick.com

  await page.exposeFunction('onNewChatMessage', (username, message) => {
    if (message.trim() === '1') {
      usersWhoTypedOne.add(username);
      console.log(`Uživatel ${username} napsal 1 — přidán do seznamu.`);
    }
  });

  await page.evaluate(() => {
    const chatContainer = document.querySelector('.chat-messages-container'); // uprav podle skutečného selektoru
    if (!chatContainer) {
      console.error('Chat container nenalezen');
      return;
    }

    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const usernameElem = node.querySelector('.username'); // uprav dle struktury
            const messageElem = node.querySelector('.message-text'); // uprav dle struktury

            if (usernameElem && messageElem) {
              const username = usernameElem.innerText;
              const message = messageElem.innerText;
              window.onNewChatMessage(username, message);
            }
          }
        }
      }
    });

    observer.observe(chatContainer, { childList: true });
  });

  console.log('Bot začal sledovat chat na Kicku.');
}

// Funkce pro odpojení bota od chatu
async function stopKickChatListener() {
  if (!browser) {
    console.log('Bot již nesleduje stream.');
    return;
  }

  await browser.close();
  browser = null;
  page = null;
  console.log('Bot přestal sledovat chat.');
}

// Funkce pro kontrolu, jestli je stream live
async function checkIfStreamIsLive() {
  try {
    const res = await fetch(CHANNEL_URL);
    if (!res.ok) return false;

    const text = await res.text();
    const $ = cheerio.load(text);
    const jsonText = $('#__NEXT_DATA__').html();
    if (!jsonText) return false;

    const data = JSON.parse(jsonText);
    const streamStatus = data.props.pageProps?.stream?.status || 'OFFLINE';

    return streamStatus === 'LIVE';
  } catch {
    return false;
  }
}

// Funkce pro odeslání notifikace na Discord
async function sendDiscordNotification(message) {
  const channel = await client.channels.fetch(DISCORD_CHANNEL_ID);
  if (!channel) return console.error('Kanál nenalezen');
  await channel.send(message);
  console.log('Notifikace poslána:', message);
}

// Monitorování streamu
async function monitorStream() {
  const isLive = await checkIfStreamIsLive();

  if (isLive) {
    if (!notifiedToday) {
      await sendDiscordNotification(`🚀 Stream právě začal na ${CHANNEL_URL}`);
      notifiedToday = true;
    }
  }
}

// Příkazy pro bota
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!join') {
    if (isWatchingStream) {
      message.channel.send('Bot už sleduje tento stream.');
    } else {
      message.channel.send('Bot se připojuje k streamu a začíná sledovat chat...');
      isWatchingStream = true;
      startKickChatListener();
    }
  }

  if (message.content === '!leave') {
    if (isWatchingStream) {
      message.channel.send('Bot přestává sledovat chat.');
      isWatchingStream = false;
      await stopKickChatListener();
    } else {
      message.channel.send('Bot ještě nesleduje žádný chat.');
    }
  }

  if (message.content === '!reset') {
    usersWhoTypedOne.clear();
    message.channel.send('Seznam uživatelů byl vymazán.');
    console.log('Seznam uživatelů resetován.');
  }

  if (message.content === '!kdo') {
    if (usersWhoTypedOne.size === 0) {
      message.channel.send('Nikdo zatím nenapsal "1".');
    } else {
      message.channel.send(`Uživatelé, kteří napsali "1": ${[...usersWhoTypedOne].join(', ')}`);
    }
  }
});

client.once('ready', () => {
  console.log(`Bot je online jako ${client.user.tag}`);
  setInterval(monitorStream, 86400000);
});

client.login(process.env.DISCORD_TOKEN);
