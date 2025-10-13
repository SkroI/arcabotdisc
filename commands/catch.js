import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getRandomTaco, createTacoInstance, rarityColors } from '../tacos.js';
import { getUser, updateUser } from '../database.js';

const allowed = [];

export const data = new SlashCommandBuilder()
  .setName('catch')
  .setDescription('Try to catch a wild taco!');

export async function execute(interaction) {
  if (allowed.length > 0) {
    const memberRoles = interaction.member.roles.cache.map(role => role.id);
    const hasPermission = allowed.some(roleId => memberRoles.includes(roleId));
    if (!hasPermission) {
      return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
    }
  }

  const user = getUser(interaction.user.id);
  const now = Date.now();
  const cooldown = 10000; // 10 seconds for testing

  if (user.lastCatch && now - user.lastCatch < cooldown) {
    const timeLeft = Math.ceil((cooldown - (now - user.lastCatch)) / 1000);
    return interaction.reply({ content: `⏰ Wait ${timeLeft}s before catching again!`, ephemeral: true });
  }

  const tacoData = getRandomTaco();
  const taco = createTacoInstance(tacoData);

  // Determine if caught
  const catchChance = Math.random();
  const baseChance = 0.7;
  const rarityModifier = {
    common: 0,
    uncommon: -0.1,
    rare: -0.2,
    epic: -0.3,
    legendary: -0.4,
    mythic: -0.5
  };
  const finalChance = baseChance + (rarityModifier[taco.rarity] || 0);
  const caught = catchChance <= finalChance;

  if (caught) {
    user.tacos.push(taco);
    user.catchStreak = (user.catchStreak || 0) + 1;
    user.lastCatch = now;
    user.coins += 10;

    // --- XP System ---
    const rarityXP = {
      common: 5,
      uncommon: 10,
      rare: 20,
      epic: 35,
      legendary: 50,
      mythic: 75
    };
    const gainedXP = rarityXP[taco.rarity] || 5;
    user.xp = (user.xp || 0) + gainedXP;

    // Optional: Level up if XP threshold is reached
    const xpToLevel = 100; // fixed threshold per level
    user.level = user.level || 1;
    if (user.xp >= xpToLevel) {
      user.level += 1;
      user.xp -= xpToLevel;
    }

    updateUser(interaction.user.id, user);

    const embed = new EmbedBuilder()
      .setTitle('🎉 Taco Caught!')
      .setDescription(`You caught a **${taco.emoji} ${taco.name}**!`)
      .addFields(
        { name: 'Rarity', value: taco.rarity.toUpperCase(), inline: true },
        { name: 'Type', value: taco.type, inline: true },
        { name: 'Level', value: `${taco.level}`, inline: true },
        { name: 'HP', value: `${taco.hp}`, inline: true },
        { name: 'Attack', value: `${taco.attack}`, inline: true },
        { name: 'Defense', value: `${taco.defense}`, inline: true },
        { name: 'Reward', value: '+10 coins', inline: false },
        { name: 'Catch Streak', value: `🔥 ${user.catchStreak}`, inline: true },
        { name: 'XP Gained', value: `✨ +${gainedXP} XP`, inline: true },
        { name: 'Level', value: `🏆 ${user.level}`, inline: true }
      )
      .setColor(rarityColors[taco.rarity])
      .setFooter({ text: `Total Tacos: ${user.tacos.length}` })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  } else {
    user.catchStreak = 0;
    user.lastCatch = now;
    updateUser(interaction.user.id, user);

    const embed = new EmbedBuilder()
      .setTitle('😢 Taco Escaped!')
      .setDescription(`A wild **${taco.emoji} ${taco.name}** appeared but escaped!`)
      .addFields(
        { name: 'Rarity', value: taco.rarity.toUpperCase(), inline: true },
        { name: 'Catch Streak', value: 'Reset to 0', inline: true }
      )
      .setColor(0xFF0000)
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  }
}
