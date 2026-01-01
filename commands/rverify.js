import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';
import crypto from 'crypto';

export const data = new SlashCommandBuilder()
  .setName('rverify')
  .setDescription('Verify a Discord user with Roblox')
  .addUserOption(option =>
    option
      .setName('user')
      .setDescription('Discord user to verify')
      .setRequired(true)
  );

// CONFIG
const BLOXLINK_KEY = process.env.BLOXLINK_KEY;
const ROBLOX_API_KEY = process.env.ROBLOX_API_KEY;
const GUILD_ID = process.env.GUILD_ID;
const UNIVERSE_ID = process.env.ROBLOX_UNIVERSE_ID;
const DATASTORE_NAME = 'VerificationDB';
const ALLOWED_ROLES = process.env.MODROLE;

const usernameCache = {};

async function getRobloxId(discordId) {
  try {
    const res = await fetch(
      `https://api.blox.link/v4/public/guilds/${GUILD_ID}/discord-to-roblox/${discordId}`,
      { headers: { Authorization: BLOXLINK_KEY } }
    );
    if (res.status === 404) return null;
    if (!res.ok) return null;

    const data = await res.json();
    return data.robloxID || null;
  } catch (err) {
    console.error('Bloxlink error:', err);
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

function computeContentMD5(bodyString) {
  return crypto.createHash('md5').update(bodyString, 'utf8').digest('base64');
}

async function setVerificationEntry(userId, valueObj) {
  const bodyString = JSON.stringify(valueObj);
  const md5 = computeContentMD5(bodyString);

  const url = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${DATASTORE_NAME}&entryKey=${userId}`;
  const headers = {
    'x-api-key': ROBLOX_API_KEY,
    'content-type': 'application/json',
    'content-md5': md5,
    'roblox-entry-userids': `[${userId}]`,
    'roblox-entry-attributes': '{}',
  };

  const res = await fetch(url, { method: 'POST', headers, body: bodyString });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${text}`);
  try { return JSON.parse(text || '{}'); } catch { return text; }
}

async function sendVerificationMessage(userId) {
  try {
    const res = await fetch(
      `https://apis.roblox.com/messaging-service/v1/universes/${UNIVERSE_ID}/topics/DiscVerification`,
      {
        method: 'POST',
        headers: {
          'x-api-key': ROBLOX_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: JSON.stringify({ UserID: userId, Status: 'Verified' }) }),
      }
    );
    if (!res.ok) console.error(`Messaging service error: ${res.status}`);
  } catch (err) {
    console.error('Messaging service error:', err);
  }
}

export async function execute(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const memberRoles = interaction.member.roles.cache;
  if (!ALLOWED_ROLES.some(role => memberRoles.has(role))) {
    return interaction.editReply({ content: '❌ You do not have permission to verify users.' });
  }

  const targetUser = interaction.options.getUser('user');

  // Step 1: Check Verification Status in Roblox DataStore
  const getStatusUrl = `https://apis.roblox.com/datastores/v1/universes/${UNIVERSE_ID}/standard-datastores/datastore/entries/entry?datastoreName=${DATASTORE_NAME}&entryKey=${targetUser.id}`;
  let status = 'Pending';
  try {
    const res = await fetch(getStatusUrl, { headers: { 'x-api-key': ROBLOX_API_KEY } });
    if (res.ok) {
      const data = await res.json();
      if (data?.Status) status = data.Status;
    }
  } catch (err) {
    console.error('Error fetching verification status:', err);
  }

  if (status === 'Verified') {
    return interaction.editReply({ content: `✅ ${targetUser.username} is already verified.` });
  }

  const robloxId = await getRobloxId(targetUser.id);
  if (!robloxId) {
    return interaction.editReply({
      content: `❌ ${targetUser.username} has not linked their Discord to Roblox. Ask them to verify via Bloxlink.`,
    });
  }

  const robloxUsername = await getUsername(robloxId);

  const valueObj = {
    DiscordID: targetUser.id,
    DiscordUsername: targetUser.username,
    RobloxID: robloxId,
    RobloxUsername: robloxUsername,
    Status: 'Verified',
  };

  try {
    await setVerificationEntry(targetUser.id, valueObj);
    await sendVerificationMessage(robloxId);

    const embed = new EmbedBuilder()
      .setTitle('✅ User Verified')
      .setDescription(`${targetUser.username} has been successfully verified with Roblox account **${robloxUsername}**.`)
      .setColor(0x00ff00)
      .setThumbnail(`https://www.roblox.com/headshot-thumbnail/image?userId=${robloxId}&width=420&height=420&format=png`);

    await interaction.editReply({ embeds: [embed] });
  } catch (err) {
    console.error('Verification error:', err);
    await interaction.editReply({ content: '❌ An error occurred while verifying the user.' });
  }
}
