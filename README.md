# Real-Time Collaborative Drawing Canvas

A production-quality multi-user drawing application with real-time synchronization, global undo/redo, and efficient canvas rendering.

## Features

- **Real-time Collaborative Drawing**: Multiple users draw simultaneously on the same canvas
- **Global Undo/Redo**: Undo and redo operations that affect all users consistently
- **Drawing Tools**: Brush and eraser with adjustable stroke width
- **Color Selection**: 6 preset colors plus custom color picker
- **User Indicators**: See other users' cursor positions with their names
- **Room System**: Create isolated drawing sessions with unique room IDs
- **Responsive Design**: Works on desktop and tablet devices

## Technology Stack

- **Frontend**: Vanilla JavaScript/TypeScript + HTML5 Canvas
- **Backend**: Node.js + Express + Socket.io
- **Real-time Communication**: WebSockets via Socket.io
- **Architecture**: Event-driven, client-server model

## Live Demo

Try the app here: **https://project-production-4d50.up.railway.app**

✅ No installation required  
✅ Works on desktop & tablet  
✅ Supports real-time multi-user drawing  


## Getting Started

### Prerequisites
- Node.js 16+ installed
- npm installed

### Installation

1. Clone the repository:
`
git clone <https://github.com/krishnasingh-09/CollaborativeCanvas.git> `
`
cd CollaborativeCanvas
`

2. Install dependencies:
`
npm install
`

3. Start the server:
`
npm start
`

The server runs on `http://localhost:3000`

### Development Mode
For automatic restart on file changes:
`
npm run dev
`

## How to Test with Multiple Users

### Local Testing (Same Computer)
1. Start the server: `npm start`
2. Open two browser windows/tabs to `http://localhost:3000`
3. Both should be in the default room: `default-room`
4. Start drawing in one window, see it appear instantly in the other
5. Test undo/redo - all users see the same state

### Network Testing (Multiple Computers)
1. Note the server machine's IP address (e.g., 192.XXX.X.XXX)
2. Start server on that machine: `npm start`
3. From another computer, visit: `http://192.XXX.X.XXX:3000`
4. Verify real-time drawing sync

### Room Testing
1. In Browser A: Enter room ID "room1" and name "Alice", click Join
2. In Browser B: Enter room ID "room2" and name "Bob", click Join
3. Verify: Users can't see each other's drawings (separate canvases)
4. In Browser C: Enter room ID "room1" and name "Charlie", click Join
5. Verify: Charlie sees Alice's drawings but not Bob's

### Undo/Redo Testing
1. User A draws a line
2. User B draws a circle
3. User A clicks "Undo"
4. **Expected**: Line disappears, circle remains for all users
5. User A clicks "Redo"
6. **Expected**: Line reappears for all users

## Usage

### Drawing
- **Brush Tool**: Left-click and drag to draw
- **Eraser Tool**: Left-click and drag to erase (removes pixels)
- **Stroke Width**: Adjust with slider (1-50px)
- **Color**: Click preset colors or use color picker for custom

### Editing
- **Undo**: Removes last drawn operation globally
- **Redo**: Restores last undone operation
- **Clear**: Erases entire canvas for all users (confirmation required)

### Collaboration
- Enter your name in "User Info" section
- Enter a room ID (e.g., "project-1", "sketch-v2")
- Click "Join" to create or join that room
- Invite others to use the same room ID
- See connected users in the left panel
- Watch cursor positions of other users in real-time

## Architecture Overview

For detailed architecture documentation, see [ARCHITECTURE.md](ARCHITECTURE.md).

### High-Level Data Flow
```
User A Draws Line
    ↓
canvas.js: startDrawing() → draw() → stopDrawing()
    ↓
websocket.js: sendDrawing()
    ↓
Socket.io emit 'draw' to server
    ↓
server.js: socket.on('draw')
    ↓
drawing-state.js: addOperation() adds to history
    ↓
io.to(room).emit('new-draw-operation')
    ↓
All Clients: socket.on('new-draw-operation')
    ↓
websocket.js: drawRemoteLine()
    ↓
User B's Canvas: Line appears instantly
```


## Performance Characteristics

### Observed Performance
- **Local Drawing FPS**: ~60 FPS at 3px brush width
- **Remote Drawing Latency**: ~20-50ms (network dependent)
- **Undo/Redo Response**: ~30-100ms (depends on operation count)
- **Network Usage**: ~100 bytes per line segment, ~50 bytes per cursor update
- **Memory**: ~50 MB for 1920x1080 canvas with typical drawing

### Tested Scenarios
- ✅ 4 simultaneous users drawing
- ✅ Rapid undo/redo operations (10+ per second)
- ✅ Simulated 100ms network latency
- ✅ 1000+ operations in history

## Known Issues & Limitations

### Current Limitations
1. **No Persistence**: Canvas is cleared when server restarts (feature: save sessions)
2. **Raster Drawing**: Drawing is pixel-based, not vector (can't edit strokes)
3. **Linear Undo**: Undo removes all operations after it (no branching)
4. **Single Server**: No automatic failover or scaling (planned for production)
5. **No Authentication**: Any user can join any room

### Resolved Issues
- ✅ Canvas resize: Handled with responsive sizing
- ✅ Network drops: Automatic reconnection with exponential backoff
- ✅ Concurrent draws: No conflicts due to sequential server processing
- ✅ Eraser transparency: Uses canvas composition modes

## Development Time

- **Backend Setup**: 2 hours
- **Frontend Canvas Logic**: 3 hours
- **WebSocket Communication**: 2.5 hours
- **Global Undo/Redo**: 2.5 hours
- **UI/UX & Polish**: 2 hours
- **Testing & Documentation**: 2.5 hours

**Total**: ~14.5 hours

## Future Enhancements

### Short Term
- [ ] Drawing persistence (save/load sessions)
- [ ] Canvas export (PNG, SVG)
- [ ] Shapes tool (rectangle, circle, line)
- [ ] Text annotation

### Medium Term
- [ ] User authentication
- [ ] Session history
- [ ] Drawing layers
- [ ] Performance metrics display

### Long Term
- [ ] Horizontal scaling
- [ ] Video/audio chat
- [ ] Mobile app
- [ ] Drawing marketplace

## Contributing

Feel free to open issues and pull requests for any improvements.

## Support

If you encounter issues:

1. Check the browser console for errors (F12)
2. Verify the server is running
3. Clear browser cache (Ctrl+Shift+Delete)
4. Try a different browser
5. Check network connectivity

For detailed troubleshooting, see ARCHITECTURE.md

---

**Created**: November 2025                                                                                                     
**Status**: Production Ready
**Last Updated**: November 8, 2025
