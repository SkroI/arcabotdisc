import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('Get your Arcabloom profile info.');

export const allowed = [];
const namecache = {};

const BLOXLINK_KEY = process.env.BLOXLINK_KEY;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const GUILD_ID = process.env.GUILD_ID;
const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const DATASTORE = 'Coins'; 
const SCOPE = 'global';
// Fetch Roblox ID from Discord ID via Blox.link
async function getRobloxId(discordId) {
  if (namecache[discordId]) return namecache[discordId];

  try {
    const res = await fetch(
      `https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${discordId}`,
      { headers: { Authorization: BLOXLINK_KEY } }
    );

    if (res.status === 404) return null; // Not linked
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

async function getCoins(robloxId) {
  if (!robloxId) return 0;

  let cursor = null;
  try {
    do {
      const url = new URL(
        `https://apis.roblox.com/ordered-data-stores/v1/universes/${UNIVERSE_ID}/orderedDataStores/${DATASTORE}/scopes/${SCOPE}/entries`
      );
      url.searchParams.set('max_page_size', 100);
      url.searchParams.set('order_by', 'desc');
      if (cursor) url.searchParams.set('cursor', cursor);

      const response = await fetch(url.toString(), {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ROBLOX_API_KEY,
        },
      });

      if (!response.ok) {
        console.error(`Roblox API returned status ${response.status}`);
        return 0;
      }

      const data = await response.json();

      if (!data.entries || !Array.isArray(data.entries)) {
        console.warn('Roblox API response has no entries:', data);
        return 0;
      }

      const entry = data.entries.find(e => e.id === robloxId);
      if (entry) return entry.value;

      cursor = data.nextPageCursor || null;
    } while (cursor);

    return 0; // Not found after checking all pages
  } catch (err) {
    console.error('Error fetching coins:', err);
    return 0;
  }
}

// Command execution
export async function execute(interaction) {
  const robloxId = await getRobloxId(interaction.user.id);

  if (!robloxId) {
    return interaction.reply({
      content: '❌ Your Discord account is not linked to Roblox.',
      ephemeral: true,
    });
  }

  const coins = await getCoins(robloxId);

  const embed = new EmbedBuilder()
    .setTitle('🍓 〉 Arcabloom Profile')
    .setDescription('Here is your profile information!')
    .addFields(
      { name: '🪙 Coins', value: `${coins}` },
      { name: '🤖 Roblox ID', value: robloxId.toString() }
    )
    .setColor(0xFFD700)
    .setFooter({ text: 'Arcabloom Services ©️ 2025' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}


