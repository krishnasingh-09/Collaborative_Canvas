/**
 * WebSocket client module - handles all real-time communication
 * Manages connection, events, and synchronization
 */

// Import Socket.io from CDN
const io = window.io

window.WebSocketClient = class {
  constructor(canvasDrawing) {
    this.canvasDrawing = canvasDrawing
    this.socket = null
    this.roomId = "default-room"
    this.userId = this.generateUserId()
    this.userName = "User"
    this.isConnected = false
    this.onUsersUpdate = null
    this.currentUsers = []

    this.localUndoStack = [] // Stack of user's own drawing operations
    this.localRedoStack = [] // Stack of operations that were undone
  }

  /**
   * Generate a unique user ID
   */
  generateUserId() {
    return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Initialize WebSocket connection
   */
  initWebSocket(onStatusChange) {
    if (typeof window.io === "undefined") {
      console.error(
        "[v0] Socket.io library not loaded. Make sure server is running and /socket.io/socket.io.js is accessible",
      )
      // Retry with exponential backoff
      setTimeout(() => this.initWebSocket(onStatusChange), 500)
      return
    }

    try {
      this.socket = window.io({
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
      })
    } catch (error) {
      console.error("[v0] Failed to initialize socket.io:", error)
      setTimeout(() => this.initWebSocket(onStatusChange), 500)
      return
    }

    // Connection established
    this.socket.on("connect", () => {
      this.isConnected = true
      console.log("[v0] Connected to server, socket id:", this.socket.id)
      onStatusChange("Connected", "connected")
      this.joinRoom()
    })

    // Connection lost
    this.socket.on("disconnect", () => {
      this.isConnected = false
      console.log("[v0] Disconnected from server")
      onStatusChange("Disconnected", "disconnected")
    })

    // Receive full drawing history (on join or undo/redo)
    this.socket.on("drawing-history", (data) => {
      console.log("[v0] Received drawing history with", data.operations.length, "operations")
      this.canvasDrawing.redrawCanvas(data.operations)

      if (data.users && this.onUsersUpdate) {
        this.currentUsers = data.users
        this.onUsersUpdate(data.users)
      }
    })

    // Receive new drawing operation from another user
    this.socket.on("new-draw-operation", (data) => {
      const { userId, x0, y0, x1, y1, color, width } = data

      console.log("[v0] Remote draw from", userId, "at", x0, y0, "to", x1, y1)

      this.drawRemoteLine(x0, y0, x1, y1, color, width)
    })

    // Receive cursor positions
    this.socket.on("user-cursors", (data) => {
      this.updateRemoteCursors(data.cursors, data.users)

      if (data.users && this.onUsersUpdate) {
        this.currentUsers = data.users
        this.onUsersUpdate(data.users)
      }
    })

    // Handle user joined
    this.socket.on("user-joined", (data) => {
      console.log("[v0] User joined:", data.userName)
      if (data.users && this.onUsersUpdate) {
        this.currentUsers = data.users
        this.onUsersUpdate(data.users)
      }
    })

    // Handle user left
    this.socket.on("user-left", (data) => {
      console.log("[v0] User left:", data.userId)
      this.removeRemoteCursor(data.userId)

      if (data.users) {
        this.currentUsers = data.users
        if (this.onUsersUpdate) {
          this.onUsersUpdate(data.users)
        }
      }
    })
  }

  /**
   * Join a room
   */
  joinRoom() {
    if (this.socket && this.isConnected) {
      console.log("[v0] Joining room:", this.roomId, "as user:", this.userName)
      this.socket.emit("join-room", {
        roomId: this.roomId,
        userId: this.userId,
        userName: this.userName,
      })
    }
  }

  /**
   * Change room
   */
  changeRoom(newRoomId, newUserName) {
    this.roomId = newRoomId
    this.userName = newUserName
    console.log("[v0] Changing to room:", newRoomId)
    this.joinRoom()
  }

  /**
   * Send drawing data to server
   */
  sendDrawing(x0, y0, x1, y1, color, width) {
    if (this.socket && this.isConnected) {
      const operation = {
        type: "draw",
        userId: this.userId,
        x0,
        y0,
        x1,
        y1,
        color,
        width,
        timestamp: Date.now(),
      }

      this.localUndoStack.push(operation)
      this.localRedoStack = [] // Clear redo stack when new operation is added

      this.socket.emit("draw", {
        roomId: this.roomId,
        userId: this.userId,
        x0,
        y0,
        x1,
        y1,
        color,
        width,
      })
    }
  }

  /**
   * Send cursor position
   */
  sendCursorPosition(x, y) {
    if (this.socket && this.isConnected) {
      this.socket.emit("cursor-move", {
        roomId: this.roomId,
        userId: this.userId,
        x,
        y,
      })
    }
  }

  /**
   * Request undo - only undo this user's last stroke
   */
  requestUndo() {
    if (this.socket && this.isConnected) {
      if (this.localUndoStack.length > 0) {
        const lastOperation = this.localUndoStack.pop()
        this.localRedoStack.push(lastOperation)

        console.log("[v0] Requesting undo for user's last operation")
        this.socket.emit("request-undo", {
          roomId: this.roomId,
          userId: this.userId,
          operationId: lastOperation.timestamp, // Use timestamp as unique ID
        })
      } else {
        console.log("[v0] No operations to undo for this user")
      }
    }
  }

  /**
   * Request redo - redo this user's last undone stroke
   */
  requestRedo() {
    if (this.socket && this.isConnected) {
      if (this.localRedoStack.length > 0) {
        const operation = this.localRedoStack.pop()
        this.localUndoStack.push(operation)

        console.log("[v0] Requesting redo for user's operation")
        this.socket.emit("request-redo", {
          roomId: this.roomId,
          userId: this.userId,
          operationId: operation.timestamp,
        })
      } else {
        console.log("[v0] No operations to redo for this user")
      }
    }
  }

  /**
   * Request clear canvas
   */
  requestClearCanvas() {
    if (this.socket && this.isConnected) {
      console.log("[v0] Requesting clear canvas for room:", this.roomId)
      this.socket.emit("clear-canvas", {
        roomId: this.roomId,
      })
    }
  }

  /**
   * Draw a line from a remote user on our canvas
   */
  drawRemoteLine(x0, y0, x1, y1, color, width) {
    const ctx = this.canvasDrawing.ctx
    ctx.beginPath()
    ctx.moveTo(x0, y0)
    ctx.lineTo(x1, y1)
    ctx.strokeStyle = color === "ERASER" ? "#FFFFFF" : color
    ctx.lineWidth = width
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    if (color === "ERASER") {
      ctx.globalCompositeOperation = "destination-out"
    } else {
      ctx.globalCompositeOperation = "source-over"
    }

    ctx.stroke()
    ctx.globalCompositeOperation = "source-over"
  }

  /**
   * Update remote cursor positions
   */
  updateRemoteCursors(cursors, users) {
    const cursorsLayer = document.getElementById("cursorsLayer")
    if (!cursorsLayer) return

    // Create user map for quick lookup
    const userMap = {}
    if (users) {
      users.forEach((user) => {
        userMap[user.userId] = user
      })
    }

    // Clear existing cursors
    cursorsLayer.innerHTML = ""

    // Draw cursors
    cursors.forEach((cursor) => {
      if (cursor.userId === this.userId) return // Don't show own cursor

      const user = userMap[cursor.userId]
      const cursorEl = document.createElement("div")
      cursorEl.className = "remote-cursor"
      cursorEl.id = `cursor-${cursor.userId}`
      cursorEl.style.color = user?.color || "#000000"
      cursorEl.style.left = cursor.x + "px"
      cursorEl.style.top = cursor.y + "px"

      cursorEl.innerHTML = `
        <div class="cursor-pointer"></div>
        <div class="cursor-label">${user?.userName || "User"}</div>
      `

      cursorsLayer.appendChild(cursorEl)
    })
  }

  /**
   * Remove a remote cursor
   */
  removeRemoteCursor(userId) {
    const cursorEl = document.getElementById(`cursor-${userId}`)
    if (cursorEl) {
      cursorEl.remove()
    }
  }
}
