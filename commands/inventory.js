import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('View sb inventory')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('username for inventory')
      .setRequired(false)
  );

const BLOXLINK_KEY = process.env.BLOXLINK_KEY;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const GUILD_ID = process.env.GUILD_ID;
const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const DATASTORE = process.env.ROBLOX_INVENTORY_KEY;
const SCOPE = 'global';

const ALLOWED_ROLES = [
  '1427338616580870247', 
];

const namecache = {};
const usernameCache = {};

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

async function getInventory(robloxId) {
  try {
    const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${DATASTORE}&scope=${SCOPE}&entryKey=${robloxId}`;
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': ROBLOX_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 404) {
      return [];
    }
    if (!response.ok) {
      console.error(`Error fetching inventory: ${response.statusText}`);
      return [];
    }

    const text = await response.text();
    const inventory = JSON.parse(text);
    return Array.isArray(inventory) ? inventory : [];
  } catch (err) {
    console.error('Error fetching inventory:', err);
    return [];
  }
}

function stackItems(inventory) {
  const counts = {};
  for (const item of inventory) {
    counts[item] = (counts[item] || 0) + 1;
  }

  return Object.entries(counts).map(([item, count]) =>
    count > 1 ? `${item} ×${count}` : item
  );
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const memberRoles = interaction.member.roles.cache;
  const hasAllowedRole = ALLOWED_ROLES.some(role => memberRoles.has(role));

  if (!hasAllowedRole) {
    return interaction.editReply({
      content: '❌ You do not have permission to use this command.',
    });
  }

  const targetUser = interaction.options.getUser('user') || interaction.user;

  const customInventories = {
    '1275114103282733078': ['x100 Secret Tacos', 'x1 Pixel Diamond', 'x1000000 Bugs'],
    '837537455212986378': ["Developer Inventory, you can't view it"],
  };

  if (customInventories[targetUser.id]) {
    const customInventory = customInventories[targetUser.id];
    const description =
      customInventory.length > 0
        ? customInventory.map(i => `• ${i}`).join('\n')
        : 'No items found in this inventory.';

    const embed = new EmbedBuilder()
      .setTitle(`🍓 〉 ${targetUser.username}'s Inventory`)
      .setDescription(description)
      .setColor(0x9b59b6)
      .setFooter({ text: 'Arcabloom Services ©️ 2025' })
      .setTimestamp();

    return interaction.editReply({ embeds: [embed], ephemeral: true });
  }

  const robloxId = await getRobloxId(targetUser.id);

  if (!robloxId) {
    return interaction.editReply({
      content: `❌ ${targetUser.id === interaction.user.id
        ? 'Your'
        : `${targetUser.username}'s`
      } Discord account is not linked to Roblox. [Please verify!] `,
    });
  }

  const username = await getUsername(robloxId);
  const inventory = await getInventory(robloxId);
  const stacked = stackItems(inventory);

  const description =
    stacked.length > 0
      ? stacked.map(i => `• ${i}`).join('\n')
      : 'No items found in your inventory.';

  const embed = new EmbedBuilder()
    .setTitle(`🍓 〉 ${username}'s Inventory`)
    .setDescription(description)
    .setColor(0x9b59b6)
    .setFooter({ text: 'Arcabloom Services ©️ 2025' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed], ephemeral: true });
}
