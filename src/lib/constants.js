// Make sure map.jpg is in your /public folder!
export const MAP_IMAGE_URL = "/map.jpg";

// 20 Cols to preserve alignment. 13 Rows for height.
export const GRID_ROWS = 13; 
export const GRID_COLS = 20;
export const TOTAL_REGIONS = GRID_ROWS * GRID_COLS;

export const APP_ID = 'realm-of-allania-v2'; 

export const BASE_REGION_NAMES = []; 

export const RACES = ["Human", "Elf", "Dwarf", "Orc", "Halfling", "Tiefling", "Dragonborn", "Gnome"];
export const CLASSES = ["Warrior", "Mage", "Rogue", "Cleric", "Paladin", "Ranger", "Bard", "Druid"];
export const CATEGORIES = ["General", "Lore", "Characters", "Regions", "Bestiary", "Magic"];

export const isRegionPlayable = (index) => {
  const row = Math.floor(index / GRID_COLS);
  const col = index % GRID_COLS;
  
  // 1. Header (Top 2 Rows) - Unplayable
  if (row < 2) return false;

  // 2. Footer Logic (UPDATED)
  // GRID_ROWS is 13 (Indices 0-12).
  // previously: > 10 (Excluded 11, 12).
  // NOW: > 11. This means Row 11 is PLAYABLE. Only Row 12 is unplayable.
  // Playable Rows: 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 (Total 10 Rows)
  if (row > GRID_ROWS - 2) return false; 

  // 3. Side Margins (Left/Right 2 Cols) - Unplayable
  if (col < 2 || col > GRID_COLS - 3) return false;
  
  return true;
};

export const getRegionName = (index) => {
  return ""; 
};