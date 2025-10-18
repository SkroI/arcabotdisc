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
  .setDescription('Ban plr from Arcabloom')
  .addStringOption(opt =>
    opt.setName('username')
      .setDescription('username')
      .setRequired(true)
  );

// CONFIG
const allowedRoles = ['1427338616580870247'];
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const DATASTORE_NAME = 'Banland';
const usernameCache = {};

async function getRobloxId(username) {
  try {
    const res = await fetch('https://users.roblox.com/v1/usernames/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.id ? String(data.data[0].id) : null;
  } catch {
    return null;
  }
}

async function getHeadshotUrl(userId) {
  try {
    const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=png&isCircular=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data?.data?.[0]?.imageUrl) return data.data[0].imageUrl;
    return null;
  } catch {
    return null;
  }
}


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

function computeContentMD5(bodyString) {
  return crypto.createHash('md5').update(bodyString, 'utf8').digest('base64');
}

function getBanDuration(option) {
  const durations = {
    '1h': 3600,
    '1d': 86400,
    '3d': 259200,
    '1w': 604800,
  };
  if (option === 'forever') return 'Forever';
  return durations[option] || 0;
}

async function setDatastoreEntry(userId, valueObj) {
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

export async function execute(interaction) {
  if (!allowedRoles.some(role => interaction.member.roles.cache.has(role))) {
    return interaction.reply({ content: "You don't have permission to ban people around here..", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const username = interaction.options.getString('username');
  const robloxId = await getRobloxId(username);
  if (!robloxId) return interaction.editReply({ content: ` Error occurred while searching really hard for this player's username :  **${username}**.` });

  const displayName = await getUsername(robloxId);
const headshot = await getHeadshotUrl(robloxId) || null;

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
    new ButtonBuilder().setCustomId('forever').setLabel('Forever').setStyle(ButtonStyle.Danger)
  );

  const msg = await interaction.editReply({ embeds: [embed], components: [buttonsRow] });

  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000 });

  collector.on('collect', async btnInt => {
    if (btnInt.user.id !== interaction.user.id) return btnInt.reply({ content: 'Only the command user can respond.', ephemeral: true });

    const choice = btnInt.customId;
    const durationSeconds = getBanDuration(choice);
    const bannedTill = durationSeconds === 'Forever' ? 'Forever' : Math.floor(Date.now() / 1000) + durationSeconds;

    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Confirm Ban')
      .setDescription(
        `You are about to ban **${displayName}** (${robloxId})\n**Banned till:** ${bannedTill === 'Forever' ? 'Forever' : `<t:${bannedTill}:R>`}`
      )
      .setThumbnail(headshot)
      .setColor(0xffa500);

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm').setLabel('✅ Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger)
    );

    await btnInt.update({ embeds: [confirmEmbed], components: [confirmRow] });

    const confirmCollector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000 });

    confirmCollector.on('collect', async confirmInt => {
      if (confirmInt.user.id !== interaction.user.id) return confirmInt.reply({ content: 'Only the command user can respond.', ephemeral: true });



      if (confirmInt.customId === 'cancel') {
        await confirmInt.update({ embeds: [new EmbedBuilder().setTitle('❌ Ban Cancelled').setColor(0x808080)], components: [] });
        confirmCollector.stop();
        return;
      }

      if (confirmInt.customId === 'confirm') {
        const valueObj = { Banned: true, Time: bannedTill };

        try {
          await setDatastoreEntry(robloxId, valueObj);
          await confirmInt.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('✅ Successfully Banned')
                .setDescription(`**${displayName}** (${robloxId}) has been banned.\n**Banned till:** ${bannedTill === 'Forever' ? 'Forever' : `<t:${bannedTill}:R>`}`)
                .setThumbnail(headshot)
                .setColor(0x00ff00)
            ],
            components: []
          });
        } catch (err) {
          const bodyPreview = (err.body && String(err.body).slice(0, 1000)) || 'No response body';
          await confirmInt.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ Datastore Error')
                .setDescription(`An error occurred while processing the ban`)
                .setColor(0xff0000)
            ],
            components: []
          });
        }

        confirmCollector.stop();
      }
    });
  });

  collector.on('end', (_, reason) => {
    if (reason === 'time') {
      interaction.editReply({
        embeds: [new EmbedBuilder().setTitle('Oops run out of time..').setDescription('Please try again').setColor(0x808080)],
        components: []
      }).catch(() => {});
    }
  });
}
