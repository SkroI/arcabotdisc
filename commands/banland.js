import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

const allowedRoles = [process.env.DEVELOPERROLE];
const usernameCache = {};

const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const DATASTORE_NAME = 'Banland';

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

export const data = new SlashCommandBuilder()
  .setName('banlist')
  .setDescription('View the banlist')
  .setDMPermission(false);

export async function execute(interaction) {

  const hasAccess = allowedRoles.some(role =>
    interaction.member.roles.cache.has(role)
  );

  if (!hasAccess) {
    return interaction.reply({
      content: '🚫 You do not have permission to use this command.',
      ephemeral: true,
    });
  }

  await interaction.deferReply({ ephemeral: true });

  try {

    const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries?datastoreName=${DATASTORE_NAME}&limit=20`;

    const response = await fetch(url, {
      headers: {
        'x-api-key': ROBLOX_API_KEY
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.keys || data.keys.length === 0) {
      return interaction.editReply('📭 No banned players found.');
    }

    const lines = [];

    for (const entry of data.keys) {

      const userId = entry.key;

      const valueRes = await fetch(
        `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${DATASTORE_NAME}&entryKey=${userId}`,
        {
          headers: {
            'x-api-key': ROBLOX_API_KEY
          }
        }
      );

      if (!valueRes.ok) continue;

      const value = await valueRes.json();

      if (!value?.Banned) continue;

      const username = await getUsername(userId);

      let timeText = 'Forever';

      if (value.Time !== 'Forever') {
        timeText = `<t:${value.Time}:R>`;
      }

      lines.push(`**${username}** (${userId})\nBan expires: ${timeText}`);
    }

    const embed = new EmbedBuilder()
      .setTitle('🚫 Banlist')
      .setDescription(lines.join('\n\n') || 'No banned players.')
      .setColor(0xff0000)
      .setFooter({ text: 'Arcabloom Services ©️ 2026' });

    await interaction.editReply({ embeds: [embed] });

  } catch (err) {

    console.error('Banlist error:', err);

    await interaction.editReply(
      '❌ Failed to fetch banlist.'
    );

  }
}
