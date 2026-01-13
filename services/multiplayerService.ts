import { Vector2 } from "../types";

type MessageHandler = (payload: any) => void;

export class MultiplayerService {
  private ws: WebSocket | null = null;
  private listeners: Record<string, MessageHandler[]> = {};
  public playerId: string;
  public isConnected: boolean = false;
  private isMockMode: boolean = false;

  constructor() {
    this.playerId = Math.random().toString(36).substring(2, 9);
  }

  public connect(url: string = 'ws://localhost:8080') {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isMockMode = false;
    this.isConnected = false;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        console.log('Connected to Multiplayer Server');
        this.isConnected = true;
        this.emit('connected', { mode: 'online' });
      };

      this.ws.onclose = () => {
        console.log('Disconnected from Multiplayer Server');
        this.isConnected = false;
        // If we were not in mock mode, this is a real disconnect
        if (!this.isMockMode) {
             this.emit('disconnected', {});
        }
      };

      this.ws.onerror = (_event) => {
        console.warn('WebSocket connection failed. Switching to Mock Mode.');
        this.enableMockMode();
      };

    } catch (e) {
      console.error("Connection failed immediately, switching to mock", e);
      this.enableMockMode();
    }
    
    // Safety timeout: If not connected in 1.5s, switch to mock
    setTimeout(() => {
        if (!this.isConnected && !this.isMockMode) {
            console.log("Connection timed out. Switching to Mock Mode.");
            this.enableMockMode();
        }
    }, 1500);
  }

  private enableMockMode() {
      if (this.isMockMode) return;
      this.isMockMode = true;
      this.isConnected = true; // Virtual connection
      if (this.ws) {
          this.ws.close();
          this.ws = null;
      }
      this.emit('connected', { mode: 'mock' });
  }

  public createRoom(roomCode: string, mapName: string) {
    this.send('CREATE_ROOM', { hostId: this.playerId, roomCode, mapName });
  }

  public joinRoom(roomCode: string) {
    this.send('JOIN_ROOM', { playerId: this.playerId, roomCode });
  }

  public sendPlayerUpdate(position: Vector2, color: string, name?: string, hp?: number, kills?: number) {
    if (!this.isConnected) return;
    this.send('PLAYER_UPDATE', { 
      id: this.playerId, 
      position,
      color,
      name,
      hp,
      kills
    });
  }

  public on(type: string, handler: MessageHandler) {
    if (!this.listeners[type]) {
      this.listeners[type] = [];
    }
    this.listeners[type].push(handler);
  }

  public off(type: string, handler: MessageHandler) {
    if (!this.listeners[type]) return;
    this.listeners[type] = this.listeners[type].filter(h => h !== handler);
  }

  private emit(type: string, payload: any) {
    if (this.listeners[type]) {
      this.listeners[type].forEach(handler => handler(payload));
    }
  }

  private send(type: string, payload: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    } else if (this.isMockMode) {
        this.handleMockResponse(type, payload);
    } else {
        console.warn("Attempted to send message while disconnected");
    }
  }

  private handleMockResponse(type: string, payload: any) {
      // Simulate server delay
      setTimeout(() => {
          switch (type) {
              case 'CREATE_ROOM':
                  this.emit('ROOM_JOINED', { 
                      roomCode: payload.roomCode || 'DEMO', 
                      isHost: true, 
                      theme: payload.mapName 
                  });
                  // Also trigger game start for host immediately in this mock flow if it's a "Restart"
                  if (payload.mapName) {
                      this.emit('GAME_STARTED', { theme: payload.mapName });
                  }
                  break;
              case 'JOIN_ROOM':
                  this.emit('ROOM_JOINED', { 
                      roomCode: payload.roomCode, 
                      isHost: false 
                  });
                  break;
              case 'PLAYER_UPDATE':
                  // Bots removed as requested
                  break;
          }
      }, 300);
  }
}

export const multiplayerService = new MultiplayerService();