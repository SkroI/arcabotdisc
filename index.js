import { Client, GatewayIntentBits, Collection, ActivityType, REST, Routes } from 'discord.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from 'dotenv';
import express from 'express';

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

// --- Express server to keep Render service alive ---
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (_req, res) => {
  res.send(`
    <h1>🌮 Taco Bot is Online!</h1>
    <p><strong>Bot:</strong> ${client.user?.tag ?? 'Starting...'}</p>
    <p><strong>Active Commands:</strong> ${client.commands.size}</p>
    <p>Status: ✅ Running smoothly on Render</p>
  `);
});

app.listen(PORT, () => {
  console.log(`🌐 Express server running on port ${PORT}`);
});

// --- Discord interaction handling ---
client.on('interactionCreate', async interaction => {
  try {
    // Slash commands
    if (interaction.isCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      // Pass client to duel command
      if (interaction.commandName === 'duel') {
        await command.execute(interaction, client);
      } else {
        await command.execute(interaction);
      }
    }

    // Select menu
    else if (interaction.isStringSelectMenu()) {
      if (interaction.customId === 'battle_selectTaco') {
        const battleModule = await import('./commands/battle.js');
        return battleModule.handleSelect(interaction);
      } else if (interaction.customId.startsWith('duel_select_')) {
        const duelModule = await import('./commands/duel.js');
        return duelModule.handleSelect(interaction);
      }
    }

    // Buttons
    else if (interaction.isButton()) {
      if (interaction.customId.startsWith('battle_')) {
        const battleModule = await import('./commands/battle.js');
        return battleModule.handleButton(interaction);
      } else if (interaction.customId.startsWith('duel_')) {
        const duelModule = await import('./commands/duel.js');
        return duelModule.handleFightButton(interaction);
      }
    }
  } catch (err) {
    console.error('❌ Interaction error:', err);
    if (!interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '⚠️ An error occurred while processing your command.', ephemeral: true });
    }
  }
});

// --- Ready event ---
client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  client.user.setActivity('Taco Battles 🌮', { type: ActivityType.Playing });
});

// --- Login ---
client.login(token);
