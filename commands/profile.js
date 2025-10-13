import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getUser } from '../database.js';

const allowed = [];

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View your taco trainer profile');

export { allowed };

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

  const totalBattles = (user.battleWins || 0) + (user.battleLosses || 0);
  const winRate = totalBattles > 0 ? ((user.battleWins / totalBattles) * 100).toFixed(1) : 0;

  const rarityCount = {};
  (user.tacos || []).forEach(taco => {
    rarityCount[taco.rarity] = (rarityCount[taco.rarity] || 0) + 1;
  });

  // XP and level
  const xp = user.xp || 0;
  const level = user.level || 1;
  const xpToLevel = 100;
  const xpProgress = `${xp}/${xpToLevel}`;

  const embed = new EmbedBuilder()
    .setTitle(`🌮 ${interaction.user.username}'s Profile`)
    .setDescription('**Taco Trainer Stats**')
    .addFields(
      { name: '💰 Coins', value: `${user.coins || 0}`, inline: true },
      { name: '🌮 Total Tacos', value: `${(user.tacos || []).length}`, inline: true },
      { name: '🔥 Catch Streak', value: `${user.catchStreak || 0}`, inline: true },
      { name: '⚔️ Battle Wins', value: `${user.battleWins || 0}`, inline: true },
      { name: '💔 Battle Losses', value: `${user.battleLosses || 0}`, inline: true },
      { name: '📊 Win Rate', value: `${winRate}%`, inline: true },
      { name: '🏆 Level', value: `${level}`, inline: true },
      { name: '✨ XP', value: xpProgress, inline: true }
    )
    .setColor(0xFFD700)
    .setThumbnail(interaction.user.displayAvatarURL())
    .setTimestamp();

  if (Object.keys(rarityCount).length > 0) {
    let rarityText = '';
    Object.entries(rarityCount).forEach(([rarity, count]) => {
      rarityText += `${rarity.toUpperCase()}: ${count}\n`;
    });
    embed.addFields({ name: '📦 Collection by Rarity', value: rarityText });
  }

  await interaction.reply({ embeds: [embed], ephemeral: true });
}
