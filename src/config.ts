// Zentrale Balance- und Stil-Konstanten. Alles Tuning passiert hier.

export const TILE = 16;
export const MAP_W = 48;
export const MAP_H = 36;
export const MAX_POP = 40;

export type Faction = 'player' | 'enemy';
export type Difficulty = 'easy' | 'normal' | 'hard';

/** Gedämpfte, erdige Palette — "nicht zu bunt". */
export const PAL = {
  bg: '#101216',
  grass: ['#3f4f35', '#46573a', '#3a4931', '#4b5c3e'],
  grassDot: '#55684a',
  dirt: '#5e5140',
  water: '#27404f',
  waterLight: '#33546a',
  waterFoam: '#4c6f82',
  rock: '#55585e',
  rockLight: '#6b6e74',
  rockDark: '#3d3f44',
  treeDark: '#24371f',
  treeMid: '#2f4728',
  treeLight: '#3d5a32',
  trunk: '#46331f',
  gold: '#d6a443',
  goldDark: '#8f6a25',
  stone: '#7d7a72',
  stoneDark: '#5a574f',
  wood: '#6e5034',
  woodDark: '#4a3523',
  skin: '#d6b08a',
  steel: '#a7adb5',
  steelDark: '#6d737b',
  shadow: 'rgba(0,0,0,0.35)',
  fog: '#0b0d10',
  team: {
    player: { main: '#5b8fbf', dark: '#3a6185', light: '#8bb6dc' },
    enemy: { main: '#b5523b', dark: '#7c3426', light: '#d98068' },
  },
} as const;

export const hex = (c: string): number => parseInt(c.slice(1), 16);

export type UnitKind = 'worker' | 'footman' | 'archer';
export type BuildingKind = 'hall' | 'farm' | 'barracks' | 'tower';

export interface Cost {
  gold: number;
  wood: number;
}

export interface UnitStats {
  name: string;
  hp: number;
  armor: number;
  dmg: number;
  range: number; // in Tiles, Abstand Rand-zu-Rand
  cooldown: number; // s
  speed: number; // px/s
  sight: number; // Tiles
  cost: Cost;
  time: number; // s
}

export const UNITS: Record<UnitKind, UnitStats> = {
  worker: { name: 'Arbeiter', hp: 30, armor: 0, dmg: 3, range: 0.4, cooldown: 1.2, speed: 42, sight: 5, cost: { gold: 50, wood: 0 }, time: 9 },
  footman: { name: 'Krieger', hp: 75, armor: 2, dmg: 8, range: 0.4, cooldown: 1.0, speed: 38, sight: 6, cost: { gold: 90, wood: 0 }, time: 13 },
  archer: { name: 'Schütze', hp: 40, armor: 0, dmg: 6, range: 4.5, cooldown: 1.4, speed: 42, sight: 7, cost: { gold: 60, wood: 30 }, time: 13 },
};

export interface BuildingStats {
  name: string;
  size: number; // Tiles (quadratisch)
  hp: number;
  armor: number;
  cost: Cost;
  time: number;
  supply: number;
  sight: number;
  trains: UnitKind[];
  attack?: { dmg: number; range: number; cooldown: number };
}

export const BUILDINGS: Record<BuildingKind, BuildingStats> = {
  hall: { name: 'Rathaus', size: 3, hp: 1200, armor: 4, cost: { gold: 300, wood: 200 }, time: 60, supply: 5, sight: 7, trains: ['worker'] },
  farm: { name: 'Farm', size: 2, hp: 300, armor: 1, cost: { gold: 60, wood: 40 }, time: 18, supply: 5, sight: 3, trains: [] },
  barracks: { name: 'Kaserne', size: 3, hp: 650, armor: 2, cost: { gold: 150, wood: 80 }, time: 32, supply: 0, sight: 4, trains: ['footman', 'archer'] },
  tower: { name: 'Turm', size: 2, hp: 450, armor: 3, cost: { gold: 100, wood: 80 }, time: 28, supply: 0, sight: 8, trains: [], attack: { dmg: 7, range: 5.5, cooldown: 1.5 } },
};

export const GATHER = {
  goldPerTrip: 8,
  woodPerTrip: 8,
  mineTime: 2.4,
  chopTime: 2.6,
  treeWood: 40,
  mineGold: 4000,
};

export const START = { gold: 350, wood: 150, workers: 4 };

export interface AiProfile {
  gatherMul: number;
  workerTarget: number;
  firstWaveAt: number; // s
  waveSize: number;
  waveGrowth: number;
  towers: number;
  barracks: number;
  thinkEvery: number;
}

export const AI: Record<Difficulty, AiProfile> = {
  easy: { gatherMul: 0.75, workerTarget: 6, firstWaveAt: 330, waveSize: 3, waveGrowth: 1, towers: 0, barracks: 1, thinkEvery: 2 },
  normal: { gatherMul: 1, workerTarget: 9, firstWaveAt: 220, waveSize: 5, waveGrowth: 2, towers: 1, barracks: 1, thinkEvery: 1.2 },
  hard: { gatherMul: 1.25, workerTarget: 12, firstWaveAt: 160, waveSize: 6, waveGrowth: 3, towers: 2, barracks: 2, thinkEvery: 0.8 },
};
