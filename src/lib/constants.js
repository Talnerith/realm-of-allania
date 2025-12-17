// Make sure map.jpg is in your /public folder!
export const MAP_IMAGE_URL = "/map.jpg";

// UPDATED: 10 Rows Total, 16 Columns.
export const GRID_ROWS = 10; 
export const GRID_COLS = 16;
export const TOTAL_REGIONS = GRID_ROWS * GRID_COLS;

export const APP_ID = 'realm-of-allania-v2'; 

// EMPTY NAMES to encourage user creativity
export const BASE_REGION_NAMES = []; 

export const RACES = ["Human", "Elf", "Dwarf", "Orc", "Halfling", "Tiefling", "Dragonborn", "Gnome"];
export const CLASSES = ["Warrior", "Mage", "Rogue", "Cleric", "Paladin", "Ranger", "Bard", "Druid"];
export const CATEGORIES = ["General", "Lore", "Characters", "Regions", "Bestiary", "Magic"];

export const isRegionPlayable = (index) => {
  const row = Math.floor(index / GRID_COLS);
  const col = index % GRID_COLS;
  
  // Logic updated to allow playability on the bottom row (Row 10)
  // Top margin: 2 rows (Standard)
  if (row < 2) return false; 
  
  // Bottom margin: REMOVED to allow the last row to be playable
  if (row >= GRID_ROWS) return false; 

  // Side margins: 2 cols (Standard)
  if (col < 2 || col > GRID_COLS - 3) return false;
  
  return true;
};

export const getRegionName = (index) => {
  // Return empty string by default so users see "Unnamed" in UI logic
  return ""; 
};