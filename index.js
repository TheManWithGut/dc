// Načte proměnné z .env souboru
require('dotenv').config();

// Načte potřebné moduly z discord.js
const { Client, GatewayIntentBits } = require('discord.js');

// Vytvoření instance bota s potřebnými právy (intenty)
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Událost: bot je přihlášen a připraven
client.once('ready', () => {
  console.log(`✅ Bot je přihlášen jako ${client.user.tag}`);
});

// Událost: někdo pošle zprávu
client.on('messageCreate', (message) => {
  // Ignoruj zprávy od botů
  if (message.author.bot) return;

  // Reakce na příkaz !ping
  if (message.content === '!ping') {
    message.channel.send('🏓 Pong!');
  }
});

// Přihlášení bota pomocí tokenu z .env
client.login(process.env.DISCORD_TOKEN);
