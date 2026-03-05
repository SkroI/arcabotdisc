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

config();

// --- ENV ---
const token = process.env.TOKEN;
const clientId = process.env.ID;
const guildId = process.env.GUILD_ID;

if (!token || !clientId || !guildId) {
  console.error('❌ Missing TOKEN, ID, or GUILD_ID in .env');
  process.exit(1);
}

// --- Path setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Discord client ---
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.DirectMessages,
  ],
});

client.commands = new Collection();

// --- Load commands ---
const commands = [];
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs
    .readdirSync(commandsPath)
    .filter((f) => f.endsWith('.js') && !f.includes('template'));

  for (const file of commandFiles) {
    const modulePath = `file://${path.join(commandsPath, file)}`;
    const mod = await import(modulePath);

    // support both default export and named export
    const command = mod.default || mod;

    if (!command.data || !command.execute) {
      console.log(`⚠️ Skipping ${file} (missing data or execute)`);
      continue;
    }

    client.commands.set(command.data.name, command);
    commands.push(command.data.toJSON());

    console.log(`✅ Loaded command: ${command.data.name}`);
  }
}

// --- Register slash commands ---
const rest = new REST({ version: '10' }).setToken(token);

await rest.put(
  Routes.applicationGuildCommands(clientId, guildId),
  { body: commands }
);

console.log('✅ Slash commands registered');

// --- Interaction handler ---
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction, client);
  } catch (error) {
    console.error(`❌ Error executing ${interaction.commandName}:`, error);

    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({
        content: '❌ There was an error executing this command.',
        ephemeral: true,
      });
    } else {
      await interaction.reply({
        content: '❌ There was an error executing this command.',
        ephemeral: true,
      });
    }
  }
});

// --- Express server ---
const app = express();

app.get('/', async (_req, res) => {
  if (!client.isReady()) {
    return res.send('Bot not ready yet');
  }

  try {
    await editLeaderboardMessage(client);
    res.send('Arcabloom Services online');
  } catch (err) {
    console.error(err);
    res.status(500).send('Leaderboard update error');
  }
});

app.listen(process.env.PORT || 4000, () => {
  console.log('🌐 Web server running');
});

// --- Ready event ---
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);

  client.user.setActivity('Arcabloom Services', {
    type: ActivityType.Playing,
  });

  const channelId = '1455903567419543714';

  try {
    const channel = await client.channels.fetch(channelId);

    if (!channel || !channel.isTextBased()) return;

    console.log('📡 Channel fetched successfully');
  } catch (err) {
    console.error('❌ Failed to fetch channel:', err);
  }
});

// --- Login ---
client.login(token);