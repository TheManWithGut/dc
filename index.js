require('dotenv').config();
require('./keeprunning'); // Spustí web server na pozadí

const { Client, GatewayIntentBits } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once('ready', () => {
  console.log(`✅ Bot je online jako ${client.user.tag}`);
});

client.on('messageCreate', message => {
  if (message.author.bot) return;
  if (message.content === '!ping') {
    message.channel.send('🏓 Pong!');
  }
});

client.login(process.env.DISCORD_TOKEN);

process.on('unhandledRejection', error => {
  console.error('❌ Unhandled promise rejection:', error);
});
