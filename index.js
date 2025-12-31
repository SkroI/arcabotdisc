import {
  Client,
  GatewayIntentBits,
  Collection,
  ActivityType,
  REST,
  Routes,
} from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import express from 'express';
import { editLeaderboardMessage } from './commands/leaderboardPoster.js';

config(); // Load .env

const token = process.env.TOKEN;
const clientId = process.env.ID;
const guildId = process.env.GUILD_ID;
const deathMessageId = process.env.DEATH_ID;

if (!token || !clientId || !guildId) {
  console.error('❌ Missing TOKEN, ID, or GUILD_ID in .env');
  process.exit(1);
}

// --- Path setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Discord client setup ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});
client.commands = new Collection();

// --- Death countdown helper ---
function getDeathMessage() {
  const now = new Date();

  // Fixed death date: 2 months from 31/12/2025
  const deathDate = new Date('2026-02-28T00:00:00Z');

  if (now >= deathDate) {
    return '☠️ I am dead.\n🪦 Dead time: 28/02/2026';
  }

  let months =
    (deathDate.getUTCFullYear() - now.getUTCFullYear()) * 12 +
    (deathDate.getUTCMonth() - now.getUTCMonth());

  const tempDate = new Date(now);
  tempDate.setUTCMonth(tempDate.getUTCMonth() + months);

  if (tempDate > deathDate) {
    months--;
    tempDate.setUTCMonth(tempDate.getUTCMonth() - 1);
  }

  const diffMs = deathDate - tempDate;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const minutes = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60)
  );

  return (
    `☠️ I'll die in: ${months} months ${days} days ${minutes} minutes\n` +
    `🪦 Dead time: 28/02/2026`
  );
}

// --- Load commands dynamically ---
const commands = [];
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith('.js') && !f.includes('template'));

  for (const file of commandFiles) {
    const modulePath = `file://${path.join(commandsPath, file)}`;
    const mod = await import(modulePath);
    const command = mod.default ?? mod;

    if (command?.data && command?.execute) {
      client.commands.set(command.data.name, command);
      commands.push(command.data.toJSON());
      console.log(`✅ Loaded command: ${command.data.name}`);
    }
  }
}

// --- Register slash commands ---
const rest = new REST({ version: '10' }).setToken(token);
await rest.put(Routes.applicationGuildCommands(clientId, guildId), {
  body: commands,
});

// --- Express server ---
const app = express();
app.get('/', async (_req, res) => {
  await editLeaderboardMessage(client);
  res.send('Arcabloom Services online');
});
app.listen(process.env.PORT || 4000);

// --- Ready event ---
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  client.user.setActivity('Arcabloom Services', {
    type: ActivityType.Playing,
  });

  const channelId = '1455903567419543714';
  let message;

  const channel = await client.channels.fetch(channelId);
  if (!channel || !channel.isTextBased()) return;

  // If no message ID → send new message
  if (!deathMessageId || deathMessageId === 'PUT_MESSAGE_ID_HERE') {
    message = await channel.send(getDeathMessage());
    console.log('🆕 Death message sent');
    console.log('🧾 MESSAGE ID:', message.id);
    console.log('➡️ Put this in .env as DEATH_ID');
  } else {
    // Otherwise fetch existing message
    message = await channel.messages.fetch(deathMessageId);
    console.log('✏️ Updating existing death message');
  }

  const updateMessage = async () => {
    try {
      await message.edit(getDeathMessage());
    } catch (err) {
      console.error('❌ Failed to update death message:', err);
    }
  };

  // Initial update
  await updateMessage();

  // Update every minute
  setInterval(updateMessage, 1000 * 60);
});

// --- Login ---
client.login(token);
