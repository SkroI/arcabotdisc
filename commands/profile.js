import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Get your Arcabloom profile info.');

export const allowed = [];
const namecache = {};
const usernameCache = {};

const BLOXLINK_KEY = process.env.BLOXLINK_KEY;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const GUILD_ID = process.env.GUILD_ID;
const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const DATASTORE = process.env.ROBLOX_LEADERSTAT_KEY; // same as leaderboard
const SCOPE = 'global';

// Fetch Roblox ID from Discord via Blox.link
async function getRobloxId(discordId) {
  if (namecache[discordId]) return namecache[discordId];

  try {
    const res = await fetch(
      `https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${discordId}`,
      { headers: { Authorization: BLOXLINK_KEY } }
    );

    if (res.status === 404) return null;
    if (!res.ok) return null;

    const data = await res.json();
    const robloxId = data.robloxID || null;

    if (robloxId) namecache[discordId] = robloxId;
    return robloxId;
  } catch (err) {
    console.error('Error fetching Roblox ID:', err);
    return null;
  }
}

// Fetch coins using the working leaderboard approach
async function getCoins(robloxId) {
  if (!robloxId) return { coins: 0, rank: 0 };

  try {
    const url = `https://apis.roblox.com/ordered-data-stores/v1/universes/${UNIVERSE_ID}/orderedDataStores/${DATASTORE}/scopes/${SCOPE}/entries?max_page_size=100&order_by=desc`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ROBLOX_API_KEY,
      },
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();

    if (!data.entries || data.entries.length === 0) return { coins: 0, rank: 0 };

    // Find the player's entry
    const playerIndex = data.entries.findIndex(entry => entry.id === robloxId);
    
    if (playerIndex === -1) return { coins: 0, rank: 0 };

    const playerEntry = data.entries[playerIndex];

    // Rank is index + 1 (because array is 0-based)
    return { coins: playerEntry.value, rank: playerIndex + 1 };
    
  } catch (err) {
    console.error('Error fetching coins:', err);
    return { coins: 0, rank: 0 };
  }
}


// Optional: fetch Roblox username for embed
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
  const robloxId = await getRobloxId(interaction.user.id);

  if (!robloxId) {
    return interaction.reply({
      content: '❌ Your Discord account is not linked to Roblox.',
      ephemeral: true,
    });
  }

  const { coins, rank } = await getCoins(robloxId);
  const username = await getUsername(robloxId);

  const embed = new EmbedBuilder()
    .setTitle('🍓 〉 Arcabloom Profile')
    .setDescription(`Here is your profile information, ${username}!`)
    .addFields(
      { name: '🪙 Coins', value: `${coins}` },
      { name: '🏆 Rank', value: `#${rank}` },

    )
    .setColor(0xFFD700)
    .setFooter({ text: 'Arcabloom Services ©️ 2025' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}


