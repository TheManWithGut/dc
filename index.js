require('dotenv').config();
require('./keeprunning.js');
const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
} = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

let players = [];
const activeMatches = new Map(); // userId => { opponentId, role, matchId, choice }
let ongoingMatchesResults = []; // výsledky aktuálního kola coinflipů

client.once('ready', () => {
  console.log(`${client.user.tag} is online`);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton() && interaction.customId === 'add_player') {
    const userId = interaction.user.id;

    if (!players.includes(userId)) {
      players.push(userId);
      return interaction.reply({ content: 'You have entered the competition', ephemeral: true });
    } else {
      return interaction.reply({ content: 'You are already in the list', ephemeral: true });
    }
  }

  if (!interaction.isButton()) return;

  const [matchId, side] = interaction.customId.split('_'); // např. match1_panna

  const userId = interaction.user.id;
  const match = activeMatches.get(userId);

  if (!match || match.matchId !== matchId || match.role !== 'player1') {
    return interaction.reply({ content: 'You cannot vote', ephemeral: true });
  }

  const opponentId = match.opponentId;
  const opponent = activeMatches.get(opponentId);
  if (!opponent || opponent.matchId !== matchId) {
    return interaction.reply({ content: 'Opponent is unavailable', ephemeral: true });
  }

  const opponentChoice = side === 'panna' ? 'orel' : 'panna';
  const result = Math.random() < 0.5 ? 'panna' : 'orel';
  const winnerId = side === result ? userId : opponentId;
  const loserId = side === result ? opponentId : userId;

  // Odebereme prohraného hráče ze seznamu
  players = players.filter(p => p !== loserId);

  const winnerTag = await interaction.guild.members.fetch(winnerId).then(m => m.user.tag).catch(() => 'Unknown');
  const loserTag = await interaction.guild.members.fetch(loserId).then(m => m.user.tag).catch(() => 'Unknown');
  const p1Tag = await interaction.guild.members.fetch(userId).then(m => m.user.tag).catch(() => 'Unknown');
  const p2Tag = await interaction.guild.members.fetch(opponentId).then(m => m.user.tag).catch(() => 'Unknown');

  // Smažeme aktivní zápasy obou hráčů
  activeMatches.delete(userId);
  activeMatches.delete(opponentId);

  // Přidáme výsledek do aktuálního kola
  ongoingMatchesResults.push(
    `🎮 Duel: ${p1Tag} vs ${p2Tag}\n` +
    `🔸 ${p1Tag} chose ${side.toUpperCase()}\n` +
    `🔸 ${p2Tag} automatically got ${opponentChoice.toUpperCase()}\n` +
    `🎲 Flip result: ${result.toUpperCase()}\n` +
    `🏆 Winner: ${winnerTag}\n` +
    `💀 ${loserTag} was removed from the list`
  );

  await interaction.reply({ content: 'Your choice was registered. Wait for all duels to finish.', ephemeral: true });

  // Pokud už nejsou aktivní žádné zápasy, pošleme souhrn výsledků a vyčistíme
  if (activeMatches.size === 0) {
    const summary = ongoingMatchesResults.join('\n\n');
    await interaction.channel.send(`**Coinflip results:**\n\`\`\`\n${summary}\n\`\`\``);
    ongoingMatchesResults = [];
  }
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const isAdmin = message.member?.permissions.has(PermissionsBitField.Flags.Administrator);

  try {
    switch (message.content) {
      case '!open':
        if (isAdmin) {
          await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
            SendMessages: true,
          });
          return message.channel.send('Channel unlocked for everyone');
        }
        break;

      case '!close':
        if (isAdmin) {
          await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, {
            SendMessages: false,
          });
          return message.channel.send('Channel locked for everyone');
        }
        break;

      case '!add': {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('add_player')
            .setLabel('✅')
            .setStyle(ButtonStyle.Success)
        );

        const sentMessage = await message.channel.send({
          content: 'Click to join',
          components: [row],
        });

        setTimeout(async () => {
          const disabledRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId('add_player')
              .setLabel('❌')
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true)
          );
          try {
            await sentMessage.edit({ components: [disabledRow] });
          } catch (error) {
            console.error('Unable to deactivate the button (add)', error);
          }
        }, 35000);

        return;
      }

      case '!list':
        if (players.length === 0) {
          return message.channel.send('The list is empty');
        }

        const names = await Promise.all(players.map(async (id) => {
          const member = await message.guild.members.fetch(id).catch(() => null);
          return member ? member.user.tag : `Unknown (${id})`;
        }));

        const list = names.map((name, i) => `${i + 1}. ${name}`).join('\n');
        return message.channel.send(`**Players:**\n\`\`\`${list}\`\`\``);

      case '!clearlist':
        if (isAdmin) {
          players = [];
          return message.channel.send('The list was cleared');
        }
        break;

      case '!clearchat':
        if (isAdmin) {
          const messages = await message.channel.messages.fetch({ limit: 100 });
          const recent = messages.filter(msg => (Date.now() - msg.createdTimestamp) < 1209600000);
          await message.channel.bulkDelete(recent);
        }
        break;

      case '!random':
        if (players.length > 0) {
          // Fisher-Yates shuffle pro lepší náhodnost
          const shuffled = [...players];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          const winner = shuffled[0];
          return message.channel.send(`<@${winner}> won the random draw`);
        } else {
          return message.channel.send('The list is empty');
        }

      case '!coinflip':
        if (players.length < 2) {
          return message.channel.send('Two or more players are required');
        }

        ongoingMatchesResults = []; // vyčistíme výsledky z předchozího kola

        const shuffled = [...players].sort(() => 0.5 - Math.random());
        let matchCount = 0;

        while (shuffled.length >= 2) {
          const [a, b] = shuffled.splice(0, 2);
          const matchId = `match${++matchCount}`;

          activeMatches.set(a, { opponentId: b, role: 'player1', matchId });
          activeMatches.set(b, { opponentId: a, role: 'player2', matchId });

          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`${matchId}_panna`)
              .setLabel('Panna')
              .setStyle(ButtonStyle.Primary),
            new ButtonBuilder()
              .setCustomId(`${matchId}_orel`)
              .setLabel('Orel')
              .setStyle(ButtonStyle.Danger)
          );

          await message.channel.send({
            content: `<@${a}> vs <@${b}> — <@${a}>, choose your side`,
            components: [row]
          });
        }

        return message.channel.send('Duels have started');

      case '!endcf':
        if (!isAdmin) return message.reply('You are not authorized to use this command.');

        if (activeMatches.size === 0) {
          return message.channel.send('No active coinflips to end');
        }

        // Najdeme všechny hráče s rolí player1, kteří nevybrali
        for (const [userId, match] of activeMatches) {
          if (match.role === 'player1') {
            // Diskvalifikace - odstraníme hráče
            players = players.filter(p => p !== userId);

            // Postupuje soupeř
            const opponentId = match.opponentId;

            // Připravíme tagy
            const disqTag = await message.guild.members.fetch(userId).then(m => m.user.tag).catch(() => 'Unknown');
            const advTag = await message.guild.members.fetch(opponentId).then(m => m.user.tag).catch(() => 'Unknown');

            ongoingMatchesResults.push(
              `🎮 Duel: ${disqTag} vs ${advTag}\n` +
              `❌ ${disqTag} was disqualified\n` +
              `🏆 ${advTag} automatically won the duel`
            );

            // Vymažeme aktivní zápasy obou hráčů
            activeMatches.delete(userId);
            activeMatches.delete(opponentId);
          }
        }

        if (ongoingMatchesResults.length > 0) {
          const summary = ongoingMatchesResults.join('\n\n');
          await message.channel.send(`**Coinflip results (forced end):**\n\`\`\`\n${summary}\n\`\`\``);
          ongoingMatchesResults = [];
        } else {
          await message.channel.send('No results to show');
        }

        return;

      default:
        break;
    }

    if (message.content.startsWith('!rp')) {
      if (!isAdmin) return;

      const args = message.content.split(' ');
     // if (args.length !== 2) return message.reply('Usage: `!rp <number>`');

      const index = parseInt(args[1], 10);
      if (isNaN(index) || index < 1 || index > players.length) {
        return message.reply('Wrong number');
      }

      const removedId = players.splice(index - 1, 1)[0];
      const removedUser = await message.guild.members.fetch(removedId).catch(() => null);
      const name = removedUser ? removedUser.user.tag : `Unknown (${removedId})`;

      return message.channel.send(`❌ Player **${name}** has been removed`);
    }
  } catch (error) {
    console.error('Error processing message:', error);
  }
});

client.login(process.env.DISCORD_TOKEN);
