// Make sure map.jpg is in your /public folder!
export const MAP_IMAGE_URL = "/map.jpg";

export const GRID_ROWS = 12;
export const GRID_COLS = 20;
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
  if (row < 2 || row > GRID_ROWS - 3) return false;
  if (col < 2 || col > GRID_COLS - 3) return false;
  return true;
};

export const getRegionName = (index) => {
  // Return empty string by default so users see "Unnamed" in UI logic
  return ""; 
};