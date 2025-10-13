// commands/help.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Get help?');

export const allowed = []; // keep for consistency if you check roles

export async function execute(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🍓 〉 Arcabloom')
    .setDescription('Coming Soon!')
    .addFields(
      { name: '💡 Developers', value: '• I_ItsRainingTacos\n• ScriptedDorito' },
      { name: '🎯 Testers', value: 'A lot of people' }
    )
    .setColor(0xFFD700)
    .setFooter({ text: 'Arcabloom Services ©️ 2025' })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
