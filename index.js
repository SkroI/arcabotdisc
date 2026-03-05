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

 

// --- Login ---
client.login(token);
