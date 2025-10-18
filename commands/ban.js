import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
} from 'discord.js';
import crypto from 'crypto';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Ban a Roblox player from the game.')
  .addStringOption(opt =>
    opt.setName('username')
      .setDescription('Roblox username to ban')
      .setRequired(true)
  );

// CONFIG
const allowedRoles = ['1427338616580870247']; // Discord role IDs allowed to use the command
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const DATASTORE_NAME = 'Banland';

// Cache for username lookups
const usernameCache = {};

// ✅ Username → UserId
async function getRobloxId(username) {
  try {
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username] }),
    });

    if (!res.ok) {
      console.error('Roblox username lookup failed:', res.status);
      return null;
    }

    const data = await res.json();
    if (data?.data?.length && data.data[0].id) {
      return String(data.data[0].id);
    }

    return null;
  } catch (err) {
    console.error('getRobloxId error:', err);
    return null;
  }
}

// ✅ UserId → Username
async function getUsername(userId) {
  if (usernameCache[userId]) return usernameCache[userId];
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (!res.ok) return userId;
    const data = await res.json();
    usernameCache[userId] = data.name || userId;
    return usernameCache[userId];
  } catch {
    return userId;
  }
}

// ✅ Compute MD5 hash for Roblox API
function computeContentMD5(bodyString) {
  return crypto.createHash('md5').update(bodyString, 'utf8').digest('base64');
}

// ✅ Duration resolver
function getBanTime(option) {
  if (option === 'forever') return 'Forever';
  const now = Math.floor(Date.now() / 1000);
  const durations = {
    '1h': 3600,
    '1d': 86400,
    '3d': 259200,
    '1w': 604800,
  };
  return now + (durations[option] || 0);
}

// ✅ Roblox Datastore API: Set Entry
async function setDatastoreEntry(userId, valueObj) {
  if (!ROBLOX_API_KEY) throw new Error('ROBLOX_API_KEY missing');
  if (!UNIVERSE_ID) throw new Error('ROBLOX_UNIVERSE_ID missing');

  const bodyString = JSON.stringify(valueObj);
  const md5 = computeContentMD5(bodyString);

  const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${DATASTORE_NAME}&entryKey=${userId}`;

  const headers = {
    'x-api-key': ROBLOX_API_KEY,
    'content-type': 'application/json',
    'content-md5': md5,
    'roblox-entry-userids': `[${userId}]`,
    'roblox-entry-attributes': '{}',
  };

  const res = await fetch(url, { method: 'POST', headers, body: bodyString });
  const text = await res.text();

  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.status = res.status;
    err.body = text;
    throw err;
  }

  try {
    return JSON.parse(text || '{}');
  } catch {
    return text;
  }
}

// ✅ Command execution
export async function execute(interaction) {
  // Permission check
  const hasAccess = allowedRoles.some(role => interaction.member.roles.cache.has(role));
  if (!hasAccess) {
    return interaction.reply({ content: '🚫 You do not have permission to use this command.', ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const username = interaction.options.getString('username');
  const robloxId = await getRobloxId(username);

  if (!robloxId) {
    return interaction.editReply({ content: `❌ Could not find Roblox user **${username}**.` });
  }

  const displayName = await getUsername(robloxId);
  const headshot = `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=420&height=420&format=png`;

  const embed = new EmbedBuilder()
    .setTitle('🚨 Ban Player')
    .setDescription(`Select a ban duration for **${displayName}** (${robloxId})`)
    .setThumbnail(headshot)
    .setColor(0xff0000);

  const buttonsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('1h').setLabel('1 Hour').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('1d').setLabel('1 Day').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('3d').setLabel('3 Days').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('1w').setLabel('1 Week').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('forever').setLabel('Forever').setStyle(ButtonStyle.Danger),
  );

  const msg = await interaction.editReply({ embeds: [embed], components: [buttonsRow] });

  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

  collector.on('collect', async btnInt => {
    if (btnInt.user.id !== interaction.user.id)
      return btnInt.reply({ content: '⛔ Only the command user can respond.', ephemeral: true });

    const choice = btnInt.customId;
    const banTime = getBanTime(choice);

    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Confirm Ban')
      .setDescription(
        `You are about to ban **${displayName}** (${robloxId})\n**Duration:** ${banTime === 'Forever' ? 'Forever' : `<t:${banTime}:R>`}`
      )
      .setThumbnail(headshot)
      .setColor(0xffa500);

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm').setLabel('✅ Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('back').setLabel('🔙 Back').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger),
    );

    await btnInt.update({ embeds: [confirmEmbed], components: [confirmRow] });

    const confirmCollector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

    confirmCollector.on('collect', async confirmInt => {
      if (confirmInt.user.id !== interaction.user.id)
        return confirmInt.reply({ content: '⛔ Only the command user can respond.', ephemeral: true });

      if (confirmInt.customId === 'back') {
        await confirmInt.update({ embeds: [embed], components: [buttonsRow] });
        confirmCollector.stop();
        return;
      }

      if (confirmInt.customId === 'cancel') {
        await confirmInt.update({
          embeds: [new EmbedBuilder().setTitle('❌ Ban Cancelled').setColor(0x808080)],
          components: [],
        });
        confirmCollector.stop();
        return;
      }

      if (confirmInt.customId === 'confirm') {
        const valueObj = { Banned: true, Time: banTime };

        try {
          const result = await setDatastoreEntry(robloxId, valueObj);
          await confirmInt.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('✅ Player Banned')
                .setDescription(`**${displayName}** (${robloxId}) has been banned.\n**Duration:** ${banTime === 'Forever' ? 'Forever' : `<t:${banTime}:R>`}`)
                .setThumbnail(headshot)
                .setColor(0x00ff00),
            ],
            components: [],
          });
          console.log('✅ Datastore write success:', result);
        } catch (err) {
          console.error('❌ Datastore write error:', err);
          const bodyPreview = (err.body && String(err.body).slice(0, 1000)) || 'No response body';
          await confirmInt.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ Datastore Error')
                .setDescription(`Status: ${err.status || 'unknown'}\nResponse:\`\`\`${bodyPreview}\`\`\``)
                .setColor(0xff0000),
            ],
            components: [],
          });
        }
        confirmCollector.stop();
      }
    });
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('⌛ Timed Out').setDescription('No selection made.').setColor(0x808080)],
        components: [],
      }).catch(() => {});
    }
  });
}
