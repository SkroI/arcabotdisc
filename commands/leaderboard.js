import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Load your in-game profile!');

export const allowed = [];

const usernameCache = {};
const nameCache = {};
const key = process.env.BLOXLINK_KEY;
const universeId = process.env.ROBLOX_UNIVERSE_ID;
const dataStore = process.env.ROBLOX_LEADERSTAT_KEY;
const scope = 'global';

// Fetch Roblox username from userId
async function getUsername(userId) {
  if (usernameCache[userId]) return usernameCache[userId];
  try {
    const res = await fetch(`https://users.roblox.com/v1/users/${userId}`);
    if (!res.ok) return userId.toString();
    const data = await res.json();
    usernameCache[userId] = data.name || userId.toString();
    return usernameCache[userId];
  } catch {
    return userId.toString();
  }
}

// Fetch Roblox ID or name via Bloxlink
async function getRobloxName(discordId, status) {
  if (nameCache[discordId]) return nameCache[discordId];

  try {
    const guildId = process.env.GUILD_ID;
    const res = await fetch(
      `https://api.blox.link/v4/public/guilds/${guildId}/discord-to-roblox/${discordId}`,
      { headers: { Authorization: key } }
    );

    if (res.status === 404) return 'Not linked';
    if (!res.ok) return 'API error';

    const data = await res.json();
    const robloxId = data.robloxID;
    if (!robloxId) return 'Not linked';

    let result;
    if (status === 'USERID') {
      result = robloxId.toString();
    } else {
      result = await getUsername(robloxId);
    }

    nameCache[discordId] = result;
    return result;
  } catch (err) {
    console.error('❌ Error fetching Roblox name:', err);
    return 'Error fetching name';
  }
}

// Fetch user coins from leaderboard-style ordered DataStore
async function getUserCoins(userId) {
  if (!process.env.ROBLOX_API_KEY || !universeId || !dataStore) {
    console.error('❌ Missing Roblox config (API key, universe ID, datastore)');
    return null;
  }

  try {
    const url = `https://apis.roblox.com/ordered-data-stores/v1/universes/${universeId}/orderedDataStores/${dataStore}/scopes/global/entries?max_page_size=100&order_by=desc`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ROBLOX_API_KEY,
      },
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();
    if (!data.entries || data.entries.length === 0) return null;

    const userEntry = data.entries.find(entry => entry.id.toString() === userId.toString());
    return userEntry ? userEntry.value ?? null : null;
  } catch (err) {
    console.error(`❌ Error fetching coins for user ${userId}:`, err);
    return null;
  }
}

// Main command execution
export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  try {
    const robloxName = await getRobloxName(interaction.user.id);
    const robloxId = await getRobloxName(interaction.user.id, 'USERID');

    let coins = null;
    if (robloxId && robloxId !== 'Not linked' && !isNaN(robloxId)) {
      coins = await getUserCoins(robloxId);
    }

    const embed = new EmbedBuilder()
      .setTitle('🍓 〉 Arcabloom Profile')
      .setDescription(`Your in-game stats, ${interaction.user.username}!`)
      .addFields(
        { name: 'Roblox Username', value: robloxName, inline: true },
        { name: '🪙 Coins', value: coins !== null ? coins.toString() : 'No data found', inline: true },
      )
      .setColor(0xFFD700)
      .setFooter({ text: 'Arcabloom Services ©️ 2025' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('❌ Profile command error:', err);
    try {
      await interaction.editReply({ content: '⚠️ Something went wrong while fetching your profile.' });
    } catch {}
  }
}
