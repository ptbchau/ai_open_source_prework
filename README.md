# Mini Multiplayer Online Role Playing Game (MMORPG) Client

A web-based multiplayer game where players can explore a shared world, move around, and interact with other players in real-time.

![Animation of game demo](demo.gif)

## 🎮 Features

### Core Gameplay
- **Dual Movement Controls**: Arrow keys and click-to-move functionality
- **Real-time Multiplayer**: Connect to shared game server with live player updates
- **Avatar Animations**: Directional sprites with walking animations (north, south, east, west)
- **World Exploration**: Navigate a large world map with camera following

### Visual Elements
- **Mini-map**: Overview map showing all player positions and camera viewport
- **Player Labels**: Username display above each player
- **Visual Feedback**: Click target indicators and smooth animations
- **Loading Screen**: Progress indication during game initialization
- **Responsive Design**: Works on different screen sizes with device pixel ratio support

### Technical Features
- **Client-side Prediction**: Smooth movement with server synchronization
- **Performance Optimized**: Viewport culling and avatar caching
- **Robust Error Handling**: Graceful fallback for corrupted avatar data and network issues
- **WebSocket Communication**: Real-time server connection with automatic fallback

## 🚀 Quick Start

### Running the Game
 **Simple Method**: Open `index.html` directly in your web browser

### Browser Requirements
- Modern web browser with HTML5 Canvas support
- JavaScript enabled
- WebSocket support (all modern browsers)

## 🎯 Controls

### Movement
- **Arrow Keys**: Move in four directions (up, down, left, right)
- **Click-to-Move**: Click anywhere on the map to move there
- **Combined**: Switch between controls seamlessly

### Visual Indicators
- **Green Dot** (mini-map): Your player position
- **Red Dots** (mini-map): Other players
- **White Rectangle** (mini-map): Your current camera view
- **Green Crosshair**: Click-to-move target indicator

## 🏗️ Technical Implementation

### Architecture
- **Frontend**: HTML5 Canvas with JavaScript
- **Communication**: WebSocket connection to game server
- **Rendering**: Custom 2D graphics engine with DPR support
- **State Management**: Client-side prediction with server authority

### Key Components

#### Movement System
- **Client Prediction**: Immediate response to input
- **Server Sync**: Position correction and validation
- **Smooth Interpolation**: Frame-based movement with delta time
- **Boundary Clamping**: Prevents movement outside world bounds

#### Rendering Engine
- **Avatar Caching**: Pre-rendered surfaces for performance
- **Viewport Culling**: Only render visible elements
- **Directional Sprites**: Proper facing and animation frames
- **Mini-map Scaling**: Efficient world overview rendering
- **Loading States**: Centered loading screen with progress indication

#### Network Layer
- **WebSocket Connection**: Real-time bidirectional communication
- **Message Protocol**: JSON-based server communication
- **Fallback Handling**: Graceful degradation when server unavailable
- **Error Recovery**: Automatic reconnection and state restoration
- **Data Validation**: Corrupted avatar detection and fallback mechanisms

## 📁 File Structure

```
mmorpg-client/
├── index.html                            # Main game page
├── client.js                             # Game logic and WebSocket communication
├── styles.css                            # Styling and layout
├── world.jpg                             # Game world map (2048x2048)
├── mmorpg.gif                            # Demo animation (from game server)
├── demo.gif                              # Demo animation (converted from MP4)
└── README_game-server-instruction.md     # Instruction to connect to game server
└── README.md                             # This file
```

## 🔧 Configuration

### Server Connection
The game connects to: `wss://codepath-mmorg.onrender.com`

### Customization Options
- **Movement Speed**: Adjustable in `client.js` (default: 200 pixels/second)
- **Mini-map Size**: Configurable overlay dimensions
- **Avatar Size**: Server-controlled with aspect ratio preservation

## 🎨 Game Mechanics

### Player System
- **Unique IDs**: Server-assigned player identification
- **Avatar Assignment**: Automatic avatar selection on join
- **Position Tracking**: Real-time coordinate updates
- **Animation States**: Walking animations with frame cycling

### World System
- **Map Boundaries**: 2048x2048 pixel world
- **Camera Clamping**: Prevents viewing outside world edges
- **Coordinate System**: Top-left origin (0,0) to bottom-right (2048,2048)

### Multiplayer Features
- **Live Updates**: Real-time player position broadcasting
- **Player Join/Leave**: Dynamic player list management
- **Avatar Sharing**: Consistent avatar data across clients

## 🐛 Troubleshooting

### Common Issues

**Game doesn't load:**
- Ensure you're using a local web server (not file://)
- Check browser console for JavaScript errors
- Verify all files are present in the directory

**No other players visible:**
- Check WebSocket connection status
- Verify server is running and accessible
- Look for network errors in browser console

**Movement feels laggy:**
- Check network connection
- Verify client-side prediction is working
- Look for server response delays

**Mini-map not updating:**
- Check if `state.minimapNeedsUpdate` is being triggered
- Verify player position updates are received
- Ensure camera movement is detected

## 🚀 Future Enhancements

### Planned Features
- **WASD Controls**: Alternative keyboard input
- **Player List**: Online player roster
- **Chat System**: Real-time messaging
- **Settings Panel**: Customization options
- **Sound Effects**: Audio feedback for actions

### Technical Improvements
- **Mobile Support**: Touch controls and responsive UI
- **Performance**: Further rendering optimizations
- **Persistence**: Player state saving
- **Modding**: Custom avatar and world support

## 📝 Development Notes

### Architecture Decisions
- **Canvas over DOM**: Better performance for game graphics
- **Client Prediction**: Improved responsiveness over pure server authority
- **Modular Design**: Separated concerns for maintainability
- **Error Resilience**: Graceful handling of network/server issues

### Performance Optimizations
- **Avatar Surface Caching**: Pre-rendered sprites for efficiency
- **Viewport Culling**: Only render visible game elements
- **Delta Time Movement**: Frame-rate independent animation
- **Selective Updates**: Mini-map only redraws when needed
- **Loading Optimization**: Prevents rendering until essential assets are loaded

## 🤝 Contributing

This is a learning project demonstrating:
- Real-time multiplayer game development
- WebSocket communication patterns
- HTML5 Canvas graphics programming
- Client-server synchronization techniques

## 📄 License

This project is for educational purposes as part of the CodePath MMORPG prework assignment.

---

**Enjoy exploring the world and meeting other players!** 🌍👥
