import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

const allowed = ['837537455212986378', '842777765246009414'];

export const data = new SlashCommandBuilder()
  .setName('roblox')
  .setDescription('View the  leaderboard');

export { allowed };

// Helper to get Roblox username from user ID
const usernameCache = {}; // simple in-memory cache
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

export async function execute(interaction) {
  if (allowed.length > 0 && !allowed.includes(interaction.user.id)) {
    return interaction.reply({
      content: '❌ cant use the cmd',
      ephemeral: true
    });
  }

  const universeId = process.env.ROBLOX_UNIVERSE_ID;
  const dataStore = process.env.ROBLOX_LEADERSTAT_KEY;
  const scope = 'global';
  const limit = 10;

  if (!process.env.ROBLOX_API_KEY || !universeId || !dataStore) {
    return interaction.reply({
      content: '❌ Error, contact pixel',
      ephemeral: true
    });
  }

  try {
    const url = `https://apis.roblox.com/ordered-data-stores/v1/universes/${universeId}/orderedDataStores/${dataStore}/scopes/${scope}/entries?max_page_size=${limit}&order_by=desc`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ROBLOX_API_KEY
      }
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();

    if (!data.entries || data.entries.length === 0) {
      return interaction.reply({ content: 'No leaderboard data found.', ephemeral: true });
    }

    // Build leaderboard lines
    const leaderboardLines = await Promise.all(
      data.entries.map(async (entry, index) => {
        const username = await getUsername(entry.id);
        return `#${index + 1} **${username}** - **${entry.value} Coins**`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle('🪙  Coins leaderboard')
      .setDescription(leaderboardLines.join('\n'))
      .setColor(0xFFD700)
      .setThumbnail('https://tr.rbxcdn.com/1e1c7f41bb5f41c0d87a2a4f1d8898d2/420/420/Image/Png') // optional leaderboard icon
      .setTimestamp();

    await interaction.reply({ embeds: [embed], ephemeral: false });
  } catch (err) {
    console.error(err);
    await interaction.reply({
      content: `❌ Failed to fetch leaderboard`,
      ephemeral: true
    });
  }
}
