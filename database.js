import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'game_data.json');

export function loadDatabase() {
  if (!fs.existsSync(dbPath)) {
    return { users: {} };
  }
  try {
    const data = fs.readFileSync(dbPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error loading database:', error);
    return { users: {} };
  }
}

export function saveDatabase(data) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error saving database:', error);
  }
}

export function getUser(userId) {
  const db = loadDatabase();
  if (!db.users[userId]) {
    db.users[userId] = {
      tacos: [],
      coins: 100,
      catchStreak: 0,
      lastCatch: null,
      battleWins: 0,
      battleLosses: 0,
      xp: 0,
      level: 1
    };
    saveDatabase(db);
  }
  return db.users[userId];
}

export function updateUser(userId, userData) {
  const db = loadDatabase();
  db.users[userId] = userData;
  saveDatabase(db);
}
