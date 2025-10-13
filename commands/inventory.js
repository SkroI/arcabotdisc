// commands/inventory.js
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser } from '../database.js';
import { rarityColors } from '../tacos.js';

export const data = new SlashCommandBuilder()
  .setName('inventory')
  .setDescription('View your taco collection');

export const allowed = [];

export async function execute(interaction) {
  if (allowed.length > 0) {
    const memberRoles = interaction.member.roles.cache.map(role => role.id);
    const hasPermission = allowed.some(roleId => memberRoles.includes(roleId));

    if (!hasPermission) {
      return interaction.reply({ 
        content: '❌ You do not have permission to use this command.', 
        ephemeral: true 
      });
    }
  }

  const user = getUser(interaction.user.id);

  if (!user.tacos || user.tacos.length === 0) {
    return interaction.reply({
      content: '📦 Your inventory is empty! Use `/catch` to catch some tacos!',
      ephemeral: true
    });
  }

  const tacosByRarity = {};
  user.tacos.forEach(taco => {
    if (!tacosByRarity[taco.rarity]) tacosByRarity[taco.rarity] = [];
    tacosByRarity[taco.rarity].push(taco);
  });

  const rarityOrder = ['mythic', 'legendary', 'epic', 'rare', 'uncommon', 'common'];
  let description = '';

  rarityOrder.forEach(rarity => {
    if (tacosByRarity[rarity]) {
      description += `\n**${rarity.toUpperCase()}** (${tacosByRarity[rarity].length})\n`;
      tacosByRarity[rarity].forEach(taco => {
        description += `${taco.emoji} ${taco.name} - Lvl ${taco.level} (HP: ${taco.hp}, ATK: ${taco.attack}, DEF: ${taco.defense})\n`;
      });
    }
  });

  const embed = new EmbedBuilder()
    .setTitle(`${interaction.user.username}'s Taco Collection`)
    .setDescription(description || 'No tacos yet!')
    .addFields(
      { name: 'Total Tacos', value: `${user.tacos.length}`, inline: true },
      { name: 'Coins', value: `💰 ${user.coins}`, inline: true }
    )
    .setColor(0x0099FF)
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
