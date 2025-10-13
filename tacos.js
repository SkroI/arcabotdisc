export const tacoTypes = {
  CLASSIC: {
    name: 'Classic Beef Taco',
    emoji: '🌮',
    rarity: 'common',
    baseStats: { hp: 50, attack: 45, defense: 40 },
    type: 'Meaty'
  },
  CHICKEN: {
    name: 'Grilled Chicken Taco',
    emoji: '🌮',
    rarity: 'common',
    baseStats: { hp: 55, attack: 42, defense: 45 },
    type: 'Meaty'
  },
  FISH: {
    name: 'Baja Fish Taco',
    emoji: '🐟',
    rarity: 'uncommon',
    baseStats: { hp: 60, attack: 50, defense: 35 },
    type: 'Seafood'
  },
  SHRIMP: {
    name: 'Spicy Shrimp Taco',
    emoji: '🦐',
    rarity: 'uncommon',
    baseStats: { hp: 58, attack: 55, defense: 38 },
    type: 'Seafood'
  },
  VEGGIE: {
    name: 'Garden Veggie Taco',
    emoji: '🥬',
    rarity: 'common',
    baseStats: { hp: 65, attack: 35, defense: 50 },
    type: 'Veggie'
  },
  CARNITAS: {
    name: 'Slow-Cooked Carnitas Taco',
    emoji: '🥩',
    rarity: 'rare',
    baseStats: { hp: 70, attack: 60, defense: 45 },
    type: 'Meaty'
  },
  BIRRIA: {
    name: 'Legendary Birria Taco',
    emoji: '🔥',
    rarity: 'rare',
    baseStats: { hp: 75, attack: 65, defense: 50 },
    type: 'Meaty'
  },
  LOBSTER: {
    name: 'Premium Lobster Taco',
    emoji: '🦞',
    rarity: 'epic',
    baseStats: { hp: 80, attack: 70, defense: 60 },
    type: 'Seafood'
  },
  WAGYU: {
    name: 'Wagyu Beef Taco Supreme',
    emoji: '👑',
    rarity: 'legendary',
    baseStats: { hp: 100, attack: 85, defense: 75 },
    type: 'Meaty'
  },
  GOLD: {
    name: 'Golden Dragon Taco',
    emoji: '✨',
    rarity: 'mythic',
    baseStats: { hp: 120, attack: 100, defense: 90 },
    type: 'Mythical'
  }
};

export const rarityChances = {
  common: 50,
  uncommon: 30,
  rare: 15,
  epic: 4,
  legendary: 0.9,
  mythic: 0.1
};

export const rarityColors = {
  common: 0x808080,
  uncommon: 0x00FF00,
  rare: 0x0099FF,
  epic: 0x9B59B6,
  legendary: 0xFFD700,
  mythic: 0xFF00FF
};

export function getRandomTaco() {
  const rand = Math.random() * 100;
  let cumulative = 0;
  let selectedRarity = 'common';

  for (const [rarity, chance] of Object.entries(rarityChances)) {
    cumulative += chance;
    if (rand <= cumulative) {
      selectedRarity = rarity;
      break;
    }
  }

  const tacosOfRarity = Object.entries(tacoTypes).filter(
    ([_, taco]) => taco.rarity === selectedRarity
  );

  const randomTaco = tacosOfRarity[Math.floor(Math.random() * tacosOfRarity.length)];
  return { id: randomTaco[0], ...randomTaco[1] };
}

export function createTacoInstance(tacoData, level = 1) {
  const levelMultiplier = 1 + (level - 1) * 0.1;
  return {
    id: tacoData.id,
    name: tacoData.name,
    emoji: tacoData.emoji,
    rarity: tacoData.rarity,
    type: tacoData.type,
    level: level,
    hp: Math.floor(tacoData.baseStats.hp * levelMultiplier),
    maxHp: Math.floor(tacoData.baseStats.hp * levelMultiplier),
    attack: Math.floor(tacoData.baseStats.attack * levelMultiplier),
    defense: Math.floor(tacoData.baseStats.defense * levelMultiplier),
    xp: 0,
    xpToNextLevel: level * 100
  };
}
