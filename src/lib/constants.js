// Make sure map.jpg is in your /public folder!
export const MAP_IMAGE_URL = "/map.jpg";

export const GRID_ROWS = 12;
export const GRID_COLS = 20;
export const TOTAL_REGIONS = GRID_ROWS * GRID_COLS;

// The "Default" App ID for Firestore. 
export const APP_ID = 'default-app-id'; 

export const BASE_REGION_NAMES = [
  "Outer Void", "Table's Edge", "North Sea", "Frozen Waste", "Ice Floe", "Glacial Drift", "Northern Expanse", "Storm Front", "Mist Barrier", "Endless Horizon", "Far Reach", "Void", "Deep North", "Leviathan's Run", "Siren's Call", "Kraken's Deep", "Glacial Bay", "High Peak", "Dragon's Roost", "Wyrmtail Valley",
  "Eastern Steppes", "Nomad's End", "Corsair's Coast", "Eastern Void", "Western Deep", "Iron Tide Bay", "Sunken Ruins", "Pearl Shoals", "Mistcloak Marsh", "Elderwood", "Titan's Spine", "Gryphon's Nest", "Verdant Glades", "River of Tears", "The Scar", "Eastern Edge", "Sea of Storms", "Stormbreaker Isle", "Coral Fortress", "Salt Flats",
  "The Black Bog", "Heart of Aethelraed", "King's Road", "Golden Fields", "Whispering Woods", "Silent Lake", "Shadow's Edge", "Edge of World", "Abyssal Trench", "Serpent's Coil", "Wreckers' Reef", "Merchant's Bay", "Trade Route Alpha", "Silver City", "Iron Mines", "Goblin Gap", "Feywild Border", "Rotting Swamp", "Deadlands", "Far East",
  "Triton's Domain", "Deep Ocean", "Leviathan's Maw", "Lost Archipelago", "Southern Cape", "Fertile Crescent", "Halfling Hills", "Dwarven Hold", "Hydrothermal Vents", "Smoldering Sea", "Demon's Gate", "Outer Rim", "Azure Depths", "Sargasso Drifts", "Radiant Reef", "Dune Sea", "Scorpion's Den", "Canyon of Winds", "Thunder Plateau", "Kelp Forest",
  "Coral Gardens", "Sunken Shrine", "Drowned City", "Southern Void", "Table's End", "South Pole", "Eternal Ice", "Southern Wall", "White Waste", "Penguin's Rock", "Frozen Sea", "Iceberg Alley", "Cold Front", "Last Outpost", "Final Frontier", "Game Over"
];

// Lists for Character Creation & Codex
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
  if (index < BASE_REGION_NAMES.length) return BASE_REGION_NAMES[index];
  return `Realm ${index + 1}`; 
};