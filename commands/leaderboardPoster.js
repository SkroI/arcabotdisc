import { EmbedBuilder } from 'discord.js';
import fetch from 'node-fetch';

const CHANNEL_ID = '1427324210832740415';
const MESSAGE_ID = process.env.MESSAGE_ID;
const usernameCache = {};

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

export async function fetchLeaderboardEmbed() {
  const universeId = process.env.ROBLOX_UNIVERSE_ID;
  const dataStore = process.env.ROBLOX_LEADERSTAT_KEY;
  const limit = 10;

  if (!process.env.ROBLOX_API_KEY || !universeId || !dataStore) {
    console.error('❌ Missing Roblox API info in .env');
    return null;
  }

  try {
    const url = `https://apis.roblox.com/ordered-data-stores/v1/universes/${universeId}/orderedDataStores/${dataStore}/scopes/global/entries?max_page_size=${limit}&order_by=desc`;
    const response = await fetch(url, {
      headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.ROBLOX_API_KEY }
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
    const data = await response.json();

    if (!data.entries || data.entries.length === 0) return null;

    const leaderboardLines = await Promise.all(
      data.entries.map(async (entry, index) => {
        const username = await getUsername(entry.id);
        return `#${index + 1} **${username}** - **${entry.value} Coins**`;
      })
    );

    const embed = new EmbedBuilder()
      .setTitle('🪙 Coins Leaderboard')
      .setDescription(leaderboardLines.join('\n'))
      .setColor(0xFFD700)
      .setThumbnail('https://tr.rbxcdn.com/1e1c7f41bb5f41c0d87a2a4f1d8898d2/420/420/Image/Png')
      .setFooter({ text: 'Last updated' })
      .setTimestamp();

    return embed;
  } catch (err) {
    console.error('❌ Failed to fetch leaderboard:', err);
    return null;
  }
}

export async function editLeaderboardMessage(client) {
  try {
    const embed = await fetchLeaderboardEmbed();
    if (!embed) {
      console.error('❌ No embed data to send.');
      return;
    }

    const channel = await client.channels.fetch(CHANNEL_ID);

    try {
      const message = await channel.messages.fetch(MESSAGE_ID);
      await message.edit({ embeds: [embed] });
      console.log('✅ Leaderboard message updated');
    } catch (fetchErr) {
      console.warn('⚠️ Existing leaderboard message not found, sending a new one...');
      const sent = await channel.send({ embeds: [embed] });
      console.log(`✅ Sent new leaderboard message!`);
      console.log(`👉 Update your .env or code with this new ID.`);
    }

  } catch (err) {
    console.error('❌ Failed to edit/send leaderboard message:', err);
  }
}


