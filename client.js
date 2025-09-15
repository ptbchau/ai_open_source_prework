// Basic client that connects to a server (with a mock fallback),
// renders the world map and centers the local player ("Chau").

const canvas = document.getElementById('world-canvas');
const ctx = canvas.getContext('2d');

// Device pixel ratio handling for crisp rendering
let devicePixelRatioValue = Math.max(1, Math.floor(window.devicePixelRatio || 1));

// World image (map)
const worldImage = new Image();
worldImage.src = './world.jpg';
let worldLoaded = false;
worldImage.onload = () => {
  worldLoaded = true;
  state.ready = Boolean(worldLoaded && state.hasMe && state.hasAvatar);
  requestRender();
};

// Avatar image cache: url -> HTMLImageElement (loaded)
const avatarImageCache = new Map();
// Pre-rendered avatar surfaces: key -> {canvas, width, height}
// key is `${url}|${targetW}x${targetH}`
const avatarSurfaceCache = new Map();

// Label cache: username -> {canvas, width, height}
const labelCache = new Map();

// Simple state
const state = {
  me: {
    id: null,
    username: 'Chau',
    x: 0,
    y: 0,
    avatarUrl: null,
    avatarWidth: 64,
    avatarHeight: 64,
    facing: 'south',
    animationFrame: 0,
    avatarName: null,
  },
  players: new Map(), // id -> {username, x, y, avatarUrl, avatarWidth, avatarHeight}
  viewport: { width: 0, height: 0 },
  camera: { x: 0, y: 0 },
  connected: false,
  hasMe: false,
  hasAvatar: false,
  ready: false,
  pressedKeys: new Set(), // Track currently pressed movement keys
  lastFrameTime: 0,
  moveSpeed: 200, // pixels per second
  avatars: new Map(), // avatarName -> {frames: {north: [...], south: [...], east: [...]}}
  lastStopTime: 0, // Track when we last stopped moving
};

function setCanvasSize() {
  const cssWidth = window.innerWidth;
  const cssHeight = window.innerHeight;
  devicePixelRatioValue = Math.max(1, Math.floor(window.devicePixelRatio || 1));
  canvas.style.width = cssWidth + 'px';
  canvas.style.height = cssHeight + 'px';
  canvas.width = Math.floor(cssWidth * devicePixelRatioValue);
  canvas.height = Math.floor(cssHeight * devicePixelRatioValue);
  ctx.setTransform(devicePixelRatioValue, 0, 0, devicePixelRatioValue, 0, 0);
  state.viewport.width = cssWidth;
  state.viewport.height = cssHeight;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function computeCamera() {
  if (!worldLoaded) return;
  const worldW = worldImage.naturalWidth;
  const worldH = worldImage.naturalHeight;
  const { width: vw, height: vh } = state.viewport;
  const desiredX = state.me.x - vw / 2;
  const desiredY = state.me.y - vh / 2;
  // Clamped camera positions (do not reveal outside the map)
  const camX = clamp(desiredX, 0, Math.max(0, worldW - vw));
  const camY = clamp(desiredY, 0, Math.max(0, worldH - vh));
  state.camera.x = camX;
  state.camera.y = camY;
  // No centering offsets near edges; avatar will drift from center
  delete state.camera.offsetX;
  delete state.camera.offsetY;
}

function loadImageCached(url) {
  return new Promise((resolve, reject) => {
    if (!url) return reject(new Error('No URL for image'));
    const cached = avatarImageCache.get(url);
    if (cached && cached.complete) return resolve(cached);
    const img = cached || new Image();
    if (!cached) {
      avatarImageCache.set(url, img);
      img.crossOrigin = 'anonymous';
      img.src = url;
    }
    if (img.complete) return resolve(img);
    img.onload = () => resolve(img);
    img.onerror = reject;
  });
}

function getAvatarSurface(url, targetW, targetH, flipHorizontal = false) {
  const key = `${url}|${targetW || 0}x${targetH || 0}|${flipHorizontal ? 'flip' : 'normal'}`;
  const cached = avatarSurfaceCache.get(key);
  if (cached) return cached;
  const img = avatarImageCache.get(url);
  if (!img || !img.complete) return null;
  const { drawW, drawH } = computeAvatarDrawSize(img, targetW, targetH);
  const off = document.createElement('canvas');
  off.width = drawW;
  off.height = drawH;
  const offCtx = off.getContext('2d');
  offCtx.imageSmoothingEnabled = true;
  offCtx.imageSmoothingQuality = 'high';
  
  if (flipHorizontal) {
    offCtx.save();
    offCtx.scale(-1, 1);
    offCtx.drawImage(img, -drawW, 0, drawW, drawH);
    offCtx.restore();
  } else {
    offCtx.drawImage(img, 0, 0, drawW, drawH);
  }
  
  const surface = { canvas: off, width: drawW, height: drawH };
  avatarSurfaceCache.set(key, surface);
  return surface;
}

function getLabel(username) {
  const cached = labelCache.get(username);
  if (cached) return cached;
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d');
  // Configure font once for measurement and drawing
  const font = '14px sans-serif';
  offCtx.font = font;
  const paddingX = 6;
  const paddingY = 3;
  const metrics = offCtx.measureText(username);
  const textWidth = Math.ceil(metrics.width);
  const textHeight = 16; // approx for 14px font
  off.width = textWidth + paddingX * 2;
  off.height = textHeight + paddingY * 2;
  // Draw rounded rect background and text
  const radius = 4;
  const w = off.width;
  const h = off.height;
  offCtx.font = font;
  offCtx.textBaseline = 'middle';
  offCtx.textAlign = 'center';
  offCtx.fillStyle = 'rgba(0,0,0,0.6)';
  roundRect(offCtx, 0, 0, w, h, radius);
  offCtx.fill();
  offCtx.fillStyle = '#fff';
  offCtx.fillText(username, w / 2, h / 2);
  const result = { canvas: off, width: w, height: h };
  labelCache.set(username, result);
  return result;
}

function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r);
  c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h);
  c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r);
  c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

let needsRender = true;
function requestRender() {
  needsRender = true;
}

// Movement input handling
function handleKeyDown(event) {
  if (event.repeat) return; // Ignore auto-repeat
  
  const key = event.key;
  let direction = null;
  
  switch (key) {
    case 'ArrowUp': direction = 'up'; break;
    case 'ArrowDown': direction = 'down'; break;
    case 'ArrowLeft': direction = 'left'; break;
    case 'ArrowRight': direction = 'right'; break;
  }
  
  if (direction && !state.pressedKeys.has(direction)) {
    state.pressedKeys.add(direction);
    sendMove(direction);
    event.preventDefault();
  }
}

function handleKeyUp(event) {
  const key = event.key;
  let direction = null;
  
  switch (key) {
    case 'ArrowUp': direction = 'up'; break;
    case 'ArrowDown': direction = 'down'; break;
    case 'ArrowLeft': direction = 'left'; break;
    case 'ArrowRight': direction = 'right'; break;
  }
  
  if (direction && state.pressedKeys.has(direction)) {
    state.pressedKeys.delete(direction);
    if (state.pressedKeys.size === 0) {
      sendStop();
    }
    event.preventDefault();
  }
}

function sendMove(direction) {
  if (!state.connected || !socket) return;
  const message = { action: 'move', direction };
  socket.send(JSON.stringify(message));
}

function sendStop() {
  if (!state.connected || !socket) return;
  const message = { action: 'stop' };
  socket.send(JSON.stringify(message));
  state.lastStopTime = Date.now();
}

function updateMovement(deltaTime) {
  if (state.pressedKeys.size === 0) return;
  
  const speed = state.moveSpeed * deltaTime; // pixels this frame
  let dx = 0, dy = 0;
  
  // Combine pressed directions
  if (state.pressedKeys.has('up')) dy -= speed;
  if (state.pressedKeys.has('down')) dy += speed;
  if (state.pressedKeys.has('left')) dx -= speed;
  if (state.pressedKeys.has('right')) dx += speed;
  
  // Normalize diagonal movement
  if (dx !== 0 && dy !== 0) {
    const length = Math.sqrt(dx * dx + dy * dy);
    dx = (dx / length) * speed;
    dy = (dy / length) * speed;
  }
  
  // Update facing direction based on movement
  if (dx > 0) state.me.facing = 'east';
  else if (dx < 0) state.me.facing = 'west';
  else if (dy < 0) state.me.facing = 'north';
  else if (dy > 0) state.me.facing = 'south';
  
  // Update animation frame (cycle through 0, 1, 2)
  state.me.animationFrame = (state.me.animationFrame + 1) % 3;
  
  // Update position and clamp to world bounds
  if (worldLoaded) {
    const worldW = worldImage.naturalWidth;
    const worldH = worldImage.naturalHeight;
    state.me.x = clamp(state.me.x + dx, 0, worldW);
    state.me.y = clamp(state.me.y + dy, 0, worldH);
  } else {
    state.me.x += dx;
    state.me.y += dy;
  }
  
  // Update avatar frame based on facing direction (only if changed)
  if (state.pressedKeys.size > 0) {
    updateAvatarFrame();
  }
  
  requestRender();
}

function clearMovement() {
  state.pressedKeys.clear();
  sendStop();
}

function updateAvatarFrame() {
  if (!state.me.avatarName) {
    console.warn(`My avatar missing: no avatar name`);
    return;
  }
  
  // Try to get avatar definition, with fallback to 'default' if the specific avatar doesn't exist
  let avatarDef = state.avatars.get(state.me.avatarName);
  if (!avatarDef && state.avatars.has('default')) {
    console.log(`Using fallback avatar 'default' instead of '${state.me.avatarName}'`);
    avatarDef = state.avatars.get('default');
  }
  
  if (!avatarDef) {
    console.warn(`My avatar missing: name=${state.me.avatarName}, hasAvatar=${state.avatars.has(state.me.avatarName)}`);
    return;
  }
  const facing = state.me.facing;
  const frameIndex = state.me.animationFrame;
  
  let frameUrl = null;
  if (facing === 'west') {
    // Use east frame and flip horizontally
    const eastFrames = avatarDef.frames['east'] || [];
    frameUrl = eastFrames[frameIndex] || eastFrames[0] || null;
  } else {
    const frames = avatarDef.frames[facing] || [];
    frameUrl = frames[frameIndex] || frames[0] || null;
  }
  
  if (!frameUrl) {
    console.warn(`My avatar has no frame for facing: ${facing}, frame: ${frameIndex}`);
    return;
  }
  
  if (frameUrl && frameUrl !== state.me.avatarUrl) {
    state.me.avatarUrl = frameUrl;
    // Preload the new frame
    loadImageCached(frameUrl);
  }
}

function updateAllPlayerFrames() {
  for (const [playerId, player] of state.players) {
    updatePlayerFrame(player);
  }
}

function updatePlayerFrame(player) {
  if (!player.avatarName) {
    console.warn(`Player ${player.username} has no avatar name`);
    return;
  }
  
  // Try to get avatar definition, with fallback to 'default' if the specific avatar doesn't exist
  let avatarDef = state.avatars.get(player.avatarName);
  if (!avatarDef) {
    console.log(`Player ${player.username} avatar '${player.avatarName}' not found. Available avatars:`, Array.from(state.avatars.keys()));
    // Try to find any available avatar as fallback
    const availableAvatars = Array.from(state.avatars.keys());
    if (availableAvatars.length > 0) {
      const fallbackAvatar = availableAvatars[0]; // Use first available avatar
      console.log(`Player ${player.username} using fallback avatar '${fallbackAvatar}' instead of '${player.avatarName}'`);
      avatarDef = state.avatars.get(fallbackAvatar);
    }
  }
  
  if (!avatarDef) {
    console.warn(`Player ${player.username} has missing avatar: ${player.avatarName} and no default fallback`);
    console.log(`Available avatars:`, Array.from(state.avatars.keys()));
    return;
  }
  const facing = player.facing;
  const frameIndex = player.animationFrame;
  
  let frameUrl = null;
  if (facing === 'west') {
    // Use east frame and flip horizontally
    const eastFrames = avatarDef.frames['east'] || [];
    frameUrl = eastFrames[frameIndex] || eastFrames[0] || null;
  } else {
    const frames = avatarDef.frames[facing] || [];
    frameUrl = frames[frameIndex] || frames[0] || null;
  }
  
  if (!frameUrl) {
    console.warn(`Player ${player.username} has no frame for facing: ${facing}, frame: ${frameIndex}`);
    return;
  }
  
  if (frameUrl && frameUrl !== player.avatarUrl) {
    // Check if the frame URL looks corrupted (too short for a valid image)
    if (frameUrl.startsWith('data:image/') && frameUrl.length < 1000) {
      console.warn(`Player ${player.username} has corrupted avatar frame (too short: ${frameUrl.length} chars), using fallback`);
      // Use default avatar as fallback
      const defaultAvatar = state.avatars.get('default');
      if (defaultAvatar && defaultAvatar.frames) {
        const defaultFrames = defaultAvatar.frames[facing] || defaultAvatar.frames['south'] || [];
        frameUrl = defaultFrames[frameIndex] || defaultFrames[0] || null;
        if (frameUrl) {
          console.log(`Player ${player.username} using default avatar fallback`);
        }
      }
    }
    
    if (frameUrl) {
      player.avatarUrl = frameUrl;
      // Preload the new frame
      loadImageCached(frameUrl).catch(err => {
        console.warn(`Failed to load avatar frame for ${player.username}:`, err);
        // Try default avatar as final fallback
        const defaultAvatar = state.avatars.get('default');
        if (defaultAvatar && defaultAvatar.frames) {
          const defaultFrames = defaultAvatar.frames[facing] || defaultAvatar.frames['south'] || [];
          const fallbackUrl = defaultFrames[frameIndex] || defaultFrames[0] || null;
          if (fallbackUrl) {
            console.log(`Player ${player.username} using default avatar after load failure`);
            player.avatarUrl = fallbackUrl;
            loadImageCached(fallbackUrl);
          }
        }
      });
    }
  }
}

function render() {
  if (!needsRender) return;
  needsRender = false;

  // Until we have both the world and avatar ready, do not draw the world (avoid flash)
  if (!worldLoaded || !state.ready) {
    const { width: vw, height: vh } = state.viewport;
    ctx.clearRect(0, 0, vw, vh);
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);
    // Draw centered loading label
    const label = 'Loading...';
    const font = '20px sans-serif';
    ctx.font = font;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const paddingX = 12;
    const paddingY = 6;
    const metrics = ctx.measureText(label);
    const textW = Math.ceil(metrics.width);
    const textH = 24;
    const boxW = textW + paddingX * 2;
    const boxH = textH + paddingY * 2;
    const boxX = Math.round(vw / 2 - boxW / 2);
    const boxY = Math.round(vh / 2 - boxH / 2);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    roundRect(ctx, boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillText(label, boxX + paddingX, boxY + boxH / 2);
    return;
  }

  computeCamera();

  const { width: vw, height: vh } = state.viewport;
  const { x: camX, y: camY } = state.camera;

  // Clear in CSS pixels (ctx is already scaled by DPR)
  ctx.clearRect(0, 0, vw, vh);

  // Background: draw only the visible part of the world using source rect
  // Compute how much of the world we can sample based on camera clamp
  const sWidth = Math.min(vw, worldImage.naturalWidth - camX);
  const sHeight = Math.min(vh, worldImage.naturalHeight - camY);
  // Fill background (outside map bounds) to avoid transparency
  if (sWidth < vw || sHeight < vh) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, vw, vh);
  }
  if (sWidth > 0 && sHeight > 0) {
    ctx.drawImage(
      worldImage,
      camX, // sx
      camY, // sy
      sWidth, // sWidth
      sHeight, // sHeight
      0, // dx
      0, // dy
      sWidth, // dWidth
      sHeight // dHeight
    );
  }

  // Draw all players (including me)
  const allPlayers = [state.me, ...Array.from(state.players.values())];
  
  for (const player of allPlayers) {
    if (!player.avatarUrl) {
      console.warn(`Player ${player.username} has no avatarUrl`);
      continue;
    }
    if (!avatarImageCache.has(player.avatarUrl)) {
      console.warn(`Player ${player.username} avatar not loaded yet: ${player.avatarUrl}`);
      continue;
    }
    
    // Viewport culling - only draw players visible on screen
    const screenX = Math.round(player.x - camX);
    const screenY = Math.round(player.y - camY);
    const avatarSize = 64; // Approximate avatar size for culling
    if (screenX < -avatarSize || screenX > vw + avatarSize || 
        screenY < -avatarSize || screenY > vh + avatarSize) {
      continue; // Skip this player - not visible
    }
    
    const flipHorizontal = player.facing === 'west';
    const surface = getAvatarSurface(player.avatarUrl, player.avatarWidth, player.avatarHeight, flipHorizontal);
    if (surface) {
      const drawX = Math.round(screenX - surface.width / 2);
      const drawY = Math.round(screenY - surface.height / 2);
      ctx.drawImage(surface.canvas, drawX, drawY);

      // Label centered above avatar
      const label = getLabel(player.username);
      const labelX = Math.round(screenX - label.width / 2);
      const labelY = Math.round(drawY - label.height - 6);
      ctx.drawImage(label.canvas, labelX, labelY);
    }
  }
}

function computeAvatarDrawSize(img, targetW, targetH) {
  const naturalW = img.naturalWidth || targetW || 64;
  const naturalH = img.naturalHeight || targetH || 64;
  if (!targetW && !targetH) return { drawW: naturalW, drawH: naturalH };
  if (targetW && targetH) return { drawW: targetW, drawH: targetH };
  if (targetW) {
    const scale = targetW / naturalW;
    return { drawW: targetW, drawH: Math.round(naturalH * scale) };
  }
  const scale = targetH / naturalH;
  return { drawW: Math.round(naturalW * scale), drawH: targetH };
}

// Animation loop
function tick(currentTime) {
  // Calculate delta time for smooth movement
  if (state.lastFrameTime === 0) {
    state.lastFrameTime = currentTime;
  }
  const deltaTime = (currentTime - state.lastFrameTime) / 1000; // Convert to seconds
  state.lastFrameTime = currentTime;
  
  // Update movement if keys are pressed
  updateMovement(deltaTime);
  
  render();
  requestAnimationFrame(tick);
}

// Mock server join fallback
function mockJoin() {
  // Position roughly center of world if possible
  const worldW = worldLoaded ? worldImage.naturalWidth : 4096;
  const worldH = worldLoaded ? worldImage.naturalHeight : 4096;
  const startX = Math.floor(worldW / 2);
  const startY = Math.floor(worldH / 2);
  state.me.id = 'mock-me';
  state.me.x = startX;
  state.me.y = startY;
  state.me.facing = 'south';
  state.me.animationFrame = 0;
  state.me.avatarName = 'mock-avatar';
  state.me.avatarUrl = './mmorpg.gif'; // placeholder local asset (mock only)
  // Preload avatar
  loadImageCached(state.me.avatarUrl).then(() => {
    state.hasMe = true;
    state.hasAvatar = true;
    state.ready = Boolean(worldLoaded && state.hasMe && state.hasAvatar);
    requestRender();
  });
  requestRender();
}

// WebSocket setup with graceful fallback
let socket; // Make socket accessible to movement functions
function connectWebSocket() {
  // Use the shared game server from the README
  const url = 'wss://codepath-mmorg.onrender.com';
  try {
    socket = new WebSocket(url);
  } catch (e) {
    mockJoin();
    return;
  }

  let joined = false;
  let timeoutId = setTimeout(() => {
    // Neither opened nor errored in time → fallback
    try { socket.close(); } catch (_) {}
    if (!joined) mockJoin();
  }, 3000);

  socket.addEventListener('open', () => {
    state.connected = true;
    // Send join_game message without avatar; server will assign one
    const joinMsg = { action: 'join_game', username: state.me.username };
    socket.send(JSON.stringify(joinMsg));
  });

  socket.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data);
      // Handle successful join per README schema
      if (data.action === 'join_game' && data.success && !joined) {
        joined = true;
        clearTimeout(timeoutId);
        const playerId = data.playerId;
        const players = data.players || {};
        const avatars = data.avatars || {};
        const meServer = players[playerId];
        if (meServer) {
          state.me.id = meServer.id;
          state.me.username = meServer.username || state.me.username;
          state.me.x = meServer.x;
          state.me.y = meServer.y;
          state.me.facing = meServer.facing || 'south';
          state.me.animationFrame = typeof meServer.animationFrame === 'number' ? meServer.animationFrame : 0;
          state.me.avatarName = meServer.avatar;
          
          // Store all avatar definitions
          for (const [avatarName, avatarDef] of Object.entries(avatars)) {
            state.avatars.set(avatarName, avatarDef);
          }
          
          // Store all other players
          for (const [playerId, playerData] of Object.entries(players)) {
            if (playerId !== state.me.id) {
              state.players.set(playerId, {
                id: playerData.id,
                username: playerData.username,
                x: playerData.x,
                y: playerData.y,
                facing: playerData.facing || 'south',
                animationFrame: playerData.animationFrame || 0,
                avatarName: playerData.avatar,
                avatarUrl: null, // Will be set when we get the frame
                avatarWidth: undefined,
                avatarHeight: undefined,
              });
            }
          }
          
          
          // Set initial avatar frames for all players
          updateAllPlayerFrames();
          
          // Ensure my avatar frame is set
          updateAvatarFrame();
          
          // No explicit size -> render at natural size while preserving aspect ratio
          state.me.avatarWidth = undefined;
          state.me.avatarHeight = undefined;
          state.hasMe = true;
          if (state.me.avatarUrl) {
            await loadImageCached(state.me.avatarUrl);
          }
          state.hasAvatar = true; // Set to true regardless, since we have avatar data
        }
        state.ready = Boolean(worldLoaded && state.hasMe && state.hasAvatar);
        requestRender();
        return;
      }
      
      // Handle player movement updates
      if (data.action === 'players_moved' && data.players) {
        for (const [playerId, playerData] of Object.entries(data.players)) {
          if (playerId === state.me.id) {
            // Only update my position from server if I'm not currently moving
            // and enough time has passed since I stopped (to allow server to catch up)
            const timeSinceStop = Date.now() - state.lastStopTime;
            if (state.pressedKeys.size === 0 && timeSinceStop > 100) {
              state.me.x = playerData.x;
              state.me.y = playerData.y;
            }
            state.me.facing = playerData.facing || state.me.facing;
            state.me.animationFrame = playerData.animationFrame || state.me.animationFrame;
            updateAvatarFrame();
          } else {
            // Update other players (server is always authoritative for them)
            const player = state.players.get(playerId);
            if (player) {
              player.x = playerData.x;
              player.y = playerData.y;
              player.facing = playerData.facing || player.facing;
              player.animationFrame = playerData.animationFrame || player.animationFrame;
              updatePlayerFrame(player);
            }
          }
        }
        requestRender();
        return;
      }
      
      // Handle new player joining
      if (data.action === 'player_joined' && data.player && data.avatar) {
        const playerId = data.player.id;
        if (playerId !== state.me.id) {
          state.players.set(playerId, {
            id: data.player.id,
            username: data.player.username,
            x: data.player.x,
            y: data.player.y,
            facing: data.player.facing || 'south',
            animationFrame: data.player.animationFrame || 0,
            avatarName: data.player.avatar,
            avatarUrl: null,
            avatarWidth: undefined,
            avatarHeight: undefined,
          });
          
          // Store the new avatar definition
          state.avatars.set(data.avatar.name, data.avatar);
          
          // Set the player's avatar frame
          updatePlayerFrame(state.players.get(playerId));
          requestRender();
        }
        return;
      }
      
      // Handle player leaving
      if (data.action === 'player_left' && data.playerId) {
        state.players.delete(data.playerId);
        requestRender();
        return;
      }
    } catch (err) {
      // Ignore malformed messages for now
    }
  });

  socket.addEventListener('error', () => {
    clearTimeout(timeoutId);
    if (!joined) mockJoin();
  });

  socket.addEventListener('close', () => {
    clearTimeout(timeoutId);
    if (!joined) mockJoin();
  });
}

// Init
setCanvasSize();
window.addEventListener('resize', () => { setCanvasSize(); requestRender(); });
window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', handleKeyUp);
window.addEventListener('blur', clearMovement);
window.addEventListener('visibilitychange', () => {
  if (document.hidden) clearMovement();
});
computeCamera();
connectWebSocket();
tick();


