import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle
} from 'discord.js';
import { getUser, updateUser } from '../database.js';
import { getRandomTaco, createTacoInstance } from '../tacos.js';

export const allowed = [];
export const activeBattles = new Map();

export const data = new SlashCommandBuilder()
  .setName('battle')
  .setDescription('Battle with your taco!');

export async function execute(interaction) {
  if (allowed.length > 0) {
    const memberRoles = interaction.member.roles.cache.map(r => r.id);
    if (!allowed.some(rid => memberRoles.includes(rid))) {
      return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    }
  }

  const user = getUser(interaction.user.id);
  if (!user.tacos || user.tacos.length === 0) {
    return interaction.reply({ content: '❌ You need a taco first! Use `/catch`.', ephemeral: true });
  }
  if (activeBattles.has(interaction.user.id)) {
    return interaction.reply({ content: '⚔️ You are already in a battle!', ephemeral: true });
  }

  // Private taco selection
  const tacoOptions = user.tacos.map((taco, idx) => ({
    label: `${taco.name} (Lvl ${taco.level})`,
    value: `${idx}`,
    description: `HP: ${taco.hp}, ATK: ${taco.attack}, DEF: ${taco.defense}`,
    emoji: taco.emoji
  }));

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('battle_selectTaco')
    .setPlaceholder('Select your taco for battle')
    .addOptions(tacoOptions);

  const row = new ActionRowBuilder().addComponents(selectMenu);

  await interaction.reply({
    content: '⚔️ Select a taco to battle!',
    components: [row],
    ephemeral: true
  });
}

// Handle taco selection
export async function handleSelect(interaction) {
  const user = getUser(interaction.user.id);
  const selectedIndex = parseInt(interaction.values[0], 10);
  const playerTaco = user.tacos[selectedIndex];
  const enemyData = getRandomTaco();
  const enemyLevel = Math.max(1, playerTaco.level + Math.floor(Math.random() * 3) - 1);
  const enemyTaco = createTacoInstance(enemyData, enemyLevel);

  const battleState = {
    playerId: interaction.user.id,
    playerTaco: { ...playerTaco, currentHp: playerTaco.hp },
    enemyTaco: { ...enemyTaco, currentHp: enemyTaco.hp },
    turn: 1
  };

  activeBattles.set(interaction.user.id, battleState);

  const attackButton = new ButtonBuilder()
    .setCustomId('battle_attack')
    .setLabel('Attack')
    .setStyle(ButtonStyle.Danger)
    .setEmoji('⚔️');
  const defendButton = new ButtonBuilder()
    .setCustomId('battle_defend')
    .setLabel('Defend')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('🛡️');
  const runButton = new ButtonBuilder()
    .setCustomId('battle_run')
    .setLabel('Run')
    .setStyle(ButtonStyle.Secondary)
    .setEmoji('🏃');

  const buttonRow = new ActionRowBuilder().addComponents(
    attackButton,
    defendButton,
    runButton
  );

  const embed = generateBattleEmbed(battleState);

  // Make battle public
  await interaction.channel.send({
    content: `⚔️ ${interaction.user} has started a battle!`,
    embeds: [embed],
    components: [buttonRow]
  });

  // Remove selection menu privately
  await interaction.update({
    content: '✅ Taco selected!',
    components: [],
    ephemeral: true
  });
}

// Handle battle buttons
export async function handleButton(interaction) {
  const battleState = activeBattles.get(interaction.user.id);

  // 🔒 Prevent others from interacting
  const playerBattle = [...activeBattles.values()].find(
    b => b.playerId === interaction.user.id
  );
  const isOwner = playerBattle && playerBattle.playerId === interaction.user.id;

  if (!isOwner) {
    return interaction.reply({
      content: '🚫 This is not your battle!',
      ephemeral: true
    });
  }

  if (!battleState) {
    return interaction.update({
      content: '⚠️ Battle ended!',
      components: [],
      embeds: []
    });
  }

  const user = getUser(interaction.user.id);
  let log = '';

  switch (interaction.customId) {
    case 'battle_attack':
      log = battleTurn(battleState, false);
      break;
    case 'battle_defend':
      log = battleTurn(battleState, true);
      break;
    case 'battle_run':
      activeBattles.delete(interaction.user.id);
      return interaction.update({
        content: '🏃 You ran away!',
        components: [],
        embeds: []
      });
  }

  // Battle ended: WIN
  if (battleState.enemyTaco.currentHp <= 0) {
    const gainedXP = 10 + battleState.enemyTaco.level * 5;
    user.xp = (user.xp || 0) + gainedXP;
    user.level = user.level || 1;
    let levelUpMsg = '';
    if (user.xp >= 100) {
      user.level += 1;
      user.xp -= 100;
      levelUpMsg = `\n🏆 Level Up! You are now level ${user.level}!`;
    }

    updateUser(interaction.user.id, user);
    activeBattles.delete(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('🎉 Battle Victory!')
      .setDescription(
        `${interaction.user} defeated **${battleState.enemyTaco.name}**!${levelUpMsg}`
      )
      .addFields(
        {
          name: 'Your Taco',
          value: `${battleState.playerTaco.emoji} ${battleState.playerTaco.name} (Lvl ${battleState.playerTaco.level})`,
          inline: true
        },
        {
          name: 'Enemy Taco',
          value: `${battleState.enemyTaco.emoji} ${battleState.enemyTaco.name} (Lvl ${battleState.enemyTaco.level})`,
          inline: true
        },
        {
          name: 'HP Remaining',
          value: `${battleState.playerTaco.currentHp}/${battleState.playerTaco.hp}`,
          inline: true
        },
        { name: 'XP Gained', value: `✨ +${gainedXP}`, inline: true }
      )
      .setColor(0x00ff00)
      .setTimestamp()
      .setFooter({ text: 'Taco Battle System' });

    return interaction.update({ embeds: [embed], components: [] });
  }

  // Battle ended: LOSE
  if (battleState.playerTaco.currentHp <= 0) {
    activeBattles.delete(interaction.user.id);

    const embed = new EmbedBuilder()
      .setTitle('💀 Battle Defeat')
      .setDescription(
        `${interaction.user} was defeated by **${battleState.enemyTaco.name}**!`
      )
      .addFields(
        {
          name: 'Your Taco',
          value: `${battleState.playerTaco.emoji} ${battleState.playerTaco.name} (Lvl ${battleState.playerTaco.level})`,
          inline: true
        },
        {
          name: 'Enemy Taco',
          value: `${battleState.enemyTaco.emoji} ${battleState.enemyTaco.name} (Lvl ${battleState.enemyTaco.level})`,
          inline: true
        },
        {
          name: 'HP Remaining',
          value: `${Math.max(
            0,
            battleState.playerTaco.currentHp
          )}/${battleState.playerTaco.hp}`,
          inline: true
        }
      )
      .setColor(0xff0000)
      .setTimestamp()
      .setFooter({ text: 'Taco Battle System' });

    return interaction.update({ embeds: [embed], components: [] });
  }

  // Battle ongoing
  const updatedEmbed = generateBattleEmbed(battleState);
  updatedEmbed.setDescription(
    log + '\n\n' + (updatedEmbed.data.description || '')
  );

  await interaction.update({ embeds: [updatedEmbed] });
}

// --- Helper ---
function generateBattleEmbed(state) {
  const p = state.playerTaco;
  const e = state.enemyTaco;

  return new EmbedBuilder()
    .setTitle('⚔️ Taco Battle!')
    .setDescription(
      `**Your Taco:** ${p.emoji} ${p.name} (Lvl ${p.level})\n**Enemy Taco:** ${e.emoji} ${e.name} (Lvl ${e.level})`
    )
    .addFields(
      { name: `${p.emoji} Your HP`, value: `${p.currentHp}/${p.hp}`, inline: true },
      { name: `${e.emoji} Enemy HP`, value: `${e.currentHp}/${e.hp}`, inline: true },
      { name: 'Turn', value: `${state.turn}`, inline: true }
    )
    .setColor(0xff6600)
    .setFooter({ text: 'Choose your action!' });
}

function battleTurn(state, defending) {
  const playerDmg = calculateDamage(state.playerTaco, state.enemyTaco, defending);
  state.enemyTaco.currentHp -= playerDmg;

  let enemyDmg = 0;
  if (state.enemyTaco.currentHp > 0) {
    enemyDmg = calculateDamage(state.enemyTaco, state.playerTaco);
    state.playerTaco.currentHp -= enemyDmg;
  }

  state.turn += 1;
  return `You dealt **${playerDmg}** damage!\nEnemy dealt **${enemyDmg}** damage!`;
}

function calculateDamage(attacker, defender, defending = false) {
  const base = attacker.attack - defender.defense * (defending ? 0.5 : 0.3);
  const variance = Math.random() * 0.2 + 0.9;
  return Math.max(5, Math.floor(base * variance));
}
