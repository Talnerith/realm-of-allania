// Make sure map.jpg is in your /public folder!
export const MAP_IMAGE_URL = "/map.jpg";

// REVERTED: Kept at 20 Columns to fix the "Moving Regions" bug.
// Kept at 13 Rows to ensure we have the extra space at the bottom you requested.
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

  // 2. Footer (Bottom 2 Rows) - Unplayable
  // This leaves Row 10 open for playing if the total is 13 (Rows 0-12)
  if (row > GRID_ROWS - 3) return false;

  // 3. Side Margins (Left/Right 2 Cols) - Unplayable
  if (col < 2 || col > GRID_COLS - 3) return false;
  
  return true;
};

export const getRegionName = (index) => {
  return ""; 
};