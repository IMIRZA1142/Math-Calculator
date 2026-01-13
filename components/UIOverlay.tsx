import React, { useState, useEffect } from 'react';
import { GameState, LevelConfig, RemotePlayer } from '../types';
import { Loader2, Heart, Trophy, Skull, Play, Users, Globe, ArrowLeft, Map as MapIcon, Crown, Eye, Zap, Medal } from 'lucide-react';

interface UIOverlayProps {
  gameState: GameState;
  score: number;
  health: number;
  ammo: number;
  levelConfig: LevelConfig;
  onStartGame: (theme: string) => void;
  onEnterLobby: () => void;
  onJoinRoom: (code: string) => void;
  onCreateRoom: (code: string, map: string) => void;
  onRestart: () => void;
  lobbyStatus?: string;
  roomCode?: string;
  playerName?: string;
  setPlayerName?: (name: string) => void;
  playerColor?: string;
  setPlayerColor?: (color: string) => void;
  isHost?: boolean;
  onHostStart?: (theme: string) => void;
  remotePlayers?: RemotePlayer[]; // Passed for leaderboard
  totalKills?: number; // Local player total kills
}

const COLORS = [
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#22c55e', // Green
  '#eab308', // Yellow
  '#a855f7', // Purple
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#ec4899', // Pink
  '#84cc16', // Lime
  '#64748b', // Slate
];

const UIOverlay: React.FC<UIOverlayProps> = ({ 
  gameState, 
  score, 
  health, 
  ammo,
  levelConfig, 
  onStartGame,
  onEnterLobby,
  onJoinRoom,
  onCreateRoom,
  onRestart,
  lobbyStatus,
  roomCode,
  playerName = "P1",
  setPlayerName,
  playerColor = COLORS[1],
  setPlayerColor,
  isHost,
  onHostStart,
  remotePlayers = [],
  totalKills = 0
}) => {
  const [createRoomInput, setCreateRoomInput] = useState('');
  const [selectedMap, setSelectedMap] = useState<string>('Erindale Park');
  const [roomInput, setRoomInput] = useState('');
  const [menuView, setMenuView] = useState<'MAIN' | 'MAP_SELECT'>('MAIN');

  // Reset menu view when returning to menu state
  useEffect(() => {
    if (gameState === GameState.MENU) {
        setMenuView('MAIN');
    }
  }, [gameState]);

  if (gameState === GameState.PLAYING) {
    return (
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none p-6 flex flex-col justify-between">
        <div className="flex justify-between items-start">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 text-red-500 font-bold text-2xl drop-shadow-md">
              <Heart className="fill-current" />
              <span>{Math.ceil(health)}%</span>
            </div>
            <div className="flex items-center gap-2 text-yellow-400 font-bold text-2xl drop-shadow-md">
              <Trophy className="fill-current" />
              <span>{score}</span>
            </div>
            <div className="flex items-center gap-2 text-blue-300 font-bold text-2xl drop-shadow-md">
              <Zap className="fill-current" />
              <span>{ammo}</span>
            </div>
            {roomCode && (
                 <div className="flex items-center gap-2 text-blue-400 font-bold text-lg drop-shadow-md">
                   <Users className="w-5 h-5" />
                   <span>Room: {roomCode}</span>
                 </div>
            )}
          </div>
        </div>
        <div className="text-white/30 text-sm text-center">
            WASD to Move • Mouse to Aim & Shoot
        </div>
      </div>
    );
  }

  if (gameState === GameState.SPECTATING) {
      return (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none flex flex-col items-center justify-center z-50">
           <div className="absolute bottom-12 flex flex-col items-center">
               <div className="bg-black/80 backdrop-blur px-8 py-4 rounded-full border border-red-500/30 flex items-center gap-4 animate-pulse">
                   <Eye className="w-6 h-6 text-red-500" />
                   <span className="text-white font-bold text-xl tracking-widest">SPECTATING</span>
               </div>
               <div className="mt-4 text-slate-400 text-sm bg-black/50 px-4 py-1 rounded">Waiting for match end...</div>
           </div>
        </div>
      );
  }

  if (gameState === GameState.LEADERBOARD) {
      // Sort players by kills
      const allPlayers = [
          { name: playerName, kills: totalKills, color: playerColor, isLocal: true },
          ...remotePlayers.map(p => ({ name: p.name || 'UNK', kills: p.kills || 0, color: p.color, isLocal: false }))
      ].sort((a, b) => b.kills - a.kills);

      return (
          <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black/90 z-50 p-4">
              <div className="max-w-2xl w-full bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
                  <div className="p-6 bg-slate-800 border-b border-slate-700 text-center">
                      <h2 className="text-3xl font-black text-white uppercase tracking-wider flex items-center justify-center gap-3">
                          <Medal className="w-8 h-8 text-yellow-500" /> Mission Leaderboard
                      </h2>
                      <p className="text-slate-400 text-sm mt-1">All-Time Cumulative Kills</p>
                  </div>
                  
                  <div className="p-4 max-h-[60vh] overflow-y-auto">
                      <table className="w-full text-left">
                          <thead className="text-slate-500 text-xs uppercase font-bold border-b border-slate-800">
                              <tr>
                                  <th className="pb-3 pl-4">Rank</th>
                                  <th className="pb-3">Operative</th>
                                  <th className="pb-3 text-right pr-4">Total Kills</th>
                              </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800">
                              {allPlayers.map((p, idx) => (
                                  <tr key={idx} className={`${p.isLocal ? 'bg-white/5' : ''} hover:bg-white/10 transition-colors`}>
                                      <td className="py-4 pl-4 font-mono text-slate-400">#{idx + 1}</td>
                                      <td className="py-4 flex items-center gap-3">
                                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: p.color }}>
                                              {p.name.substring(0, 2)}
                                          </div>
                                          <span className={`font-bold ${p.isLocal ? 'text-white' : 'text-slate-300'}`}>
                                              {p.name} {p.isLocal && '(YOU)'}
                                          </span>
                                      </td>
                                      <td className="py-4 pr-4 text-right font-mono text-xl text-yellow-500 font-bold">
                                          {p.kills}
                                      </td>
                                  </tr>
                              ))}
                          </tbody>
                      </table>
                  </div>

                  <div className="p-6 bg-slate-800 border-t border-slate-700 flex justify-center">
                      {isHost ? (
                          <button 
                            onClick={() => onHostStart && onHostStart("Wasteland")}
                            className="px-8 py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-xl rounded shadow-lg transition-transform hover:scale-105 flex items-center gap-2"
                        >
                            <Play className="fill-current" /> START NEXT MATCH
                        </button>
                      ) : (
                          <div className="flex items-center gap-3 text-slate-400 animate-pulse">
                              <Loader2 className="w-5 h-5 animate-spin" />
                              <span>Waiting for Host to start next match...</span>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )
  }

  if (gameState === GameState.LOADING) {
    return (
      <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black z-50">
        <Loader2 className="w-16 h-16 text-green-500 animate-spin mb-4" />
        <h2 className="text-2xl font-bold text-white mb-2">Simulating Physics...</h2>
        <p className="text-gray-400">Generating environment parameters.</p>
      </div>
    );
  }

  if (gameState === GameState.GAME_OVER) {
    return (
      <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black/90 backdrop-blur-md z-50">
        <Skull className="w-24 h-24 text-red-600 mb-6 animate-pulse" />
        <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-600 mb-2">
          GAME OVER
        </h1>
        <div className="text-3xl text-white font-mono mb-8">
            FINAL SCORE: <span className="text-yellow-400">{score}</span>
        </div>
        <button 
          onClick={onRestart}
          className="px-8 py-4 bg-white text-black font-bold text-xl rounded hover:scale-105 transition-transform flex items-center gap-2"
        >
          <Play className="fill-current" /> RESTART MISSION
        </button>
      </div>
    );
  }

  if (gameState === GameState.LOBBY) {
      // Combined list of local player + remote players
      const lobbyPlayers = [
        { name: playerName, color: playerColor, isLocal: true },
        ...remotePlayers.map(p => ({ name: p.name || 'UNK', color: p.color, isLocal: false }))
      ];

      return (
        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black z-50 p-4">
            <div className="max-w-4xl w-full bg-slate-900 p-8 rounded-2xl shadow-2xl border border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Left Column: Profile */}
                <div className="flex flex-col gap-6 border-r border-slate-800 pr-0 md:pr-8">
                    <button 
                        onClick={onRestart} 
                        className="flex items-center text-slate-400 hover:text-white mb-2 text-sm w-fit"
                    >
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                    </button>
                    
                    <h2 className="text-xl font-bold text-white uppercase tracking-wider">Operative Profile</h2>
                    
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Callsign (3 Letters)</label>
                        <input 
                            type="text" 
                            maxLength={3}
                            value={playerName}
                            onChange={(e) => setPlayerName && setPlayerName(e.target.value.toUpperCase())}
                            className="w-full bg-black/50 border border-slate-700 rounded px-4 py-3 text-white font-mono text-xl focus:outline-none focus:border-blue-500 uppercase"
                            disabled={!!roomCode} // Lock name if joined
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Signal Color</label>
                        <div className="grid grid-cols-5 gap-2">
                            {COLORS.map(c => (
                                <button
                                    key={c}
                                    onClick={() => !roomCode && setPlayerColor && setPlayerColor(c)}
                                    className={`w-10 h-10 rounded-full border-2 transition-transform hover:scale-110 ${playerColor === c ? 'border-white scale-110' : 'border-transparent'} ${roomCode ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    style={{ backgroundColor: c }}
                                    disabled={!!roomCode}
                                />
                            ))}
                        </div>
                    </div>
                    
                    <div className="mt-auto p-4 bg-slate-800/50 rounded flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-bold shadow-lg" style={{ backgroundColor: playerColor, color: '#fff' }}>
                            {playerName}
                        </div>
                        <div className="text-sm text-slate-300">
                            {roomCode ? "Profile locked while in room." : "Preview of your appearance on the battlefield."}
                        </div>
                    </div>
                </div>

                {/* Right Column: Connection / Roster */}
                <div className="flex flex-col gap-6">
                    <div className="flex items-center gap-3 mb-2">
                        <Globe className="w-6 h-6 text-blue-500" />
                        <h2 className="text-xl font-bold text-white uppercase tracking-wider">Mission Control</h2>
                    </div>

                    {!roomCode ? (
                        <>
                            <div className="bg-black/50 p-4 rounded border border-slate-800">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Create New Operation</label>
                                <input 
                                    type="text" 
                                    value={createRoomInput}
                                    onChange={(e) => setCreateRoomInput(e.target.value.toUpperCase())}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-blue-500 tracking-widest font-mono uppercase"
                                    placeholder="ENTER ROOM CODE"
                                    maxLength={4}
                                />
                                
                                <div className="grid grid-cols-2 gap-2 mb-3">
                                    <button
                                        onClick={() => setSelectedMap('Erindale Park')}
                                        className={`py-2 text-xs font-bold uppercase rounded border ${selectedMap === 'Erindale Park' ? 'bg-emerald-900/50 border-emerald-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                                    >
                                        Erindale
                                    </button>
                                    <button
                                        onClick={() => setSelectedMap('Wasteland')}
                                        className={`py-2 text-xs font-bold uppercase rounded border ${selectedMap === 'Wasteland' ? 'bg-amber-900/50 border-amber-500 text-white' : 'bg-slate-900 border-slate-700 text-slate-500'}`}
                                    >
                                        Wasteland
                                    </button>
                                </div>

                                <button 
                                    onClick={() => onCreateRoom(createRoomInput || 'GAME', selectedMap)}
                                    className="w-full py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded text-sm transition-colors flex items-center justify-center gap-2"
                                >
                                    <Crown className="w-4 h-4" /> Create Room
                                </button>
                            </div>

                            <div className="relative py-2">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-800"></div>
                                </div>
                                <div className="relative flex justify-center text-xs uppercase">
                                    <span className="bg-slate-900 px-2 text-slate-500">Or Join Existing</span>
                                </div>
                            </div>

                            <div className="bg-black/50 p-4 rounded border border-slate-800">
                                <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Room Code</label>
                                <input 
                                    type="text" 
                                    value={roomInput}
                                    onChange={(e) => setRoomInput(e.target.value.toUpperCase())}
                                    className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-white text-sm mb-2 focus:outline-none focus:border-green-500 tracking-widest font-mono uppercase"
                                    placeholder="ABCD"
                                    maxLength={4}
                                />
                                <button 
                                    onClick={() => onJoinRoom(roomInput)}
                                    className="w-full py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded text-sm transition-colors"
                                >
                                    Join Room
                                </button>
                            </div>
                        </>
                    ) : (
                        <div className="flex flex-col gap-4 h-full">
                             {/* INTERMISSION / WAITING ROOM UI */}
                             <div className="flex justify-between items-center bg-slate-800 p-3 rounded">
                                 <div className="flex flex-col">
                                     <span className="text-xs text-slate-400 uppercase font-bold">Current Operation</span>
                                     <span className="text-2xl font-mono font-bold text-white tracking-widest">{roomCode}</span>
                                 </div>
                                 {isHost && <Crown className="text-yellow-500 w-6 h-6" />}
                             </div>

                             <div className="flex-1 bg-black/40 border border-slate-800 rounded p-4 overflow-y-auto">
                                 <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                                     <Users className="w-3 h-3" /> Mission Roster ({lobbyPlayers.length})
                                 </h3>
                                 <div className="space-y-2">
                                     {lobbyPlayers.map((p, i) => (
                                         <div key={i} className="flex items-center gap-3 bg-slate-900/50 p-2 rounded border border-slate-800/50">
                                             <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: p.color }}>
                                                 {p.name.substring(0,2)}
                                             </div>
                                             <span className={`text-sm font-bold ${p.isLocal ? 'text-white' : 'text-slate-300'}`}>
                                                 {p.name} {p.isLocal && '(YOU)'}
                                             </span>
                                             {i === 0 && <Crown className="w-3 h-3 text-yellow-600 ml-auto" />}
                                         </div>
                                     ))}
                                 </div>
                             </div>
                            
                            {isHost ? (
                                <button 
                                    onClick={() => onHostStart && onHostStart(selectedMap)}
                                    className="w-full py-4 bg-yellow-600 hover:bg-yellow-500 text-white font-bold text-xl rounded shadow-lg animate-pulse flex items-center justify-center gap-2"
                                >
                                    <Play className="fill-current w-5 h-5" /> START MATCH
                                </button>
                            ) : (
                                <div className="p-4 bg-slate-800/50 rounded text-center text-slate-400 text-sm animate-pulse flex items-center justify-center gap-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Waiting for Host to deploy...
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {lobbyStatus && !roomCode && (
                    <div className="col-span-1 md:col-span-2 mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded text-yellow-200 text-sm text-center">
                        {lobbyStatus}
                    </div>
                )}
            </div>
        </div>
      )
  }

  // MENU State logic
  if (menuView === 'MAP_SELECT') {
      return (
          <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black z-50 p-4">
              <div className="max-w-4xl w-full flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-300">
                    <div className="w-full flex items-center justify-start">
                          <button 
                            onClick={() => setMenuView('MAIN')} 
                            className="flex items-center text-slate-400 hover:text-white text-lg transition-colors group"
                        >
                            <ArrowLeft className="w-6 h-6 mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Main Menu
                        </button>
                    </div>
                    
                    <h1 className="text-4xl font-bold text-white tracking-tight uppercase mb-6 text-center w-full">Select Operation</h1>
                    
                    <div className="flex flex-col md:flex-row gap-6 w-full justify-center items-stretch h-96">
                        <button
                            onClick={() => onStartGame("Wasteland")}
                            className="flex-1 bg-amber-900/40 hover:bg-amber-800/60 border border-amber-600/30 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all hover:scale-105 group relative overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1542382156909-51c5eb51dc5d?q=80&w=1000')] bg-cover bg-center opacity-30 group-hover:opacity-50 transition-opacity"></div>
                            <div className="relative z-10 p-4 bg-black/50 rounded-full">
                                <MapIcon className="w-12 h-12 text-amber-500" />
                            </div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-widest relative z-10">Wasteland</h2>
                        </button>

                        <button
                            onClick={() => onStartGame("Erindale Park")}
                            className="flex-1 bg-emerald-900/40 hover:bg-emerald-800/60 border border-emerald-600/30 rounded-2xl p-8 flex flex-col items-center justify-center gap-4 transition-all hover:scale-105 group relative overflow-hidden"
                        >
                             <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1000')] bg-cover bg-center opacity-30 group-hover:opacity-50 transition-opacity"></div>
                             <div className="relative z-10 p-4 bg-black/50 rounded-full">
                                <Globe className="w-12 h-12 text-emerald-500" />
                            </div>
                            <h2 className="text-3xl font-black text-white uppercase tracking-widest relative z-10">Erindale Park</h2>
                        </button>
                    </div>
              </div>
          </div>
      );
  }

  // MENU State (Start Screen)
  return (
    <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center bg-black z-50 p-4">
      <div className="max-w-2xl w-full flex flex-col items-center gap-12">
        <h1 className="text-4xl md:text-6xl font-black text-white text-center tracking-tight leading-tight uppercase">
          Physics,<br/>Momentum<br/>& Light Simulator
        </h1>
        
        <div className="flex flex-col gap-6 w-full max-w-sm">
          <button 
            onClick={() => setMenuView('MAP_SELECT')}
            className="w-full py-5 bg-green-600 hover:bg-green-500 text-white font-bold text-xl rounded-lg shadow-lg hover:shadow-green-500/30 transition-all hover:-translate-y-1"
          >
            SINGLE PLAYER
          </button>

          <button 
            onClick={onEnterLobby}
            className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xl rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all hover:-translate-y-1"
          >
            MULTIPLAYER
          </button>
        </div>
      </div>
    </div>
  );
};

export default UIOverlay;