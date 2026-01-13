import React, { useEffect, useRef, useCallback, useState } from 'react';
import { GameState, LevelConfig, Player, Enemy, Bullet, Particle, Vector2, RemotePlayer, Wall, Entity, HealthPack, Decoration } from '../types';
import { soundService } from '../services/soundService';

interface GameCanvasProps {
  gameState: GameState;
  levelConfig: LevelConfig;
  setScore: (score: number) => void;
  setHealth: (hp: number) => void;
  setAmmo?: (ammo: number) => void;
  onGameOver: (killerId?: string) => void;
  onPlayerUpdate?: (position: Vector2) => void;
  onKill?: () => void;
  onRoundEnd?: () => void;
  remotePlayers?: RemotePlayer[];
  currentMap: string;
  playerName: string;
  spectatorTargetId: string | null;
  isMultiplayer?: boolean;
}

const GameCanvas: React.FC<GameCanvasProps> = (props) => {
  const { 
    gameState, 
    levelConfig, 
    setScore, 
    setHealth,
    setAmmo, 
    onGameOver,
    onPlayerUpdate,
    onKill,
    onRoundEnd,
    remotePlayers = [],
    currentMap,
    playerName,
    spectatorTargetId,
    isMultiplayer = false
  } = props;

  // Ref to hold latest props to avoid stale closures in the game loop
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  });

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number>(0);
  const wastelandImageRef = useRef<HTMLImageElement | null>(null);
  
  // Game State Refs (Mutable for performance)
  const playerRef = useRef<Player>({
    id: 'player',
    position: { x: 0, y: 0 },
    velocity: { x: 0, y: 0 },
    radius: 15,
    color: levelConfig.playerColor,
    hp: 100,
    maxHp: 100,
    speed: levelConfig.playerSpeed,
    name: playerName,
    ammo: 120
  });

  const enemiesRef = useRef<Enemy[]>([]);
  const bulletsRef = useRef<Bullet[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const wallsRef = useRef<Wall[]>([]);
  const healthPacksRef = useRef<HealthPack[]>([]);
  const decorationsRef = useRef<Decoration[]>([]);
  
  const scoreRef = useRef(0);
  const lastSpawnTimeRef = useRef(0);
  const lastHealthPackTimeRef = useRef(0);
  const lastUpdateEmitRef = useRef(0);
  const lastCactusDamageTimeRef = useRef(0);
  
  // Input State
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const mouseRef = useRef<Vector2>({ x: 0, y: 0 }); // Screen coordinates
  const isMouseDownRef = useRef(false);
  const lastShotTimeRef = useRef(0);

  // Constants
  const FIRE_RATE = 500; // 0.5 seconds
  const HEALTH_PACK_INTERVAL = 30000; // 30 seconds

  // Utility: Circle vs Rectangle Collision Resolution
  const resolveWallCollision = (entity: Entity, wall: Wall) => {
    // Find the closest point on the rectangle to the circle center
    const closestX = Math.max(wall.x, Math.min(entity.position.x, wall.x + wall.width));
    const closestY = Math.max(wall.y, Math.min(entity.position.y, wall.y + wall.height));

    const dx = entity.position.x - closestX;
    const dy = entity.position.y - closestY;
    const distanceSquared = dx * dx + dy * dy;

    // Check collision
    if (distanceSquared < entity.radius * entity.radius && distanceSquared > 0) {
        const distance = Math.sqrt(distanceSquared);
        const overlap = entity.radius - distance;

        // Normal vector
        const nx = dx / distance;
        const ny = dy / distance;

        // Push entity out
        entity.position.x += nx * overlap;
        entity.position.y += ny * overlap;
    }
  };

  // Utility: Circle vs Circle Collision Resolution (For Cacti)
  // Returns true if collision occurred
  const resolveDecorationCollision = (entity: Entity, decor: Decoration): boolean => {
      // Simple circle collision
      const dx = entity.position.x - decor.x;
      const dy = entity.position.y - decor.y;
      const distSq = dx*dx + dy*dy;
      const minRadius = entity.radius + decor.radius;
      
      if (distSq < minRadius * minRadius && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const overlap = minRadius - dist;
          
          // Push out
          const nx = dx / dist;
          const ny = dy / dist;
          
          entity.position.x += nx * overlap;
          entity.position.y += ny * overlap;
          return true;
      }
      return false;
  };

  const checkBulletWallCollision = (bullet: Bullet, wall: Wall): boolean => {
    // Bullets fly over low walls (Cover)
    if (wall.isLow) return false;

    const closestX = Math.max(wall.x, Math.min(bullet.position.x, wall.x + wall.width));
    const closestY = Math.max(wall.y, Math.min(bullet.position.y, wall.y + wall.height));
    const dx = bullet.position.x - closestX;
    const dy = bullet.position.y - closestY;
    return (dx * dx + dy * dy) < (bullet.radius * bullet.radius);
  };

  // Raycasting Logic
  type Intersection = { x: number; y: number; param: number } | null;

  const getIntersection = (rayStart: Vector2, rayEnd: Vector2, segmentStart: Vector2, segmentEnd: Vector2): Intersection => {
      // Ray: r_px + r_dx * T
      // Segment: s_px + s_dx * U
      const r_px = rayStart.x;
      const r_py = rayStart.y;
      const r_dx = rayEnd.x - rayStart.x;
      const r_dy = rayEnd.y - rayStart.y;

      const s_px = segmentStart.x;
      const s_py = segmentStart.y;
      const s_dx = segmentEnd.x - segmentStart.x;
      const s_dy = segmentEnd.y - segmentStart.y;

      const r_mag = Math.sqrt(r_dx * r_dx + r_dy * r_dy);
      const s_mag = Math.sqrt(s_dx * s_dx + s_dy * s_dy);

      if (r_mag * s_mag === 0) return null;
 
      const denominator = r_dx * s_dy - r_dy * s_dx;
      if (denominator === 0) return null; // Parallel

      const t = ((s_px - r_px) * s_dy - (s_py - r_py) * s_dx) / denominator;
      const u = ((s_px - r_px) * r_dy - (s_py - r_py) * r_dx) / denominator;

      if (t > 0 && t <= 1 && u >= 0 && u <= 1) {
          return {
              x: r_px + t * r_dx,
              y: r_py + t * r_dy,
              param: t
          };
      }
      return null;
  };

  // --- MAP GENERATORS ---

  const generateErindaleLayout = (): Wall[] => {
      const walls: Wall[] = [];
      const add = (x: number, y: number, w: number, h: number, isLow: boolean = false) => {
          walls.push({ id: `w-${walls.length}`, x, y, width: w, height: h, isLow });
      };

      const BOUND_SIZE = 1200; 
      const WALL_THICK = 50;
      const CENTER_OPEN_SIZE = 350; 
      
      // 1. Boundaries
      add(-BOUND_SIZE, -BOUND_SIZE, BOUND_SIZE*2, WALL_THICK); // Top
      add(-BOUND_SIZE, BOUND_SIZE - WALL_THICK, BOUND_SIZE*2, WALL_THICK); // Bottom
      add(-BOUND_SIZE, -BOUND_SIZE, WALL_THICK, BOUND_SIZE*2); // Left
      add(BOUND_SIZE - WALL_THICK, -BOUND_SIZE, WALL_THICK, BOUND_SIZE*2); // Right

      // 2. Corner Room Dividers (WITH GAPS/DOORS)
      const DOOR_SIZE = 220; 
      const addWallWithGap = (x: number, y: number, w: number, h: number, isVertical: boolean) => {
          if (isVertical) {
             const segmentH = (h - DOOR_SIZE) / 2;
             add(x, y, w, segmentH); // Top part
             add(x, y + segmentH + DOOR_SIZE, w, h - (segmentH + DOOR_SIZE)); // Bottom part
          } else {
             const segmentW = (w - DOOR_SIZE) / 2;
             add(x, y, segmentW, h); // Left part
             add(x + segmentW + DOOR_SIZE, y, w - (segmentW + DOOR_SIZE), h); // Right part
          }
      };

      // NW Room
      addWallWithGap(-CENTER_OPEN_SIZE - WALL_THICK, -BOUND_SIZE, WALL_THICK, BOUND_SIZE - CENTER_OPEN_SIZE, true);
      addWallWithGap(-BOUND_SIZE, -CENTER_OPEN_SIZE - WALL_THICK, BOUND_SIZE - CENTER_OPEN_SIZE, WALL_THICK, false);
      // NE Room
      addWallWithGap(CENTER_OPEN_SIZE, -BOUND_SIZE, WALL_THICK, BOUND_SIZE - CENTER_OPEN_SIZE, true);
      addWallWithGap(CENTER_OPEN_SIZE, -CENTER_OPEN_SIZE - WALL_THICK, BOUND_SIZE - CENTER_OPEN_SIZE, WALL_THICK, false);
      // SW Room
      addWallWithGap(-CENTER_OPEN_SIZE - WALL_THICK, CENTER_OPEN_SIZE, WALL_THICK, BOUND_SIZE - CENTER_OPEN_SIZE, true);
      addWallWithGap(-BOUND_SIZE, CENTER_OPEN_SIZE, BOUND_SIZE - CENTER_OPEN_SIZE, WALL_THICK, false);
      // SE Room
      addWallWithGap(CENTER_OPEN_SIZE, CENTER_OPEN_SIZE, WALL_THICK, BOUND_SIZE - CENTER_OPEN_SIZE, true);
      addWallWithGap(CENTER_OPEN_SIZE, CENTER_OPEN_SIZE, BOUND_SIZE - CENTER_OPEN_SIZE, WALL_THICK, false);

      // 3. Hallway Spines
      const spineLen = 450;
      const spineOffset = 600; 
      add(-20, -spineOffset - spineLen/2, 40, spineLen); // N
      add(-20, spineOffset - spineLen/2, 40, spineLen); // S
      add(-spineOffset - spineLen/2, -20, spineLen, 40); // W
      add(spineOffset - spineLen/2, -20, spineLen, 40); // E

      // 4. Central Ruins
      add(-70, -70, 140, 140, true); 

      // 5. Random Obstacles
      const numObstacles = 76;
      for(let i=0; i<numObstacles; i++) {
          const x = (Math.random() * 2 - 1) * (BOUND_SIZE - 100);
          const y = (Math.random() * 2 - 1) * (BOUND_SIZE - 100);
          
          if (Math.sqrt(x*x + y*y) < 350) continue;

          let overlap = false;
          for(const w of walls) {
             if (x < w.x + w.width + 80 && x + 80 > w.x - 80 &&
                 y < w.y + w.height + 80 && y + 80 > w.y - 80) {
                 overlap = true;
                 break;
             }
          }
          if (overlap) continue;

          const isBush = Math.random() > 0.6;
          if (isBush) {
              add(x, y, 60 + Math.random() * 60, 40 + Math.random() * 40, true);
          } else {
              add(x, y, 80 + Math.random() * 50, 80 + Math.random() * 50, false);
          }
      }

      return walls;
  };

  const generateWastelandLayout = (): Wall[] => {
      const walls: Wall[] = [];
      const add = (x: number, y: number, w: number, h: number, isLow: boolean = false) => {
          walls.push({ id: `w-${walls.length}`, x, y, width: w, height: h, isLow });
      };

      // Portrait Orientation Map based on image
      const MAP_W = 1600;
      const MAP_H = 2000;
      const WALL_THICK = 100;

      // 1. Boundaries
      add(-MAP_W/2 - WALL_THICK, -MAP_H/2 - WALL_THICK, MAP_W + WALL_THICK*2, WALL_THICK); // Top
      add(-MAP_W/2 - WALL_THICK, MAP_H/2, MAP_W + WALL_THICK*2, WALL_THICK); // Bottom
      add(-MAP_W/2 - WALL_THICK, -MAP_H/2, WALL_THICK, MAP_H); // Left
      add(MAP_W/2, -MAP_H/2, WALL_THICK, MAP_H); // Right

      // 2. Central Arena Feature
      const PILLAR_SIZE = 40;
      const ARENA_RAD = 300;
      for(let i=0; i<8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          add(
              Math.cos(angle) * ARENA_RAD - PILLAR_SIZE/2, 
              Math.sin(angle) * ARENA_RAD - PILLAR_SIZE/2, 
              PILLAR_SIZE, PILLAR_SIZE, true
          );
      }

      // 3. Side Buildings
      const STREET_WIDTH = 600; 
      const BUILDING_DEPTH = 250; 
      
      const leftX = -STREET_WIDTH/2 - BUILDING_DEPTH;
      // Top Left Corner
      add(leftX, -900, BUILDING_DEPTH, 400); 
      // Bottom Left Corner
      add(leftX, 500, BUILDING_DEPTH, 400);

      const rightX = STREET_WIDTH/2;
      // Top Right Corner
      add(rightX, -900, BUILDING_DEPTH, 400);
      // Bottom Right Corner
      add(rightX, 500, BUILDING_DEPTH, 400);

      // 4. North/South Gates
      add(-150, -850, 300, 50, true); // Gate North
      add(-150, 800, 300, 50, true); // Gate South

      // 5. Scattered Crates (SOLID OBSTACLES)
      for(let i=0; i<30; i++) {
          const y = (Math.random() * 2 - 1) * 900;
          const x = (Math.random() * 2 - 1) * 600; 
          if (Math.abs(x) < 50 && Math.abs(y) < 50) continue;
          
          let overlap = false;
          walls.forEach(w => {
              if (Math.abs(w.x - x) < 50 && Math.abs(w.y - y) < 50) overlap = true;
          });
          if (!overlap) add(x, y, 35, 35, false); 
      }

      // 6. Long Brown Walls
      add(-200, -400, 20, 200, false);
      add(200, 200, 20, 200, false);
      add(-400, 100, 200, 20, false);
      add(200, -300, 200, 20, false);

      return walls;
  };

  const generateCactuses = (): Decoration[] => {
      const decors: Decoration[] = [];
      const numCactuses = 18; // Reduced amount significantly
      const MAP_W = 1600;
      const MAP_H = 2000;

      for (let i = 0; i < numCactuses; i++) {
          const x = (Math.random() * 2 - 1) * (MAP_W / 2 - 100);
          const y = (Math.random() * 2 - 1) * (MAP_H / 2 - 100);
          
          // Check avoid walls
          let safe = true;
          // Simple rough check
          if (Math.abs(x) < 350 && Math.abs(y) < 350) safe = false; // Center arena clear
          
          if(safe) {
              decors.push({
                  id: `cactus-${i}`,
                  x,
                  y,
                  type: 'CACTUS',
                  scale: 0.8 + Math.random() * 0.5,
                  rotation: Math.random() * Math.PI * 2,
                  radius: 15 // Base radius for collision
              });
          }
      }
      return decors;
  }
  
  const findSafeSpawnPosition = (walls: Wall[], mapName: string): Vector2 => {
      const MAX_ATTEMPTS = 50;
      const PADDING = 100;
      let mapW = 1200;
      let mapH = 1200;
      
      if (mapName === 'Wasteland') {
          mapW = 1600 / 2;
          mapH = 2000 / 2;
      } else {
          // Erindale is +/- 1200
          mapW = 1200;
          mapH = 1200;
      }

      for (let i = 0; i < MAX_ATTEMPTS; i++) {
          const x = (Math.random() * 2 - 1) * (mapW - PADDING);
          const y = (Math.random() * 2 - 1) * (mapH - PADDING);
          
          // Simple collision check against walls
          let safe = true;
          const playerRadius = 20; // Slightly larger for safety
          
          for (const wall of walls) {
              if (x + playerRadius > wall.x && x - playerRadius < wall.x + wall.width &&
                  y + playerRadius > wall.y && y - playerRadius < wall.y + wall.height) {
                  safe = false;
                  break;
              }
          }
          
          if (safe) return { x, y };
      }
      
      return { x: 0, y: 0 }; // Fallback
  }


  // Initialize Game Logic
  const initGame = useCallback(() => {
    if (!canvasRef.current) return;
    
    // Load images if needed
    if (!wastelandImageRef.current) {
        const img = new Image();
        img.src = './wasteland.png';
        // Suppress warning if image is missing
        img.onerror = () => { };
        wastelandImageRef.current = img;
    }

    const canvas = canvasRef.current;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    enemiesRef.current = [];
    bulletsRef.current = [];
    particlesRef.current = [];
    healthPacksRef.current = [];
    decorationsRef.current = [];
    
    // Generate The Map based on selection
    if (currentMap === "Wasteland") {
        wallsRef.current = generateWastelandLayout();
        decorationsRef.current = generateCactuses();
    } else {
        wallsRef.current = generateErindaleLayout();
        decorationsRef.current = [];
    }
    
    // Find valid spawn point
    const spawnPos = findSafeSpawnPosition(wallsRef.current, currentMap);

    // Reset player
    playerRef.current = {
      id: 'player',
      position: spawnPos,
      velocity: { x: 0, y: 0 },
      radius: 15,
      color: levelConfig.playerColor,
      hp: 100,
      maxHp: 100,
      speed: levelConfig.playerSpeed,
      name: playerName,
      ammo: 120
    };

    setScore(0);
    setHealth(100);
    if(setAmmo) setAmmo(120);
    
    lastHealthPackTimeRef.current = 0;
    lastCactusDamageTimeRef.current = 0;
  }, [levelConfig, setScore, setHealth, setAmmo, currentMap, playerName]);

  // Handle Input
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key.toLowerCase()] = false; };
    const handleMouseMove = (e: MouseEvent) => {
      if (canvasRef.current) {
        const rect = canvasRef.current.getBoundingClientRect();
        mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      }
    };
    const handleMouseDown = () => { isMouseDownRef.current = true; };
    const handleMouseUp = () => { isMouseDownRef.current = false; };
    const handleResize = () => {
      if(canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Update Game State when config changes or game restarts
  useEffect(() => {
    if (gameState === GameState.PLAYING) {
      initGame();
      requestRef.current = requestAnimationFrame(gameLoop);
    } else if (gameState === GameState.SPECTATING) {
        // Keep loop running for spectating
        requestRef.current = requestAnimationFrame(gameLoop);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, initGame]);

  const spawnEnemy = (now: number, playerPos: Vector2) => {
    // Disable enemy spawn if player dead
    if (playerRef.current.hp <= 0) return;
    
    // Disable enemy spawn in multiplayer (Bots Removed as requested)
    if (isMultiplayer) return;

    if (now - lastSpawnTimeRef.current > levelConfig.enemySpawnRate) {
        const canvas = canvasRef.current;
        if (!canvas) return;

        // Calculate spawn radius just outside the screen
        const spawnRadius = Math.max(canvas.width, canvas.height) / 2 + 100;
        const angle = Math.random() * Math.PI * 2;

        const x = playerPos.x + Math.cos(angle) * spawnRadius;
        const y = playerPos.y + Math.sin(angle) * spawnRadius;

        // Ensure we don't spawn inside a wall
        let inWall = false;
        for (const wall of wallsRef.current) {
            if (x > wall.x && x < wall.x + wall.width && y > wall.y && y < wall.y + wall.height) {
                inWall = true;
                break;
            }
        }

        if (!inWall) {
            enemiesRef.current.push({
                id: `enemy-${now}`,
                position: { x, y },
                velocity: { x: 0, y: 0 },
                radius: 12 + Math.random() * 8,
                color: levelConfig.enemyColor,
                hp: 1,
                speed: levelConfig.enemySpeed * (0.8 + Math.random() * 0.4), // Variance
                value: 10
            });
            lastSpawnTimeRef.current = now;
        }
    }
  };

  const spawnHealthPack = (now: number) => {
      if (now - lastHealthPackTimeRef.current > HEALTH_PACK_INTERVAL) {
           const canvas = canvasRef.current;
           if (!canvas) return;
           
           // Spawn somewhere within current map bounds
           // Simple random spawn for now, checking walls
           const mapSize = 1200;
           for(let i=0; i<10; i++) { // Try 10 times to find a spot
               const x = (Math.random() * 2 - 1) * mapSize;
               const y = (Math.random() * 2 - 1) * mapSize;
               
               let inWall = false;
               for (const wall of wallsRef.current) {
                   if (x > wall.x && x < wall.x + wall.width && y > wall.y && y < wall.y + wall.height) {
                       inWall = true;
                       break;
                   }
               }
               
               if (!inWall) {
                   healthPacksRef.current.push({
                       id: `hp-${now}`,
                       position: { x, y },
                       velocity: { x: 0, y: 0 },
                       radius: 15,
                       color: '#22c55e',
                       active: true
                   });
                   lastHealthPackTimeRef.current = now;
                   break;
               }
           }
      }
  }

  const createParticles = (x: number, y: number, color: string, count: number) => {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 3;
        particlesRef.current.push({
            id: `p-${Date.now()}-${i}`,
            position: { x, y },
            velocity: { 
                x: Math.cos(angle) * speed, 
                y: Math.sin(angle) * speed 
            },
            radius: Math.random() * 3,
            color: color,
            life: 1.0,
            maxLife: 1.0
        });
    }
  };

  const gameLoop = (time: number) => {
    // Access latest props from ref to avoid stale closures
    const currentProps = propsRef.current;
    
    if (currentProps.gameState !== GameState.PLAYING && currentProps.gameState !== GameState.SPECTATING) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const player = playerRef.current;
    
    // --- Update Logic ---

    // 1. Player Movement (Direct Control) - Only if alive
    if (player.hp > 0 && currentProps.gameState === GameState.PLAYING) {
        let moveX = 0;
        let moveY = 0;

        if (keysRef.current['w']) moveY -= 1;
        if (keysRef.current['s']) moveY += 1;
        if (keysRef.current['a']) moveX -= 1;
        if (keysRef.current['d']) moveX += 1;

        // Normalize diagonal movement
        const len = Math.sqrt(moveX * moveX + moveY * moveY);
        if (len > 0) {
            player.velocity.x = (moveX / len) * player.speed;
            player.velocity.y = (moveY / len) * player.speed;
        } else {
            // Immediate stop when keys are released
            player.velocity.x = 0;
            player.velocity.y = 0;
        }

        // Apply Velocity
        player.position.x += player.velocity.x;
        player.position.y += player.velocity.y;
        
        // Resolve Wall Collisions for Player
        wallsRef.current.forEach(wall => {
            resolveWallCollision(player, wall);
        });

        // Resolve Decoration Collisions (Cacti are solid for movement)
        let hitCactus = false;
        decorationsRef.current.forEach(decor => {
            if (resolveDecorationCollision(player, decor)) {
                if (decor.type === 'CACTUS') hitCactus = true;
            }
        });

        if (hitCactus && player.hp > 0) {
            if (time - lastCactusDamageTimeRef.current > 1000) {
                player.hp -= 2;
                currentProps.setHealth(Math.max(0, player.hp));
                soundService.playPlayerDamage();
                createParticles(player.position.x, player.position.y, '#ef4444', 3);
                lastCactusDamageTimeRef.current = time;

                if (player.hp <= 0) {
                    currentProps.onGameOver("Cactus");
                }
            }
        }
        
        // Emit player update (throttled to ~20fps for network)
        if (currentProps.onPlayerUpdate && time - lastUpdateEmitRef.current > 50) {
            currentProps.onPlayerUpdate({ x: player.position.x, y: player.position.y });
            lastUpdateEmitRef.current = time;
        }
    }

    // Check for Round End Condition (Multiplayer Only)
    // "when everyone dies and there is one person left" -> Last Man Standing
    if ((currentProps.remotePlayers || []).length > 0 && currentProps.onRoundEnd && (currentProps.gameState === GameState.PLAYING || currentProps.gameState === GameState.SPECTATING)) {
        // Count alive players (Remote + Local)
        const activeRemote = (currentProps.remotePlayers || []).filter(p => p.hp > 0).length;
        const localAlive = player.hp > 0 ? 1 : 0;
        const totalAlive = activeRemote + localAlive;
        
        // If 1 or fewer players remain, and we are in a multiplayer session...
        if (totalAlive <= 1) {
            // Slight delay to allow death animation/realization
            // In a real app we'd debounce this, but for now we just trigger
            currentProps.onRoundEnd();
        }
    }

    // 2. Aim Calculation
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const aimAngle = Math.atan2(
        mouseRef.current.y - centerY,
        mouseRef.current.x - centerX
    );

    // 3. Shooting - Only if alive and has ammo
    if (player.hp > 0 && currentProps.gameState === GameState.PLAYING) {
        if (isMouseDownRef.current && time - lastShotTimeRef.current > FIRE_RATE) {
            if (player.ammo > 0) {
                soundService.playShoot();
                player.ammo--;
                if(currentProps.setAmmo) currentProps.setAmmo(player.ammo);

                const bulletSpeed = 12;
                const spawnX = player.position.x + Math.cos(aimAngle) * 25;
                const spawnY = player.position.y + Math.sin(aimAngle) * 25;
                
                bulletsRef.current.push({
                    id: `bullet-${time}`,
                    position: { x: spawnX, y: spawnY },
                    velocity: {
                        x: Math.cos(aimAngle) * bulletSpeed,
                        y: Math.sin(aimAngle) * bulletSpeed
                    },
                    radius: 4,
                    color: levelConfig.bulletColor,
                    damage: 20, // Increased damage
                    ownerId: player.id
                });
                lastShotTimeRef.current = time;
            }
        }
    }

    // 4. Spawning (Relative to camera target)
    let cameraPos = player.position;
    if (currentProps.gameState === GameState.SPECTATING && currentProps.spectatorTargetId) {
        const target = (currentProps.remotePlayers || []).find(p => p.id === currentProps.spectatorTargetId);
        if (target) {
            cameraPos = target.position;
        }
    }
    spawnEnemy(time, cameraPos);
    
    // Spawn Health Packs
    if (currentProps.gameState === GameState.PLAYING) {
        spawnHealthPack(time);
    }

    // 5. Updates (Bullets, Enemies, Particles)
    const despawnDistance = Math.max(canvas.width, canvas.height) * 1.5;

    // Update Bullets
    bulletsRef.current.forEach(b => {
        b.position.x += b.velocity.x;
        b.position.y += b.velocity.y;
    });
    // Remove bullets that travel too far or hit walls
    bulletsRef.current = bulletsRef.current.filter(b => {
        // Despawn if too far from camera
        const dx = b.position.x - cameraPos.x;
        const dy = b.position.y - cameraPos.y;
        
        // Check wall collision (Solid objects)
        for(const wall of wallsRef.current) {
            if (checkBulletWallCollision(b, wall)) {
                createParticles(b.position.x, b.position.y, '#ffffff', 3);
                return false; // Destroy bullet
            }
        }
        
        // NOTE: We do NOT check decoration collision for bullets, 
        // so you can shoot through Cacti (per requirement).

        return Math.sqrt(dx*dx + dy*dy) < despawnDistance;
    });

    // Update Enemies
    enemiesRef.current.forEach(e => {
        // Move towards the nearest player (simple AI)
        let target = player;
        let minDist = Infinity;
        
        // Check main player if alive
        if (player.hp > 0) {
            const dx = player.position.x - e.position.x;
            const dy = player.position.y - e.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            minDist = dist;
        }

        if (player.hp > 0) {
             const dx = player.position.x - e.position.x;
             const dy = player.position.y - e.position.y;
             if (minDist > 0) {
                 e.velocity.x = (dx / minDist) * e.speed;
                 e.velocity.y = (dy / minDist) * e.speed;
             }
        }
        
        e.position.x += e.velocity.x;
        e.position.y += e.velocity.y;

        // Resolve Wall Collisions for Enemies
        wallsRef.current.forEach(wall => {
            resolveWallCollision(e, wall);
        });

        // Resolve Decoration Collisions for Enemies (Cacti block them too)
        decorationsRef.current.forEach(decor => {
            resolveDecorationCollision(e, decor);
        });

        // Collision: Enemy vs Player
        if (player.hp > 0) {
             const dx2 = player.position.x - e.position.x;
             const dy2 = player.position.y - e.position.y;
             const dist2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

             if (dist2 < player.radius + e.radius) {
                soundService.playPlayerDamage();
                player.hp -= 10;
                e.hp = 0; // Enemy dies on impact
                currentProps.setHealth(Math.max(0, player.hp));
                createParticles(e.position.x, e.position.y, levelConfig.playerColor, 10);
                
                if (player.hp <= 0) {
                    currentProps.onGameOver("Enemies");
                }
            }
        }
    });

    // Collision: Bullet vs Enemy
    bulletsRef.current.forEach(b => {
        enemiesRef.current.forEach(e => {
            const dx = b.position.x - e.position.x;
            const dy = b.position.y - e.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < b.radius + e.radius) {
                e.hp -= b.damage;
                b.damage = 0; // Mark bullet for removal
                
                if (e.hp <= 0) {
                    soundService.playEnemyDeath();
                    scoreRef.current += e.value;
                    currentProps.setScore(scoreRef.current);
                    if (currentProps.onKill) currentProps.onKill(); // Track kill globally
                    createParticles(e.position.x, e.position.y, e.color, 8);
                }
            }
        });
    });

    // Check Health Pack Collisions
    if (player.hp > 0) {
        healthPacksRef.current = healthPacksRef.current.filter(hp => {
            const dx = player.position.x - hp.position.x;
            const dy = player.position.y - hp.position.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < player.radius + hp.radius) {
                // Heal!
                player.hp = player.maxHp;
                currentProps.setHealth(player.hp);
                createParticles(hp.position.x, hp.position.y, '#22c55e', 10);
                return false; // Remove pack
            }
            return true;
        });
    }

    // Cleanup dead entities
    bulletsRef.current = bulletsRef.current.filter(b => b.damage > 0);
    enemiesRef.current = enemiesRef.current.filter(e => e.hp > 0);

    // Update Particles
    particlesRef.current.forEach(p => {
        p.position.x += p.velocity.x;
        p.position.y += p.velocity.y;
        p.life -= 0.02;
    });
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);


    // --- Render Logic ---
    
    // 1. Determine Camera Position
    // If playing, follow player. If spectating, follow target.
    let camX = canvas.width / 2 - player.position.x;
    let camY = canvas.height / 2 - player.position.y;
    
    let renderFocusPos = player.position;

    if (currentProps.gameState === GameState.SPECTATING && currentProps.spectatorTargetId) {
        const target = (currentProps.remotePlayers || []).find(p => p.id === currentProps.spectatorTargetId);
        if (target) {
            camX = canvas.width / 2 - target.position.x;
            camY = canvas.height / 2 - target.position.y;
            renderFocusPos = target.position;
        }
    }

    // 2. Clear Screen & Draw Background
    // IMPORTANT: Fill with opaque color first to ensure we don't see transparency
    // This fixes "white outlines" caused by destination-out against a black body background
    
    if (currentMap === "Wasteland") {
        const img = wastelandImageRef.current;
        if (img && img.complete && img.naturalWidth > 0) {
            ctx.fillStyle = '#C2B280'; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            
            ctx.save();
            ctx.translate(camX, camY);
            ctx.drawImage(img, -800, -1000, 1600, 2000);
            ctx.restore();
            
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(0,0, canvas.width, canvas.height);
        } else {
            // Fallback
            ctx.fillStyle = '#C2B280'; 
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            ctx.translate(camX, camY);
            ctx.strokeStyle = '#8d6e63';
            ctx.lineWidth = 10;
            ctx.strokeRect(-800, -1000, 1600, 2000);
            ctx.restore();
        }
    } else {
        // Erindale
        ctx.fillStyle = '#064e3b';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.save();
        ctx.translate(camX, camY);
        
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.15;
        const gridSize = 100;
        
        // Calculate grid based on camera view for infinite feeling
        // This is a simple approximation
        const startX = Math.floor((-camX) / gridSize) * gridSize;
        const endX = startX + canvas.width + gridSize;
        const startY = Math.floor((-camY) / gridSize) * gridSize;
        const endY = startY + canvas.height + gridSize;

        ctx.beginPath();
        for(let x = startX; x <= endX; x += gridSize) { 
            ctx.moveTo(x, startY); 
            ctx.lineTo(x, endY); 
        }
        for(let y = startY; y <= endY; y += gridSize) { 
            ctx.moveTo(startX, y); 
            ctx.lineTo(endX, y); 
        }
        ctx.stroke();
        ctx.globalAlpha = 1.0;
        ctx.restore();
    }
    
    // Setup camera for entities
    ctx.save();
    ctx.translate(camX, camY);

    // 3. Draw Decorations (Bottom Layer - Cactuses)
    decorationsRef.current.forEach(d => {
        if (d.type === 'CACTUS') {
            ctx.save();
            ctx.translate(d.x, d.y);
            ctx.scale(d.scale, d.scale);
            // Draw Cactus
            ctx.fillStyle = '#1e4620';
            ctx.beginPath();
            // Main stem
            ctx.ellipse(0, 0, 15, 40, 0, 0, Math.PI * 2);
            ctx.fill();
            // Arm 1
            ctx.beginPath();
            ctx.ellipse(15, -10, 8, 20, -Math.PI/4, 0, Math.PI * 2);
            ctx.fill();
            // Arm 2
            ctx.beginPath();
            ctx.ellipse(-15, 5, 8, 20, Math.PI/4, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    });

    // 4. Draw Walls
    wallsRef.current.forEach(w => {
        if (currentMap === "Wasteland") {
             // CRATES (Small, High walls) - Special Rendering
             if (!w.isLow && w.width < 60 && w.height < 60) {
                 ctx.save();
                 ctx.fillStyle = '#5D4037'; // Wood color
                 ctx.fillRect(w.x, w.y, w.width, w.height);
                 // Crate Border
                 ctx.strokeStyle = '#3E2723';
                 ctx.lineWidth = 3;
                 ctx.strokeRect(w.x, w.y, w.width, w.height);
                 // Cross pattern
                 ctx.beginPath();
                 ctx.moveTo(w.x, w.y);
                 ctx.lineTo(w.x + w.width, w.y + w.height);
                 ctx.moveTo(w.x + w.width, w.y);
                 ctx.lineTo(w.x, w.y + w.height);
                 ctx.stroke();
                 ctx.restore();
             }
             else if (w.isLow) {
                 // Low walls (if any left, used to be barrels)
                 ctx.fillStyle = '#5d4037'; 
                 ctx.fillRect(w.x, w.y, w.width, w.height);
                 ctx.strokeStyle = '#3e2723';
                 ctx.strokeRect(w.x, w.y, w.width, w.height);
             } else {
                 // Buildings / Big Walls
                 ctx.fillStyle = '#3e2723'; 
                 ctx.fillRect(w.x, w.y, w.width, w.height);
                 
                 // Add detail so it doesn't look like a glitch
                 ctx.strokeStyle = '#2d1b15';
                 ctx.lineWidth = 4;
                 ctx.strokeRect(w.x, w.y, w.width, w.height);
                 
                 // Fake roof perspective
                 ctx.fillStyle = 'rgba(0,0,0,0.3)';
                 ctx.fillRect(w.x + 10, w.y + 10, w.width - 20, w.height - 20);
             }
        } else {
            // Erindale
            if (w.isLow) {
                ctx.fillStyle = '#166534';
                ctx.strokeStyle = '#22c55e';
                ctx.lineWidth = 2;
                ctx.fillRect(w.x, w.y, w.width, w.height);
                ctx.strokeRect(w.x, w.y, w.width, w.height);
                ctx.fillStyle = '#15803d';
                ctx.fillRect(w.x + 4, w.y + 4, w.width - 8, w.height - 8);
            } else {
                ctx.fillStyle = '#374151';
                ctx.strokeStyle = '#6b7280';
                ctx.lineWidth = 2;
                ctx.fillRect(w.x, w.y, w.width, w.height);
                ctx.strokeRect(w.x, w.y, w.width, w.height);
                ctx.fillStyle = '#4b5563';
                ctx.fillRect(w.x + 5, w.y + 5, w.width - 10, w.height - 10);
            }
        }
    });
    
    // Draw Health Packs
    healthPacksRef.current.forEach(hp => {
        const size = 12;
        ctx.fillStyle = '#22c55e';
        // Horizontal bar
        ctx.fillRect(hp.position.x - size, hp.position.y - size/3, size*2, size/1.5);
        // Vertical bar
        ctx.fillRect(hp.position.x - size/3, hp.position.y - size, size/1.5, size*2);
        
        // Glow effect
        ctx.shadowColor = '#22c55e';
        ctx.shadowBlur = 10;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(hp.position.x - size, hp.position.y - size/3, size*2, size/1.5);
        ctx.strokeRect(hp.position.x - size/3, hp.position.y - size, size/1.5, size*2);
        ctx.shadowBlur = 0;
    });

    // 5. Draw Particles
    particlesRef.current.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.position.x, p.position.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1.0;
    });

    // 6. Draw Bullets (Silver Cylinders)
    bulletsRef.current.forEach(b => {
        ctx.save();
        ctx.translate(b.position.x, b.position.y);
        const angle = Math.atan2(b.velocity.y, b.velocity.x);
        ctx.rotate(angle);
        
        ctx.fillStyle = '#C0C0C0'; // Silver
        // Cylinder shape
        ctx.beginPath();
        ctx.roundRect(-6, -3, 12, 6, 2);
        ctx.fill();
        
        // Shine/Rim
        ctx.fillStyle = '#FFFFFF';
        ctx.globalAlpha = 0.5;
        ctx.fillRect(-6, -1, 10, 2);
        ctx.globalAlpha = 1.0;
        
        ctx.restore();
    });

    // 7. Draw Enemies
    enemiesRef.current.forEach(e => {
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.arc(e.position.x, e.position.y, e.radius, 0, Math.PI * 2);
        ctx.fill();
    });

    // 8. Draw Remote Players
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    
    (currentProps.remotePlayers || []).forEach(rp => {
        // Draw HP bar for remote players
        const hpBarWidth = 30;
        const hpPercent = rp.hp / 100;
        if (rp.hp > 0) {
             ctx.fillStyle = '#ef4444';
             ctx.fillRect(rp.position.x - hpBarWidth/2, rp.position.y - 35, hpBarWidth, 4);
             ctx.fillStyle = '#22c55e';
             ctx.fillRect(rp.position.x - hpBarWidth/2, rp.position.y - 35, hpBarWidth * hpPercent, 4);
        }

        ctx.fillStyle = rp.color;
        ctx.beginPath();
        ctx.arc(rp.position.x, rp.position.y, 15, 0, Math.PI * 2); 
        ctx.fill();
        
        ctx.fillStyle = '#ffffff';
        ctx.fillText(rp.name || "UNK", rp.position.x, rp.position.y - 20);
    });

    // 9. DARKNESS & FLASHLIGHT MASK
    ctx.save();
    
    // We use the 'evenodd' winding rule to create holes in a solid mask.
    // 1. We draw a giant rectangle covering the screen.
    // 2. We draw the flashlight polygon and visibility circle.
    // 3. 'evenodd' fill will leave the overlapping areas (holes) transparent, showing the world below.
    
    const viewSource = (currentProps.gameState === GameState.SPECTATING && currentProps.spectatorTargetId) 
        ? (currentProps.remotePlayers || []).find(p => p.id === currentProps.spectatorTargetId)
        : player;

    if (viewSource && viewSource.hp > 0) {
        ctx.beginPath();
        
        // A. Outer Mask (The Darkness)
        // Extend well beyond screen boundaries to ensure no leaks
        ctx.rect(-camX - 1000, -camY - 1000, canvas.width + 2000, canvas.height + 2000);

        // B. Flashlight Hole
        const viewAimAngle = (viewSource.id === player.id) 
            ? aimAngle 
            : 0; 
        
        let lightAngle = aimAngle;
        if (viewSource.id !== player.id) {
            if (Math.abs(viewSource.velocity.x) > 0 || Math.abs(viewSource.velocity.y) > 0) {
                lightAngle = Math.atan2(viewSource.velocity.y, viewSource.velocity.x);
            } else {
                lightAngle = 0; 
            }
        }

        const beamLength = 450;
        const fov = Math.PI / 3; 
        const rays = 60; 
        const startAngle = lightAngle - fov / 2;
        const angleStep = fov / rays;

        // Move to start of polygon to separate subpaths
        ctx.moveTo(viewSource.position.x, viewSource.position.y);
        for(let i = 0; i <= rays; i++) {
            const theta = startAngle + i * angleStep;
            const rayDir = { x: Math.cos(theta), y: Math.sin(theta) };
            const rayEnd = { 
                x: viewSource.position.x + rayDir.x * beamLength, 
                y: viewSource.position.y + rayDir.y * beamLength 
            };

            let closest: Intersection = null;
            let minT = 1.0;

            for (const wall of wallsRef.current) {
                if (wall.isLow) continue;
                // Collision segments logic
                const segments = [
                    { s: {x: wall.x, y: wall.y}, e: {x: wall.x + wall.width, y: wall.y} },
                    { s: {x: wall.x + wall.width, y: wall.y}, e: {x: wall.x + wall.width, y: wall.y + wall.height} },
                    { s: {x: wall.x + wall.width, y: wall.y + wall.height}, e: {x: wall.x, y: wall.y + wall.height} },
                    { s: {x: wall.x, y: wall.y + wall.height}, e: {x: wall.x, y: wall.y} },
                ];
                for(const seg of segments) {
                    const intersection = getIntersection(viewSource.position, rayEnd, seg.s, seg.e);
                    if (intersection && intersection.param < minT) {
                        minT = intersection.param;
                        closest = intersection;
                    }
                }
            }
            const p = closest ? { x: closest.x, y: closest.y } : rayEnd;
            ctx.lineTo(p.x, p.y);
        }
        ctx.closePath();

        // C. Visibility Circle Hole (Around Player)
        // Move to edge to start new subpath cleanly
        ctx.moveTo(viewSource.position.x + 30, viewSource.position.y);
        ctx.arc(viewSource.position.x, viewSource.position.y, 30, 0, Math.PI*2);

        // Fill with Solid Black using EvenOdd rule
        // Overlapping areas (Rect + Poly) count as "Even" (2) -> Transparent
        // Non-overlapping areas (Rect only) count as "Odd" (1) -> Black
        ctx.fillStyle = '#000000';
        ctx.fill('evenodd');
    } else {
        // Dead/No View Source: Pure Darkness
        ctx.fillStyle = '#000000';
        ctx.fillRect(-camX, -camY, canvas.width, canvas.height);
    }
    
    ctx.restore();


    // 10. Draw Local Player (If alive)
    if (player.hp > 0) {
        ctx.save();
        ctx.translate(player.position.x, player.position.y);
        ctx.rotate(aimAngle);
        
        ctx.fillStyle = '#d1d5db'; 
        ctx.beginPath();
        ctx.arc(12, 12, 6, 0, Math.PI*2); 
        ctx.arc(12, -12, 6, 0, Math.PI*2); 
        ctx.fill();

        ctx.fillStyle = '#333';
        ctx.fillRect(5, -6, 25, 12); 
        ctx.fillStyle = '#111';
        ctx.fillRect(5, -2, 25, 4); 

        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(5, 0, 10, -Math.PI/2, Math.PI/2);
        ctx.fill();

        ctx.restore();
        
        // Name tag (unrotated)
        ctx.font = 'bold 12px monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(player.name || "YOU", player.position.x, player.position.y - 25);
    }

    ctx.restore(); 

    requestRef.current = requestAnimationFrame(gameLoop);
  };

  return <canvas ref={canvasRef} className="block w-full h-full" />;
};

export default GameCanvas;