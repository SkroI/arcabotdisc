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
  .setName('unban')
  .setDescription('Unban plr from Arcabloom')
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

// Roblox helper functions
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

async function getHeadshotUrl(userId) {
  try {
    const url = `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=png&isCircular=false`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[0]?.imageUrl || null;
  } catch {
    return null;
  }
}

function computeContentMD5(bodyString) {
  return crypto.createHash('md5').update(bodyString, 'utf8').digest('base64');
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

// Command execution
export async function execute(interaction) {
  if (!allowedRoles.some(role => interaction.member.roles.cache.has(role))) {
    return interaction.reply({ content: "You don't have permission to unban people...", ephemeral: true });
  }

  await interaction.deferReply({ ephemeral: true });

  const username = interaction.options.getString('username');
  const robloxId = await getRobloxId(username);
  if (!robloxId) return interaction.editReply({ content: ` Error occurred while searching really hard for this player's username :  **${username}**.` });

  const displayName = await getUsername(robloxId);
  const headshot = await getHeadshotUrl(robloxId) || null;

  const embed = new EmbedBuilder()
    .setTitle('🚨 Unban Player')
    .setDescription(`Are you sure you want to unban **${displayName}** (${robloxId})?`)
    .setThumbnail(headshot)
    .setColor(0x00aaff);

  const buttonsRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('confirm').setLabel('✅ Confirm').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger)
  );

  const msg = await interaction.editReply({ embeds: [embed], components: [buttonsRow] });

  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120_000 });

  collector.on('collect', async btnInt => {
    if (btnInt.user.id !== interaction.user.id)
      return btnInt.reply({ content: 'Only the command user can respond.', ephemeral: true });

    if (btnInt.customId === 'cancel') {
      await btnInt.update({ embeds: [new EmbedBuilder().setTitle('❌ Unban Cancelled').setColor(0x808080)], components: [] });
      collector.stop();
      return;
    }

    if (btnInt.customId === 'confirm') {
      const valueObj = { Banned: false, Time: 0 }; // unban user

      try {
        await setDatastoreEntry(robloxId, valueObj);
        await btnInt.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('✅ Successfully Unbanned')
              .setDescription(`**${displayName}** (${robloxId}) has been unbanned.`)
              .setThumbnail(headshot)
              .setColor(0x00ff00)
          ],
          components: []
        });
      } catch (err) {
        const bodyPreview = (err.body && String(err.body).slice(0, 1000)) || 'No response body';
        await btnInt.update({
          embeds: [
            new EmbedBuilder()
              .setTitle('❌ Datastore Error')
              .setDescription(`An error occurred while processing the unban`)
              .setColor(0xff0000)
          ],
          components: []
        });
      }
      collector.stop();
    }
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
