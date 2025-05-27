require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// Vytvoření bota s potřebnými "intenty" – co bot sleduje
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// Přihlášení do Discordu pomocí tokenu z proměnné prostředí
client.login(process.env.DISCORD_TOKEN);

// Když je bot připraven
client.once('ready', () => {
  console.log(`✅ Bot je online jako ${client.user.tag}`);
});

// Odpověď na zprávy
client.on('messageCreate', message => {
  if (message.author.bot) return; // Ignoruj bota
  if (message.content === '!ping') {
    message.channel.send('🏓 Pong!');
  }
});

// Ošetření případných chyb (doporučeno na Renderu)
process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});
