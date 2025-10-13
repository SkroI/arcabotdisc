import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} from 'discord.js';
import { getUser } from '../database.js';

export const activeDuels = new Map();
export const allowed = [];

export const data = new SlashCommandBuilder()
  .setName('duel')
  .setDescription('Challenge another player to a taco duel!')
  .addUserOption(option =>
    option.setName('target')
      .setDescription('Who do you want to duel?')
      .setRequired(true)
  );

// Execute command
export async function execute(interaction, client) {
  if (allowed.length > 0) {
    const roles = interaction.member.roles.cache.map(r => r.id);
    if (!allowed.some(rid => roles.includes(rid))) {
      return interaction.reply({ content: '❌ You do not have permission.', ephemeral: true });
    }
  }

  const targetUser = interaction.options.getUser('target');
  if (targetUser.id === interaction.user.id)
    return interaction.reply({ content: '❌ You cannot duel yourself.', ephemeral: true });

  if (activeDuels.has(interaction.user.id) || activeDuels.has(targetUser.id)) {
    return interaction.reply({ content: '⚠️ Either you or your target is already in a duel.', ephemeral: true });
  }

  // Duel state
  const duelState = {
    channel: interaction.channel,
    players: {
      [interaction.user.id]: null,
      [targetUser.id]: null,
    },
    turnOrder: [interaction.user.id, targetUser.id],
    currentTurn: 0,
    finished: false,
    client,
  };

  activeDuels.set(interaction.user.id, duelState);
  activeDuels.set(targetUser.id, duelState);

  // DM taco selection
  for (const playerId of [interaction.user.id, targetUser.id]) {
    const user = getUser(playerId);
    const tacoOptions = user.tacos.map((taco, idx) => ({
      label: `${taco.name} (Lvl ${taco.level})`,
      value: `${idx}`,
      description: `HP:${taco.hp}, ATK:${taco.attack}, DEF:${taco.defense}`,
      emoji: taco.emoji,
    }));

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`duel_select_${playerId}`)
      .setPlaceholder('Select your taco')
      .addOptions(tacoOptions);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const discordUser = await client.users.fetch(playerId);
    await discordUser.send({
      content: '⚔️ Select your taco for the duel!',
      components: [row],
    });
  }

  return interaction.reply({
    content: `📣 ${interaction.user} has challenged ${targetUser} to a duel! Both players, check your DMs to select a taco.`,
    ephemeral: false,
  });
}

// Handle taco selection
export async function handleSelect(interaction) {
  const duelState = activeDuels.get(interaction.user.id);
  if (!duelState) return interaction.reply({ content: '❌ Duel not found.', ephemeral: true });

  const selectedIndex = parseInt(interaction.values[0], 10);
  const user = getUser(interaction.user.id);
  duelState.players[interaction.user.id] = { ...user.tacos[selectedIndex], currentHp: user.tacos[selectedIndex].hp };

  await interaction.update({ content: '✅ Taco selected!', components: [], ephemeral: true });

  if (Object.values(duelState.players).every(p => p !== null)) {
    startDuel(duelState);
  }
}

// Start duel
async function startDuel(duelState) {
  const { channel, turnOrder } = duelState;
  const embed = generateDuelEmbed(duelState, `Both players have selected their tacos! <@${turnOrder[0]}> goes first.`);
  const buttons = battleButtons(turnOrder[duelState.currentTurn]);
  duelState.message = await channel.send({ embeds: [embed], components: [buttons] });
}

// Generate buttons
function battleButtons(currentPlayerId) {
  const attack = new ButtonBuilder().setCustomId('duel_attack').setLabel('Attack').setStyle(ButtonStyle.Danger).setEmoji('⚔️');
  const defend = new ButtonBuilder().setCustomId('duel_defend').setLabel('Defend').setStyle(ButtonStyle.Primary).setEmoji('🛡️');
  return new ActionRowBuilder().addComponents(attack, defend);
}

// Handle fight button
export async function handleFightButton(interaction) {
  const duelState = activeDuels.get(interaction.user.id);
  if (!duelState || duelState.finished) return interaction.update({ content: '❌ Duel ended.', components: [], embeds: [] });

  const currentPlayerId = duelState.turnOrder[duelState.currentTurn];
  const opponentId = duelState.turnOrder[(duelState.currentTurn + 1) % 2];

  if (interaction.user.id !== currentPlayerId) {
    return interaction.reply({ content: '⚠️ It is not your turn!', ephemeral: true });
  }

  const player = duelState.players[currentPlayerId];
  const opponent = duelState.players[opponentId];

  let log = '';
  if (interaction.customId === 'duel_attack') {
    const damage = Math.max(5, Math.floor(player.attack - opponent.defense * 0.2));
    opponent.currentHp -= damage;
    log = `<@${currentPlayerId}> attacked and dealt **${damage}** damage to <@${opponentId}>!`;
  } else if (interaction.customId === 'duel_defend') {
    log = `<@${currentPlayerId}> defended and will take reduced damage next turn!`;
    player.defending = true;
  }

  // Switch turn
  duelState.currentTurn = (duelState.currentTurn + 1) % 2;

  // Check if duel ends
  let winner = null;
  if (player.currentHp <= 0) winner = opponentId;
  if (opponent.currentHp <= 0) winner = currentPlayerId;

  const embed = generateDuelEmbed(duelState, log);

  if (winner) {
    duelState.finished = true;
    activeDuels.delete(duelState.turnOrder[0]);
    activeDuels.delete(duelState.turnOrder[1]);

    embed.setTitle('🏆 Duel Finished!');
    embed.setDescription(`<@${winner}> won the duel! 🎉`);
    embed.setColor(0x00FF00);
    await duelState.message.edit({ embeds: [embed], components: [] });
  } else {
    const buttons = battleButtons(duelState.turnOrder[duelState.currentTurn]);
    await duelState.message.edit({ embeds: [embed], components: [buttons] });
  }

  await interaction.deferUpdate();
}

// Generate embed
function generateDuelEmbed(duelState, description) {
  const [p1Id, p2Id] = duelState.turnOrder;
  const p1 = duelState.players[p1Id];
  const p2 = duelState.players[p2Id];

  return new EmbedBuilder()
    .setTitle('⚔️ Player vs Player Taco Duel')
    .setDescription(description)
    .addFields(
      { name: 'Player 1', value: `${p1.emoji} ${p1.name} - HP: ${Math.max(0, p1.currentHp)}`, inline: true },
      { name: 'Player 2', value: `${p2.emoji} ${p2.name} - HP: ${Math.max(0, p2.currentHp)}`, inline: true },
      { name: 'Turn', value: `<@${duelState.turnOrder[duelState.currentTurn]}>`, inline: true }
    )
    .setColor(0xFFAA00);
}
