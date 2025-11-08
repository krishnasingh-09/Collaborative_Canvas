# Real-Time Collaborative Drawing Canvas - Architecture

## Overview

This document describes the architecture, design decisions, and technical implementation of the collaborative drawing canvas application. The system enables multiple users to draw simultaneously on a shared canvas with real-time synchronization, global undo/redo, and conflict-free operation history.

## Data Flow Diagram

### Single Drawing Stroke Flow (User A → Server → User B)

\`\`\`
USER A CLIENT SIDE:
  1. mousedown on canvas at (100, 150)
     └─> canvasDrawing.startDrawing(100, 150)
     └─> Local state initialized

  2. mousemove to (105, 155)
     └─> canvasDrawing.draw(105, 155)
     └─> Line drawn locally with requestAnimationFrame
     └─> websocket.sendDrawing(100, 150, 105, 155, color, width)
     
  3. mousemove to (110, 160)
     └─> canvasDrawing.draw(110, 160)
     └─> Line drawn locally
     └─> websocket.sendDrawing(105, 155, 110, 160, color, width)

  4. mouseup
     └─> canvasDrawing.stopDrawing()
     └─> Client-side drawing complete

SERVER SIDE:
  1. socket.on('draw', data)
     └─> drawingState.addOperation({
           type: 'draw',
           userId: 'user-A',
           x0: 100, y0: 150, x1: 105, y1: 155,
           color: '#FF0000',
           width: 3,
           timestamp: 1699276800000
         })
     └─> Operation appended to history array
     └─> Redo stack cleared (new operation resets redo)

  2. io.to(roomId).emit('new-draw-operation', {
       userId: 'user-A',
       x0: 100, y0: 150, x1: 105, y1: 155,
       color: '#FF0000',
       width: 3
     })
     └─> Broadcast to all clients in room

USER B CLIENT SIDE:
  1. socket.on('new-draw-operation', data)
     └─> websocket.drawRemoteLine(100, 150, 105, 155, '#FF0000', 3)
     └─> Line drawn on User B's canvas immediately
     └─> No redraw of entire history needed for real-time strokes

USER B CANVAS:
  Visual update: User A's line appears in real-time
\`\`\`

### Undo/Redo Flow (All Users)

\`\`\`
USER A:
  1. Click "Undo" button
     └─> websocket.requestUndo()
     └─> socket.emit('request-undo', { roomId })

SERVER:
  1. socket.on('request-undo')
     └─> drawingState.undoLastOperation()
     └─> Last operation moved from history to redoStack
     
  2. io.to(roomId).emit('drawing-history', {
       operations: drawingState.getHistory(),
       isUndoRedo: true
     })
     └─> Broadcast full history to all users

ALL CLIENTS (A, B, C, ...):
  1. socket.on('drawing-history', data with isUndoRedo: true)
     └─> canvasDrawing.redrawCanvas(data.operations)
     └─> Canvas cleared completely
     └─> All operations replayed in order
     └─> Result: Everyone sees the same state without the undone operation

USER A:
  2. Click "Redo" button
     └─> websocket.requestRedo()
     └─> socket.emit('request-redo', { roomId })

SERVER:
  1. socket.on('request-redo')
     └─> drawingState.redoOperation()
     └─> Last operation moved from redoStack back to history
     
  2. io.to(roomId).emit('drawing-history', {
       operations: drawingState.getHistory(),
       isUndoRedo: true
     })

ALL CLIENTS:
  1. Receive full history and redraw with the re-added operation
\`\`\`

## WebSocket Protocol

### Client → Server Events

#### `join-room`
\`\`\`javascript
{
  roomId: "default-room",
  userId: "user-1699276800000-abc123",
  userName: "Alice"
}
\`\`\`
Sent when a user connects or changes rooms. Server responds with full drawing history.

#### `draw`
\`\`\`javascript
{
  roomId: "default-room",
  userId: "user-1699276800000-abc123",
  x0: 100,      // Starting X coordinate
  y0: 150,      // Starting Y coordinate
  x1: 105,      // Ending X coordinate
  y1: 155,      // Ending Y coordinate
  color: "#FF0000",  // Color or "ERASER"
  width: 3      // Stroke width in pixels
}
\`\`\`
Sent on every mousemove during drawing. Contains a single line segment for real-time responsiveness.

#### `cursor-move`
\`\`\`javascript
{
  roomId: "default-room",
  userId: "user-1699276800000-abc123",
  x: 105,
  y: 155
}
\`\`\`
Sent frequently during mousemove to update cursor position for remote users.

#### `request-undo`
\`\`\`javascript
{
  roomId: "default-room"
}
\`\`\`
Request to undo the last global operation.

#### `request-redo`
\`\`\`javascript
{
  roomId: "default-room"
}
\`\`\`
Request to redo the last undone operation.

#### `clear-canvas`
\`\`\`javascript
{
  roomId: "default-room"
}
\`\`\`
Request to clear the entire canvas.

### Server → Client Events

#### `drawing-history`
\`\`\`javascript
{
  operations: [
    {
      type: "draw",
      userId: "user-1",
      x0: 100, y0: 150, x1: 105, y1: 155,
      color: "#FF0000",
      width: 3,
      timestamp: 1699276800000
    },
    // ... more operations
  ],
  userId: "user-B",
  color: "#4ECDC4",  // User's assigned color
  users: [
    { socketId: "...", name: "Alice" },
    { socketId: "...", name: "Bob" }
  ],
  cursors: [
    { userId: "user-1", x: 100, y: 150 },
    { userId: "user-3", x: 200, y: 250 }
  ],
  isUndoRedo: true,  // Optional: indicates this is from undo/redo
  isCleared: true    // Optional: indicates canvas was cleared
}
\`\`\`
Sent when user joins (full state) or after undo/redo (to resync all clients).

#### `new-draw-operation`
\`\`\`javascript
{
  userId: "user-1",
  x0: 100,
  y0: 150,
  x1: 105,
  y1: 155,
  color: "#FF0000",
  width: 3
}
\`\`\`
Broadcast to all users when someone draws. Used for real-time drawing without full history resync.

#### `user-cursors`
\`\`\`javascript
{
  cursors: [
    { userId: "user-1", x: 100, y: 150 },
    { userId: "user-3", x: 200, y: 250 }
  ],
  users: [
    { userId: "user-1", userName: "Alice", color: "#FF0000" },
    { userId: "user-3", userName: "Charlie", color: "#0000FF" }
  ]
}
\`\`\`
Sent frequently to update remote cursor positions.

#### `user-joined`
\`\`\`javascript
{
  userId: "user-2",
  userName: "Bob",
  color: "#4ECDC4",
  users: [
    { socketId: "...", name: "Alice" },
    { socketId: "...", name: "Bob" }
  ]
}
\`\`\`
Broadcast when a new user joins the room.

#### `user-left`
\`\`\`javascript
{
  userId: "user-2"
}
\`\`\`
Broadcast when a user leaves or disconnects.

## Global Undo/Redo Strategy

### Challenge
Traditional undo/redo systems maintain a local operation history. In a collaborative system, if User A undoes their stroke, what happens to User B's strokes that came after? The solution is **operation-based history with full state resynchronization**.

### Implementation

#### Server-Side State Management (drawing-state.js)

\`\`\`javascript
class DrawingState {
  constructor() {
    this.history = [];      // All applied operations
    this.redoStack = [];    // Operations that were undone
  }

  addOperation(operation) {
    this.history.push(operation);
    this.redoStack = [];  // Clear redo when new op occurs
  }

  undoLastOperation() {
    if (this.history.length > 0) {
      const op = this.history.pop();
      this.redoStack.push(op);
    }
  }

  redoOperation() {
    if (this.redoStack.length > 0) {
      const op = this.redoStack.pop();
      this.history.push(op);
    }
  }

  getHistory() {
    return [...this.history];  // Return copy for safety
  }
}
\`\`\`

#### Conflict Resolution
1. **Global Sequential Model**: All undo/redo requests are processed sequentially by the server
2. **Full History Replay**: After any undo/redo, the entire operation history is sent to all clients
3. **Client-side Redraw**: Each client clears its canvas and replays all operations in order
4. **Consistency**: All clients reach identical state regardless of network timing

#### Why This Works
- **No Operational Transformation (OT) needed**: We don't attempt to merge conflicting edits. Instead, we maintain a single global history.
- **Deterministic replay**: Given the same operation list, any client will produce identical canvas state
- **Handles concurrent draws**: Operations from multiple users don't conflict; they're all replayed in order
- **Simple and correct**: The tradeoff is that undoing shows the complete history without one user's strokes; this is acceptable for collaborative scenarios

### Example Scenario
\`\`\`
Timeline:
  10:00:00 - User A draws a line
  10:00:01 - User B draws a circle
  10:00:02 - User C draws a rectangle
  10:00:03 - User A clicks UNDO

History Before Undo:
  [Line(A), Circle(B), Rectangle(C)]

History After Undo:
  [Line(A), Circle(B)]

Result: User A's line is removed. All three users see the canvas with only Line(A) and Circle(B).
The rectangle is not lost; it's just in the undo stack and can be restored with REDO.
\`\`\`

## Performance Decisions

### 1. Event Batching: Line Segments vs. Whole Strokes
**Decision**: Send one line segment per mousemove event.

**Rationale**:
- Real-time responsiveness is critical for user experience
- Waiting for mouseup to send entire stroke creates visible latency
- Small segments (typically 2-5 pixels) compress well and are small payloads
- Outweighs the overhead of slightly more events

**Alternative (Rejected)**: Send whole stroke on mouseup
- Better for bandwidth but introduces 200-500ms latency before remote users see drawing
- Unacceptable for real-time collaboration

### 2. Canvas Redraw Strategy
**Decision**: Full canvas redraw only on undo/redo; incremental drawing on real-time strokes.

**Rationale**:
- Real-time drawing uses `new-draw-operation` events (incremental)
- Undo/redo uses `drawing-history` events (full replay)
- Full replay ensures perfect consistency after structural changes
- Incremental drawing keeps 60 FPS responsiveness

### 3. Cursor Position Updates
**Decision**: Send cursor positions on mousemove with `cursor-move` events.

**Rationale**:
- Separate from drawing events to avoid coupling UI/cursor logic with drawing
- Throttled naturally by mousemove event frequency (~60Hz)
- Small payloads (just x, y coordinates)
- Can be disabled easily if bandwidth is critical

### 4. User Color Assignment
**Decision**: Server assigns colors; client receives on join.

**Rationale**:
- Ensures no conflicts (no two users with same color)
- Distributed assignment would require coordination
- Colors sent in `drawing-history` event on join
- Simple deterministic algorithm: `colors[users.length % colors.length]`

### 5. Room Isolation
**Decision**: WebSocket rooms via Socket.io's built-in room system.

**Rationale**:
- Prevents cross-room interference
- Each room has isolated drawing state (future enhancement: separate DrawingState per room)
- Simplifies scaling and allows multiple concurrent canvases

## Architecture Components

### Frontend Architecture

#### `canvas.js` - CanvasDrawing Class
Responsibilities:
- Manage canvas state (colors, width, tool)
- Local drawing operations (startDrawing, draw, stopDrawing)
- Canvas rendering and clearing
- **Critical**: `redrawCanvas()` method for replaying operations

Key methods:
\`\`\`javascript
startDrawing(x, y)           // Initialize drawing state
draw(x, y, emitCallback)     // Draw line and emit to server
stopDrawing()                // End current drawing
redrawCanvas(operations)     // Replay entire history (undo/redo critical)
setColor(color)              // Change drawing color
setWidth(width)              // Change stroke width
setTool(tool)                // Switch between brush/eraser
getCanvasCoordinates(x, y)   // Convert screen to canvas coords
\`\`\`

#### `websocket.js` - WebSocketClient Class
Responsibilities:
- WebSocket connection management
- Sending drawing data to server
- Receiving and processing server events
- Cursor position tracking
- User list management

Key methods:
\`\`\`javascript
initWebSocket(callback)           // Connect and setup listeners
joinRoom()                        // Send join event
sendDrawing(...)                  // Send draw operation
sendCursorPosition(x, y)          // Send cursor update
requestUndo()                     // Request undo
requestRedo()                     // Request redo
drawRemoteLine(...)               // Draw received line
updateRemoteCursors(...)          // Update cursor positions
\`\`\`

#### `main.js` - Application Orchestrator
Responsibilities:
- Initialize canvas and WebSocket
- Wire up UI event listeners
- Coordinate between modules
- Handle tool selection, color changes, etc.

### Backend Architecture

#### `server.js` - Express + Socket.io Server
Responsibilities:
- HTTP server setup
- WebSocket connection handling
- Room management
- Event routing
- User tracking

Key components:
\`\`\`javascript
Room class                    // Manages users and cursors per room
User color assignment         // Distributed across room users
Event handlers               // join-room, draw, request-undo, etc.
\`\`\`

#### `drawing-state.js` - DrawingState Class
Responsibilities:
- Maintain global operation history
- Manage redo stack
- Provide history replay interface

Key methods:
\`\`\`javascript
addOperation(op)             // Add to history
undoLastOperation()          // Pop to redo stack
redoOperation()              // Move from redo to history
getHistory()                 // Get current history
clear()                      // Reset everything
\`\`\`

## Conflict Resolution

### Simultaneous Edits
When two users draw overlapping strokes:

1. **Local Drawing**: Each user sees their stroke immediately (optimistic local update)
2. **Server Receipt**: Operations arrive in timestamp order
3. **Broadcast**: Both operations sent to all users
4. **Remote Drawing**: Remote lines drawn on top of local canvas
5. **No Conflict**: Both strokes remain visible; order determined by reception

### Concurrent Undo Requests
If User A and User B both request undo:

1. Server processes sequentially (queued by Socket.io)
2. First undo pops one operation
3. Second undo pops next operation
4. Both users see both operations undone
5. If User A then redoes, only their undo is affected

### Eraser Collisions
When eraser strokes overlap with drawing:

1. Canvas `globalCompositeOperation = 'destination-out'`
2. Eraser is drawn as white line with destination-out
3. Erases both local and remote drawings
4. No special handling needed; operations replay identically

## Scalability Considerations

### Current Limitations
- Single server instance (no horizontal scaling)
- All state in memory (no persistence)
- No database backend
- Linear history replay (slow with 10,000+ operations)

### Scaling to 1000 Concurrent Users

#### Changes Required:
1. **Distribute Drawing State**: Use Redis to store operation history shared across server instances
2. **Room Sharding**: Assign rooms to specific servers based on hash
3. **Batch Operations**: Group mousemove events (send every 16ms instead of every event)
4. **Operation Pruning**: Keep only last 1000 operations, older ones become immutable
5. **Client-side Caching**: Cache rendered operations as image tiles
6. **Delta Sync**: Instead of full replay, send only new operations since client's last sync

#### Architecture:
\`\`\`
Load Balancer
    ↓
[Server 1] ←→ Redis Cluster ←→ [Server 2]
    ↓                               ↓
 Room A                          Room B

Room A operations stored in Redis, accessible by any server
Server 1 can handle Server 2's room if it goes down
\`\`\`

## Testing Approach

### Manual Testing Scenarios
1. **Basic Drawing**: Open two browsers, verify strokes appear in both
2. **Undo/Redo**: Draw, undo, redo, verify all users see same state
3. **Rapid Drawing**: Draw quickly with many overlaps, check smoothness
4. **Network Latency**: Use DevTools throttling to simulate 100ms+ latency
5. **Simultaneous Users**: 3+ users drawing same area
6. **Disconnection**: Disconnect mid-draw, reconnect, verify state

### Performance Metrics
- **FPS**: Monitor with DevTools, target 60 FPS local drawing
- **Latency**: Time from mouseup to appearance on remote canvas (target <100ms)
- **Network**: Monitor Socket.io messages, typical draw event ~100 bytes
- **Memory**: Canvas pixel data (for 1920x1080): ~8.3 MB

## Known Limitations & Future Improvements

### Current Limitations
1. **No Persistence**: Canvas cleared on server restart
2. **Single Server**: No failover or scaling
3. **No Authentication**: Anyone can join any room
4. **Raster-based**: No vector data (pixels lost on resize)
5. **Linear History**: Undo removes all operations after it

### Potential Improvements
1. **Drawing Layers**: Separate layers for each user, independent undo
2. **Comments/Annotations**: Text and shapes on canvas
3. **Canvas Export**: Download as PNG/SVG
4. **Drawing History UI**: Visual timeline of operations
5. **Selective Undo**: Undo specific user's strokes without affecting others
6. **Pressure Sensitivity**: Vary stroke width by pen pressure (tablets)
7. **Audio/Video**: Real-time collaboration chat
8. **Templates**: Start with pre-drawn shapes/backgrounds

---

**Last Updated**: November 8, 2025
**Author**: Krishna Keshav Singh
**Status**: Complete and ready for interview discussion
