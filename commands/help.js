import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Get help?');

export const allowed = []; 

const usernameCache = {};
const namecache = {};
const key = process.env.BLOXLINK_KEY;

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

async function getrobloxname(id) {
  if (namecache[id]) return namecache[id];
  try {
    const res = await fetch(
      `https://api.blox.link/v4/public/discord-to-roblox/${id}`,
      { headers: { Authorization: key } }
    );

    if (!res.ok) return 'Not linked';
    const data = await res.json();

    const robloxId = data.robloxID;
    if (!robloxId) return 'Not linked';

    const username = await getUsername(robloxId);
    namecache[id] = username;
    return username;
  } catch {
    return 'Error fetching username';
  }
}

export async function execute(interaction) {
  const robloxName = await getrobloxname(interaction.user.id);

  const embed = new EmbedBuilder()
    .setTitle('🍓 〉 Arcabloom')
    .setDescription('Coming Soon!')
    .addFields(
      { name: '💡 Developers', value: '• I_ItsRainingTacos\n• ScriptedDorito' },
      { name: '🎯 Testers', value: 'A lot of people' },
      { name: '🤖 Roblox Username', value: robloxName },
      { name: '🪪 Discord ID', value: interaction.user.id }
    )
    .setColor(0xFFD700)
    .setFooter({ text: 'Arcabloom Services ©️ 2025' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
