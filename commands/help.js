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

async function getrobloxname(discordId) {
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

    const username = await getUsername(robloxId);
    namecache[discordId] = username;
    return username;
  } catch (err) {
    console.error('Error fetching Roblox name:', err);
    return 'Error fetching name';
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
      { name: '🤖 Roblox Username', value: robloxName }
    )
    .setColor(0xFFD700)
    .setFooter({ text: 'Arcabloom Services ©️ 2025' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
