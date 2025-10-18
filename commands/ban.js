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
  .setDescription('Ban a Roblox player by username')
  .addStringOption(opt =>
    opt.setName('username')
      .setDescription('Roblox username to ban')
      .setRequired(true)
  );

// ===== CONFIG =====
const allowedRoles = ['1427338616580870247']; // admin roles
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const DATASTORE_NAME = 'Banland';

// ===== HELPERS =====
async function getRobloxId(username) {
  try {
    const res = await fetch(`https://api.roblox.com/users/get-by-username?username=${encodeURIComponent(username)}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.Id ? String(data.Id) : null;
  } catch {
    return null;
  }
}

// Compute base64 MD5 of the JSON value
function computeMD5(value) {
  const hash = crypto.createHash('md5').update(value).digest('base64');
  return hash;
}

function getBanTime(option) {
  if (option === 'forever') return 'Forever';
  const now = Math.floor(Date.now() / 1000);
  const durations = {
    '1h': 3600,
    '1d': 86400,
    '3d': 259200,
    '1w': 604800,
  };
  return now + durations[option];
}

// Proper Roblox Open Cloud Set Entry
async function setDatastoreEntry(userId, valueObj) {
  const valueJSON = JSON.stringify(valueObj);
  const md5 = computeMD5(valueJSON);

  const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${encodeURIComponent(DATASTORE_NAME)}&entryKey=${encodeURIComponent(userId)}`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': ROBLOX_API_KEY,
      'content-type': 'application/json',
      'content-md5': md5,
      'roblox-entry-userids': `[${userId}]`,
      'roblox-entry-attributes': '{}',
    },
    body: valueJSON,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Datastore write failed (${res.status}): ${text}`);
  }

  return res;
}

// ===== COMMAND =====
export async function execute(interaction) {
  const hasAccess = allowedRoles.some(role => interaction.member.roles.cache.has(role));
  if (!hasAccess)
    return interaction.reply({ content: '🚫 You do not have permission to use this command.', ephemeral: true });

  const username = interaction.options.getString('username');
  await interaction.deferReply({ ephemeral: true });

  const robloxId = await getRobloxId(username);
  if (!robloxId)
    return interaction.editReply({ content: `❌ Could not find Roblox user **${username}**.` });

  const headshot = `https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=420&height=420&format=png`;

  const embed = new EmbedBuilder()
    .setTitle('🚨 Ban Player')
    .setDescription(`Select a ban duration for **${username}** (${robloxId})`)
    .setThumbnail(headshot)
    .setColor(0xff0000);

  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('1h').setLabel('1 Hour').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('1d').setLabel('1 Day').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('3d').setLabel('3 Days').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('1w').setLabel('1 Week').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('forever').setLabel('Forever').setStyle(ButtonStyle.Danger)
  );

  const msg = await interaction.editReply({ embeds: [embed], components: [buttons] });

  const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

  collector.on('collect', async btnInt => {
    if (btnInt.user.id !== interaction.user.id)
      return btnInt.reply({ content: '⛔ Only the command user can respond.', ephemeral: true });

    const choice = btnInt.customId;
    const banTime = getBanTime(choice);

    const confirmEmbed = new EmbedBuilder()
      .setTitle('⚠️ Confirm Ban')
      .setDescription(`You are about to ban **${username}** (${robloxId})\n**Duration:** ${banTime === 'Forever' ? 'Forever' : `<t:${banTime}:R>`}`)
      .setThumbnail(headshot)
      .setColor(0xffa500);

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('confirm').setLabel('✅ Confirm').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('back').setLabel('🔙 Back').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId('cancel').setLabel('❌ Cancel').setStyle(ButtonStyle.Danger),
    );

    await btnInt.update({ embeds: [confirmEmbed], components: [confirmRow] });

    const confirmCollector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    confirmCollector.on('collect', async confirmInt => {
      if (confirmInt.user.id !== interaction.user.id)
        return confirmInt.reply({ content: '⛔ Only the command user can respond.', ephemeral: true });

      if (confirmInt.customId === 'back') {
        await confirmInt.update({ embeds: [embed], components: [buttons] });
      } else if (confirmInt.customId === 'cancel') {
        await confirmInt.update({ embeds: [new EmbedBuilder().setTitle('❌ Ban Cancelled').setColor(0x808080)], components: [] });
        confirmCollector.stop();
      } else if (confirmInt.customId === 'confirm') {
        try {
          await setDatastoreEntry(robloxId, { Banned: true, Time: banTime });
          await confirmInt.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('✅ Player Banned')
                .setDescription(`**${username}** (${robloxId}) has been banned.\n**Duration:** ${banTime === 'Forever' ? 'Forever' : `<t:${banTime}:R>`}`)
                .setThumbnail(headshot)
                .setColor(0x00ff00),
            ],
            components: [],
          });
        } catch (err) {
          console.error(err);
          await confirmInt.update({
            embeds: [
              new EmbedBuilder()
                .setTitle('❌ Datastore Error')
                .setDescription('Could not write to Roblox datastore. Check API key and universe permissions.')
                .setColor(0xff0000),
            ],
            components: [],
          });
        }
        confirmCollector.stop();
      }
    });
  });
}
