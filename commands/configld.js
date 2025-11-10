import { SlashCommandBuilder } from 'discord.js';
import fetch from 'node-fetch';

const allowed = [process.env.DEVELOPERROLE]; // admin user IDs

export const data = new SlashCommandBuilder()
  .setName('configld')
  .setDescription('Add or remove coins from a player')
  .addStringOption(option =>
    option.setName('username')
      .setDescription('Roblox username of the player')
      .setRequired(true))
  .addIntegerOption(option =>
    option.setName('amount')
      .setDescription('Number of coins to add or remove (use negative to remove)')
      .setRequired(true));

export { allowed };

// Convert Roblox username -> userId using bulk endpoint
async function getUserId(username) {
  try {
    const res = await fetch(`https://users.roblox.com/v1/usernames/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ usernames: [username], excludeBannedUsers: true })
    });
    if (!res.ok) throw new Error('Failed to fetch userId');
    const data = await res.json();
    if (!data.data || data.data.length === 0) throw new Error('User not found');
    return data.data[0].id;
  } catch (err) {
    throw new Error(`Unable to get userId for ${username}: ${err.message}`);
  }
}

// Increment (or decrement) coins in OrderedDataStore
async function incrementCoins(userId, amount, universeId, dataStore, scope, apiKey) {
  const url = `https://apis.roblox.com/ordered-data-stores/v1/universes/${universeId}/orderedDataStores/${dataStore}/scopes/${scope}/entries/${userId}:increment`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ amount })
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to update coins: ${res.status} ${text}`);
  }

  return res.json(); // returns updated value
}

export async function execute(interaction) {
  if (allowed.length > 0 && !allowed.includes(interaction.user.id)) {
    return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
  }

  const username = interaction.options.getString('username');
  const amount = interaction.options.getInteger('amount');

  const universeId = process.env.ROBLOX_UNIVERSE_ID;
  const dataStore = process.env.ROBLOX_LEADERSTAT_KEY;
  const scope = 'global';
  const apiKey = process.env.ROBLOX_API_KEY;

  if (!apiKey || !universeId || !dataStore) {
    return interaction.reply({ content: '❌ Missing environment variables.', ephemeral: true });
  }

  try {
    const userId = await getUserId(username);
    const updated = await incrementCoins(userId, amount, universeId, dataStore, scope, apiKey);

    await interaction.reply({
      content: `✅ Updated **${username}** coins by **${amount}**. New total: **${updated.value}**`,
      ephemeral: true
    });
  } catch (err) {
    console.error(err);
    await interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
  }
}
