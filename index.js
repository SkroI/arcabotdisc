import { Client, GatewayIntentBits, Collection, ActivityType, REST, Routes } from 'discord.js';
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

if (!token || !clientId || !guildId) {
  console.error("❌ Missing TOKEN, ID, or GUILD_ID in .env");
  process.exit(1);
}

// --- Path setup ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Discord client setup ---
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.DirectMessages],
});

client.commands = new Collection();

// --- Load commands dynamically ---
const commands = [];
const commandsPath = path.join(__dirname, 'commands');

if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter(f => f.endsWith('.js') && !f.includes('template'));

  for (const file of commandFiles) {
    const modulePath = `file://${path.join(commandsPath, file)}`;
    const mod = await import(modulePath);
    const command = mod.default ?? mod;

    if (command?.data && command?.execute) {
      client.commands.set(command.data.name, command);
      commands.push(command.data.toJSON());
      console.log(`✅ Loaded command: ${command.data.name}`);
    } else {
      console.log(`⚠️ Skipped ${file}: missing 'data' or 'execute'`);
    }
  }
}

// --- Register slash commands ---
const rest = new REST({ version: '10' }).setToken(token);
try {
  console.log(`🔄 Refreshing ${commands.length} application commands...`);
  await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
  console.log('✅ Commands registered successfully.');
} catch (err) {
  console.error('❌ Error registering commands:', err);
}

// --- Express server (keep-alive + leaderboard update) ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', async (_req, res) => {
  try {
    await editLeaderboardMessage(client);
    res.send(`
      <h1>🌮 Taco Bot is Online!</h1>
      <p><strong>Bot:</strong> ${client.user?.tag ?? 'Starting...'}</p>
      <p><strong>Leaderboard updated!</strong></p>
    `);
  } catch (err) {
    console.error('❌ Error updating leaderboard via Express route:', err);
    res.status(500).send('❌ Failed to update leaderboard.');
  }
});

app.listen(PORT, () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});

// --- Discord interaction handling ---
client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
    }
  } catch (err) {
    console.error('❌ Interaction error:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '⚠️ An error occurred while processing your command.', ephemeral: true });
    }
  }
});

// --- Ready event ---
client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity('Arcabloom Services', { type: ActivityType.Playing });
});

// --- Login ---
client.login(token);
