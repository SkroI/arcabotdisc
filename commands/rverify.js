import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

export const data = new SlashCommandBuilder()
  .setName('rverify')
  .setDescription('Verify a Discord user with Roblox')
  .addUserOption(option =>
    option.setName('user')
          .setDescription('Discord user to verify')
          .setRequired(true)
  );

const BLOXLINK_KEY = process.env.BLOXLINK_KEY;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const MODROLE = process.env.MODROLE;
const GUILD_ID = process.env.GUILD_ID;

async function getRobloxId(discordId) {
  try {
    const res = await fetch(`https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${discordId}`, {
      headers: { Authorization: BLOXLINK_KEY }
    });
    if (res.status === 404) return null;
    if (!res.ok) return null;
    const data = await res.json();
    return data.robloxID || null;
  } catch {
    return null;
  }
}

async function sendVerificationMessage(userId) {
  try {
    await fetch(`https://apis.roblox.com/messaging-service/v1/universes/${UNIVERSE_ID}/topics/DiscVerification`, {
      method: 'POST',
      headers: {
        'x-api-key': ROBLOX_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: JSON.stringify({ UserID: userId, Status: 'Verified' }) })
    });
  } catch (err) {
    console.error('MessagingService error:', err);
  }
}

async function setVerified(userId) {
  const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=VerificationDB&entryKey=${userId}`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': ROBLOX_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify("Verified") // Only storing string to match your Lua script
    });
  } catch (err) {
    console.error('Datastore error:', err);
  }
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const memberRoles = interaction.member.roles.cache;
  if (!memberRoles.has(MODROLE)) return interaction.editReply('❌ You do not have permission.');

  const targetUser = interaction.options.getUser('user');
  const robloxId = await getRobloxId(targetUser.id);

  if (!robloxId) {
    return interaction.editReply(`❌ ${targetUser.username} has not linked their Discord to Roblox.`);
  }

  await setVerified(targetUser.id);
  await sendVerificationMessage(robloxId);

  const embed = new EmbedBuilder()
    .setTitle('✅ User Verified')
    .setDescription(`${targetUser.username} has been verified.`)
    .setColor(0x00ff00);

  await interaction.editReply({ embeds: [embed] });
}
