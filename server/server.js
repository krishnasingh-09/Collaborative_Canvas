const express = require("express")
const { createServer } = require("http")
const { join } = require("path")
const { Server } = require("socket.io")
const { DrawingState } = require("./drawing-state.js")

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
})

// Serve static files from client directory
const clientDir = join(__dirname, "../client")
app.use(express.static(clientDir))

// Global state management
const rooms = new Map()
const userColors = new Map()

// Room class to manage connected users
class Room {
  constructor(roomId) {
    this.roomId = roomId
    this.users = new Map()
    this.cursorPositions = new Map()
    this.drawingState = new DrawingState()
  }

  addUser(userId, socketId, name) {
    this.users.set(userId, { socketId, name })
  }

  removeUser(userId) {
    this.users.delete(userId)
    this.cursorPositions.delete(userId)
  }

  updateCursor(userId, x, y) {
    this.cursorPositions.set(userId, { x, y })
  }

  getUsers() {
    return Array.from(this.users.values())
  }

  getCursors() {
    const cursors = []
    this.cursorPositions.forEach((pos, userId) => {
      cursors.push({ userId, ...pos })
    })
    return cursors
  }
}

// Socket.io connection handler
io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`)

  // User joins a room
  socket.on("join-room", (data) => {
    const { roomId, userId, userName } = data

    // Leave previous room if any
    const previousRoom = Array.from(socket.rooms).find((r) => r !== socket.id)
    if (previousRoom) {
      socket.leave(previousRoom)
    }

    // Join new room
    socket.join(roomId)

    // Get or create room
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Room(roomId))
    }

    const room = rooms.get(roomId)
    room.addUser(userId, socket.id, userName)

    // Assign a color to this user
    const colors = ["#FF6B6B", "#4ECDC4", "#45B7D1", "#FFA07A", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E2"]
    const colorIndex = room.users.size % colors.length
    userColors.set(userId, colors[colorIndex])

    const usersWithColors = Array.from(room.users.entries()).map(([id, userData]) => ({
      userId: id,
      name: userData.name,
      color: userColors.get(id),
    }))

    socket.emit("drawing-history", {
      operations: room.drawingState.getHistory(),
      userId,
      color: userColors.get(userId),
      users: usersWithColors,
    })

    socket.to(roomId).emit("user-joined", {
      userId,
      userName,
      color: userColors.get(userId),
      users: usersWithColors,
    })

    console.log(`User ${userId} joined room ${roomId}`)
  })

  // Handle drawing operations
  socket.on("draw", (data) => {
    const { roomId, userId, x0, y0, x1, y1, color, width } = data

    // Get room and add operation to its state
    const room = rooms.get(roomId)
    if (room) {
      room.drawingState.addOperation({
        type: "draw",
        userId,
        x0,
        y0,
        x1,
        y1,
        color,
        width,
        timestamp: Date.now(),
      })
    }

    // Broadcast to all users in the room
    io.to(roomId).emit("new-draw-operation", {
      userId,
      x0,
      y0,
      x1,
      y1,
      color,
      width,
    })
  })

  // Handle user cursor movement
  socket.on("cursor-move", (data) => {
    const { roomId, userId, x, y } = data

    const room = rooms.get(roomId)
    if (room) {
      room.updateCursor(userId, x, y)
      socket.to(roomId).emit("user-cursors", {
        cursors: room.getCursors(),
        users: Array.from(room.users.entries()).map(([id, user]) => ({
          userId: id,
          userName: user.name,
          color: userColors.get(id),
        })),
      })
    }
  })

  socket.on("request-undo", (data) => {
    const { roomId, userId } = data

    const room = rooms.get(roomId)
    if (room) {
      room.drawingState.undoUserOperation(userId)

      // Send updated history to all users in this room
      io.to(roomId).emit("drawing-history", {
        operations: room.drawingState.getHistory(),
        isUndoRedo: true,
      })
    }
  })

  socket.on("request-redo", (data) => {
    const { roomId, userId } = data

    const room = rooms.get(roomId)
    if (room) {
      room.drawingState.redoUserOperation(userId)

      // Send updated history to all users in this room
      io.to(roomId).emit("drawing-history", {
        operations: room.drawingState.getHistory(),
        isUndoRedo: true,
      })
    }
  })

  // Clear canvas
  socket.on("clear-canvas", (data) => {
    const { roomId } = data

    const room = rooms.get(roomId)
    if (room) {
      room.drawingState.clear()

      io.to(roomId).emit("drawing-history", {
        operations: [],
        isCleared: true,
      })
    }
  })

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`)

    // Find and remove user from rooms
    rooms.forEach((room, roomId) => {
      const userEntry = Array.from(room.users.entries()).find(([_, userData]) => userData.socketId === socket.id)

      if (userEntry) {
        const userId = userEntry[0]
        room.removeUser(userId)
        userColors.delete(userId)

        const usersWithColors = Array.from(room.users.entries()).map(([id, userData]) => ({
          userId: id,
          name: userData.name,
          color: userColors.get(id),
        }))

        io.to(roomId).emit("user-left", {
          userId,
          users: usersWithColors,
        })

        // Clean up empty rooms
        if (room.users.size === 0) {
          rooms.delete(roomId)
        }
      }
    })
  })
})

const PORT = process.env.PORT || 3000
httpServer.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
