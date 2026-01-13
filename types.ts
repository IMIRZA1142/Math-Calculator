
export interface Vector2 {
  x: number;
  y: number;
}

export interface Entity {
  id: string;
  position: Vector2;
  velocity: Vector2;
  radius: number;
  color: string;
}

export interface Player extends Entity {
  hp: number;
  maxHp: number;
  speed: number;
  name?: string;
  ammo: number;
}

export interface RemotePlayer {
  id: string;
  position: Vector2;
  velocity: Vector2;
  color: string;
  name?: string;
  hp: number;
  kills: number;
}

export interface Enemy extends Entity {
  hp: number;
  speed: number;
  value: number;
}

export interface Bullet extends Entity {
  damage: number;
  ownerId?: string; // To track who shot whom
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
}

export interface Wall {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isLow?: boolean; // If true, blocks movement but allows shooting/vision
}

export interface Decoration {
  id: string;
  x: number;
  y: number;
  type: 'CACTUS';
  scale: number;
  rotation: number;
  radius: number; // For collision
}

export interface HealthPack extends Entity {
    active: boolean;
}

export interface LevelConfig {
  themeName: string;
  missionDescription: string;
  enemyColor: string;
  enemySpeed: number; // 1-5
  enemySpawnRate: number; // ms
  playerColor: string;
  playerSpeed: number;
  bulletColor: string;
  backgroundColor: string;
}

export enum GameState {
  MENU = 'MENU',
  LOBBY = 'LOBBY',
  LOADING = 'LOADING',
  PLAYING = 'PLAYING',
  SPECTATING = 'SPECTATING', // New state for death camera
  GAME_OVER = 'GAME_OVER',
  LEADERBOARD = 'LEADERBOARD' // New state for end of match summary
}
