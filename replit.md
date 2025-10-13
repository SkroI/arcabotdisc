# Taco Game Discord Bot

## Overview

This is a Discord bot game where users can collect, battle, and manage virtual tacos. Players catch wild tacos of varying rarities, engage in turn-based battles, and track their progress through a trainer profile system. The game features a collection mechanism, combat system with stats (HP, attack, defense), experience/leveling, and an economy with coins and streaks.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Bot Framework
- **Technology**: Discord.js v14 with slash commands
- **Rationale**: Discord.js is the standard library for Discord bots in Node.js, providing robust API integration and event handling. Slash commands were chosen for better UX and Discord's modern command interface.
- **Command Structure**: Modular command system where each command is a separate file in the `/commands` directory, dynamically loaded at startup. This allows for easy maintenance and scalability.

### Data Persistence
- **Storage Solution**: File-based JSON database (`game_data.json`)
- **Rationale**: For a simple game bot, file-based storage provides adequate performance without the overhead of a full database system. Easy to deploy and maintain on platforms like Replit.
- **Schema Design**: User-centric data model where each user ID maps to their game state including taco collection, coins, battle stats, and catch streak tracking.
- **Limitations**: No concurrent write protection; suitable for low-to-medium traffic. May need migration to a proper database (MongoDB, PostgreSQL) for high-scale deployments.

### Game Mechanics Architecture

#### Taco System
- **Data Structure**: Centralized taco definitions in `tacos.js` with typed properties (rarity, base stats, type categorization)
- **Instance Creation**: Factory pattern for generating taco instances with randomized stats within rarity-based ranges
- **Rarity System**: Six-tier system (common → uncommon → rare → epic → legendary → mythic) affecting catch rates, stats, and visual presentation
- **Taco Types**: 10 unique tacos with different rarities and stats:
  - Common: Classic Beef, Grilled Chicken, Garden Veggie
  - Uncommon: Baja Fish, Spicy Shrimp
  - Rare: Carnitas, Birria
  - Epic: Premium Lobster
  - Legendary: Wagyu Beef Supreme
  - Mythic: Golden Dragon Taco

#### Battle System
- **Design Pattern**: Turn-based combat with state management using Map collection for active battles
- **State Tracking**: Battle states stored in memory (non-persistent) with player/enemy taco HP tracking and turn management
- **Combat Resolution**: Damage calculation based on attack/defense stats with turn alternation until one taco's HP reaches zero
- **Actions**: Attack (deal damage), Defend (reduce damage taken), Run (escape battle)
- **Rewards**: XP and coin rewards for victories, integrated with the leveling system

#### Progression System
- **Experience & Leveling**: XP accumulation per taco with level-up mechanics that increase stats by 10% per level
- **Economy**: Coin-based rewards from battles (25-50 coins per win) and catching (10 coins per catch)
- **Streak System**: Daily catch streak tracking to encourage regular engagement
- **Stats Growth**: HP, Attack, and Defense all increase when tacos level up

### Game Commands
- **/catch** - Catch wild tacos with 1-minute cooldown. Rarity affects catch rate
- **/battle** - Battle with your most recent taco against wild enemies
- **/inventory** - View your taco collection organized by rarity
- **/profile** - View trainer stats (coins, wins, losses, catch streak)
- **/help** - Learn how to play the game

### Permission & Security
- **Access Control**: Role-based permission system available via `allowed = []` arrays in each command file
- **Design Choice**: Flexible permission model that can be enabled per-command by populating allowed role IDs
- **Cooldown Management**: Time-based cooldowns (1 minute for catch) to prevent spam and maintain game balance

### User Experience
- **Rich Embeds**: Extensive use of Discord embeds for visual presentation of game information
- **Interactive Elements**: Button-based UI for battle actions (attack, defend, flee)
- **Color Coding**: Rarity-based color schemes for visual hierarchy
- **Real-time Updates**: Battle embeds update dynamically as actions are taken

## External Dependencies

### Core Libraries
- **discord.js** (v14.11.0): Discord API wrapper for bot functionality, event handling, and slash command registration
- **dotenv**: Environment variable management for sensitive credentials (bot token, client ID, guild ID)

### Environment Variables
- `TOKEN`: Discord bot authentication token
- `ID`: Discord application/client ID for command registration
- `GUILD_ID`: Target Discord server ID for slash command deployment

### File System Dependencies
- Local JSON file storage for game data persistence (`game_data.json`)
- Command file auto-discovery from `/commands` directory
- No external database or cloud storage services currently integrated

## Recent Changes (October 12, 2025)
- Converted bot from ticket system to complete Taco game
- Implemented catch, battle, inventory, profile, and help commands
- Added taco type system with 10 unique tacos across 6 rarity tiers
- Created turn-based battle system with HP, Attack, Defense mechanics
- Added XP/leveling system with stat growth
- Implemented coin economy and catch streak tracking
- Battle system supports multiple concurrent battles (separate state per user)
