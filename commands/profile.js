import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Load in-game profile!');

export const allowed = []; 

const usernameCache = {};
const namecache = {};
const key = process.env.BLOXLINK_KEY;
const universeId = process.env.ROBLOX_UNIVERSE_ID;
 const dataStore = process.env.ROBLOX_LEADERSTAT_KEY;
const scope = 'global';

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

async function getrobloxname(discordId, status) {
  if (namecache[discordId]) return namecache[discordId];
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

    if (status === 'USERID') {
      result = robloxId.toString();
    } else {
      result = await getUsername(robloxId);
    }

    namecache[discordId] = result;
    return result;

  } catch (err) {
    console.error('❌ Error fetching Roblox name:', err);
    return 'Error fetching name';
  }
}

async function getUserCoins(userId) {
  const universeId = process.env.ROBLOX_UNIVERSE_ID;
  const dataStore = process.env.ROBLOX_LEADERSTAT_KEY;
  const scope = 'global';

  if (!process.env.ROBLOX_API_KEY || !universeId || !dataStore) {
    console.error('❌ Missing Roblox configuration (API key, universe ID, or datastore name).');
    return null;
  }

  try {
    const url = `https://apis.roblox.com/ordered-data-stores/v1/universes/${universeId}/orderedDataStores/${dataStore}/scopes/${scope}/entries/${userId}`;

    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ROBLOX_API_KEY,
      },
    });

    if (response.status === 404) {
      // Entry not found
      return null;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    return data.value ?? null;
  } catch (err) {
    console.error(`❌ Error fetching coins for user ${userId}:`, err);
    return null;
  }
}



export async function execute(interaction) {
  const robloxName = await getrobloxname(interaction.user.id);

  const embed = new EmbedBuilder()
    .setTitle('🍓 〉 Arcabloom Profile')
    .setDescription('Your in-game stats!')
    .addFields(
      { name: '🪙 Coins', value: getUserCoins()}
    )
    .setColor(0xFFD700)
    .setFooter({ text: 'Arcabloom Services ©️ 2025' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}