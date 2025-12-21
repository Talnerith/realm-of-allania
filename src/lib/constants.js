// Make sure map.jpg is in your /public folder!
export const MAP_IMAGE_URL = "/map.jpg";

// 20 Cols to preserve alignment. 13 Rows for height.
export const GRID_ROWS = 13; 
export const GRID_COLS = 20;
export const TOTAL_REGIONS = GRID_ROWS * GRID_COLS;

export const APP_ID = 'realm-of-allania-v2'; 

export const BASE_REGION_NAMES = []; 

export const RACES = [
  "Human",
  "Elf",
  "Dwarf",
  "Orc / Half-Orc",
  "Halfling / Gnome",
  "Dragonborn / Draconic",
  "Beastfolk",
  "Elemental / Planetouched",
  "Arbori / Treant"
];

export const CLASSES = [
  "Warrior / Fighter",
  "Wizard / Mage",
  "Cleric / Priest",
  "Rogue / Thief",
  "Ranger / Hunter",
  "Bard",
  "Druid",
  "Paladin",
  "Warlock",
  "Monk",
  "Alchemist / Tinker"
];

export const CATEGORIES = [
  "Characters",
  "Locations",
  "Organizations",
  "Species",
  "History",
  "Magic and Powers",
  "Quests/Story Arcs",
  "Items and Equipment",
  "Culture and Society",
  "In-Character Journals",
  "OOC Notes/Guides",
  "Character Resources"
];

export const isRegionPlayable = (index) => {
  const row = Math.floor(index / GRID_COLS);
  const col = index % GRID_COLS;
  
  // 1. Header (Top 2 Rows) - Unplayable
  if (row < 2) return false;

  // 2. Footer Logic (UPDATED)
  // GRID_ROWS is 13 (Indices 0-12).
  // Playable Rows: 2-11. Row 12 is footer.
  if (row > GRID_ROWS - 2) return false; 

  // 3. Side Margins (Left/Right 2 Cols) - Unplayable
  if (col < 2 || col > GRID_COLS - 3) return false;
  
  return true;
};

export const getRegionName = (index) => {
  return ""; 
};