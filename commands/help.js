// commands/help.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Learn how to play the Taco Game!');

export const allowed = []; // keep for consistency if you check roles

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🌮 Taco Game - How to Play')
    .setDescription('Welcome to the Taco Game! Collect, battle, and become the ultimate Taco Master!')
    .addFields(
      { name: '🎣 /catch', value: 'Catch wild tacos! Each taco has different stats and rarity.' },
      { name: '📦 /inventory', value: 'View all your collected tacos and their stats.' },
      { name: '⚔️ /battle', value: 'Battle with your taco against wild tacos!' },
      { name: '👤 /profile', value: 'View your trainer stats and achievements.' },
      { name: '\u200B', value: '\u200B' },
      { name: '🌟 Rarities (Lowest to Highest)', value: 'Common → Uncommon → Rare → Epic → Legendary → Mythic' },
      { name: '💡 Tips', value: '• Higher rarity tacos are harder to catch\n• Win battles to earn XP and coins\n• Build your catch streak for better rewards\n• Each taco has unique stats: HP, Attack, Defense' },
      { name: '🎯 Goal', value: 'Catch them all and become the ultimate Taco Master!' }
    )
    .setColor(0xFFD700)
    .setFooter({ text: 'Good luck, Taco Trainer!' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
