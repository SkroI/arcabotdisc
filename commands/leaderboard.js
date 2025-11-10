import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

// 🧩 Add allowed role IDs here
const allowedRoles = [];

const usernameCache = {};

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
  .setName('leaderboard')
  .setDescription('View the leaderboard')
  // 👇 leave this visible to everyone
  .setDMPermission(false);

export async function execute(interaction) {
  // ✅ Check if user has any of the allowed roles
  const hasAccess = allowedRoles.some(roleId =>
    interaction.member.roles.cache.has(roleId)
  );

  if (!hasAccess) {
    return interaction.reply({
      content: '🚫 You do not have permission to use this command.',
      ephemeral: true,
    });
  }

  const universeId = process.env.ROBLOX_UNIVERSE_ID;
  const dataStore = process.env.ROBLOX_LEADERSTAT_KEY;
  const scope = 'global';
  const limit = 10;

  if (!process.env.ROBLOX_API_KEY || !universeId || !dataStore) {
    return interaction.reply({
      content: '❌ Missing Roblox configuration. Please contact Pixel.',
      ephemeral: true,
    });
  }

  try {
    const url = `https://apis.roblox.com/ordered-data-stores/v1/universes/${universeId}/orderedDataStores/${dataStore}/scopes/${scope}/entries?max_page_size=${limit}&order_by=desc`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ROBLOX_API_KEY,
      },
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();

    if (!data.entries || data.entries.length === 0) {
      return interaction.reply({
        content: '📭 No leaderboard data found.',
        ephemeral: true,
      });
    }

    const leaderboardLines = await Promise.all(
      data.entries.map(async (entry, index) => {
        const username = await getUsername(entry.id);
        return `#${index + 1} **${username}** — **${entry.value} Coins**`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle('🪙 Coin Leaderboard')
      .setDescription(leaderboardLines.join('\n'))
      .setColor(0xFFD700)
      .setThumbnail('https://tr.rbxcdn.com/1e1c7f41bb5f41c0d87a2a4f1d8898d2/420/420/Image/Png')
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } catch (err) {
    console.error('❌ Leaderboard fetch error:', err);
    await interaction.reply({
      content: '❌ Failed to fetch leaderboard. Please try again later.',
      ephemeral: true,
    });
  }
}
