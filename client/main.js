/**
 * Main application entry point
 * Orchestrates canvas, websocket, and UI interactions
 */

/**
 * Update connection status UI
 */
function updateConnectionStatus(status, className) {
  const statusEl = document.getElementById("connectionStatus")
  if (statusEl) {
    statusEl.textContent = status
    statusEl.className = `connection-status ${className}`
  }
}

// Initialize modules - MUST wait for DOM to be ready
let canvasDrawing = null
let websocket = null

// Wait for DOM to be fully loaded
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp)
} else {
  initializeApp()
}

function initializeApp() {
  console.log("[v0] Initializing app...")

  canvasDrawing = new window.CanvasDrawing("drawingCanvas")
  websocket = new window.WebSocketClient(canvasDrawing)

  // Initialize WebSocket
  websocket.initWebSocket(updateConnectionStatus)

  // Setup UI event listeners
  setupUIEventListeners()
  setupCanvasEventListeners()

  // Check for room in URL after initialization
  const params = new URLSearchParams(window.location.search)
  const roomFromUrl = params.get("room")
  if (roomFromUrl) {
    setTimeout(() => {
      websocket.changeRoom(roomFromUrl, "User")
      document.getElementById("currentRoom").textContent = `Room: ${roomFromUrl}`
    }, 500)
  }

  console.log("[v0] App initialized successfully")
}

/**
 * Setup all UI event listeners
 */
function setupUIEventListeners() {
  let currentRoomId = "default-room"
  let currentUserName = "User"

  /**
   * Update room display in header
   */
  function updateRoomDisplay(roomId) {
    const roomEl = document.getElementById("currentRoom")
    if (roomEl) {
      roomEl.textContent = `Room: ${roomId}`
    }
    currentRoomId = roomId
  }

  /**
   * Room management modal functions
   */
  const roomModal = document.getElementById("roomModal")
  const linkModal = document.getElementById("linkModal")
  const createRoomForm = document.getElementById("createRoomForm")
  const joinRoomForm = document.getElementById("joinRoomForm")

  const createRoomBtn = document.getElementById("createRoomBtn")
  if (createRoomBtn) {
    createRoomBtn.addEventListener("click", () => {
      document.getElementById("modalTitle").textContent = "Create New Room"
      createRoomForm.style.display = "flex"
      joinRoomForm.style.display = "none"
      roomModal.classList.add("active")
    })
  }

  const joinExistingBtn = document.getElementById("joinExistingBtn")
  if (joinExistingBtn) {
    joinExistingBtn.addEventListener("click", () => {
      document.getElementById("modalTitle").textContent = "Join Room"
      createRoomForm.style.display = "none"
      joinRoomForm.style.display = "flex"
      roomModal.classList.add("active")
    })
  }

  const closeRoomModal = document.getElementById("closeRoomModal")
  if (closeRoomModal) {
    closeRoomModal.addEventListener("click", () => {
      roomModal.classList.remove("active")
    })
  }

  const closeLinkModal = document.getElementById("closeLinkModal")
  if (closeLinkModal) {
    closeLinkModal.addEventListener("click", () => {
      linkModal.classList.remove("active")
    })
  }

  const confirmCreateBtn = document.getElementById("confirmCreateBtn")
  if (confirmCreateBtn) {
    confirmCreateBtn.addEventListener("click", () => {
      const roomName = document.getElementById("newRoomName").value.trim() || "My Room"
      const userName = document.getElementById("yourName").value.trim() || "User"

      if (roomName) {
        currentUserName = userName
        websocket.changeRoom(roomName, userName)
        updateRoomDisplay(roomName)
        roomModal.classList.remove("active")
        document.getElementById("newRoomName").value = ""
        document.getElementById("yourName").value = ""
      }
    })
  }

  const confirmJoinBtn = document.getElementById("confirmJoinBtn")
  if (confirmJoinBtn) {
    confirmJoinBtn.addEventListener("click", () => {
      const roomCode = document.getElementById("joinRoomCode").value.trim()
      const userName = document.getElementById("joinName").value.trim() || "User"

      if (roomCode) {
        currentUserName = userName
        websocket.changeRoom(roomCode, userName)
        updateRoomDisplay(roomCode)
        roomModal.classList.remove("active")
        document.getElementById("joinRoomCode").value = ""
        document.getElementById("joinName").value = ""
      }
    })
  }

  const copyRoomLinkBtn = document.getElementById("copyRoomLinkBtn")
  if (copyRoomLinkBtn) {
    copyRoomLinkBtn.addEventListener("click", () => {
      const joinUrl = `${window.location.origin}?room=${encodeURIComponent(currentRoomId)}`
      document.getElementById("joinLink").value = joinUrl
      linkModal.classList.add("active")
    })
  }

  const copyLinkBtn = document.getElementById("copyLinkBtn")
  if (copyLinkBtn) {
    copyLinkBtn.addEventListener("click", () => {
      const linkInput = document.getElementById("joinLink")
      linkInput.select()
      document.execCommand("copy")

      const btn = document.getElementById("copyLinkBtn")
      const originalText = btn.textContent
      btn.textContent = "Copied!"
      setTimeout(() => {
        btn.textContent = originalText
      }, 2000)
    })
  }

  /**
   * Tool selection
   */
  const brushTool = document.getElementById("brushTool")
  if (brushTool) {
    brushTool.addEventListener("click", () => {
      selectTool("brush")
    })
  }

  const eraserTool = document.getElementById("eraserTool")
  if (eraserTool) {
    eraserTool.addEventListener("click", () => {
      selectTool("eraser")
    })
  }

  function selectTool(tool) {
    document.querySelectorAll(".tool-btn").forEach((btn) => {
      btn.classList.remove("active")
    })
    const toolBtn = document.querySelector(`[data-tool="${tool}"]`)
    if (toolBtn) {
      toolBtn.classList.add("active")
    }
    canvasDrawing.setTool(tool)
  }

  /**
   * Stroke width control
   */
  const strokeWidth = document.getElementById("strokeWidth")
  if (strokeWidth) {
    strokeWidth.addEventListener("input", (e) => {
      const width = e.target.value
      canvasDrawing.setWidth(width)
      const strokeValue = document.getElementById("strokeValue")
      if (strokeValue) {
        strokeValue.textContent = width + "px"
      }
    })
  }

  /**
   * Color selection
   */
  const colorPicker = document.getElementById("colorPicker")
  if (colorPicker) {
    colorPicker.addEventListener("input", (e) => {
      canvasDrawing.setColor(e.target.value)
    })
  }

  document.querySelectorAll(".color-preset").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const color = e.target.dataset.color
      canvasDrawing.setColor(color)
      if (colorPicker) {
        colorPicker.value = color
      }
    })
  })

  /**
   * Action buttons - Added proper null checks before calling websocket methods
   */
  const undoBtn = document.getElementById("undoBtn")
  if (undoBtn) {
    undoBtn.addEventListener("click", () => {
      console.log("[v0] Undo clicked")
      websocket.requestUndo()
    })
  }

  const redoBtn = document.getElementById("redoBtn")
  if (redoBtn) {
    redoBtn.addEventListener("click", () => {
      console.log("[v0] Redo clicked")
      websocket.requestRedo()
    })
  }

  const clearBtn = document.getElementById("clearBtn")
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      if (confirm("Clear canvas for all users?")) {
        console.log("[v0] Clear clicked")
        websocket.requestClearCanvas()
      }
    })
  }

  /**
   * Update users list when members join/leave
   */
  websocket.onUsersUpdate = (users) => {
    const usersList = document.getElementById("usersList")
    if (!usersList) return

    usersList.innerHTML = ""

    users.forEach((user) => {
      const userItem = document.createElement("div")
      userItem.className = "user-item"
      userItem.style.borderLeftColor = user.color || "#ccc"

      const colorDot = document.createElement("div")
      colorDot.className = "user-color"
      colorDot.style.backgroundColor = user.color || "#ccc"

      const userName = document.createElement("div")
      userName.className = "user-name"
      userName.textContent = user.userName || "Unknown"

      userItem.appendChild(colorDot)
      userItem.appendChild(userName)
      usersList.appendChild(userItem)
    })
  }
}

/**
 * Setup canvas event listeners
 */
function setupCanvasEventListeners() {
  const canvas = document.getElementById("drawingCanvas")
  if (!canvas) {
    console.error("[v0] Canvas element not found")
    return
  }

  canvas.addEventListener("mousedown", (e) => {
    const { x, y } = canvasDrawing.getCanvasCoordinates(e.clientX, e.clientY)
    canvasDrawing.startDrawing(x, y)
  })

  canvas.addEventListener("mousemove", (e) => {
    const { x, y } = canvasDrawing.getCanvasCoordinates(e.clientX, e.clientY)

    // Update cursor position for remote users
    websocket.sendCursorPosition(x, y)

    // Draw locally
    if (canvasDrawing.isDrawing) {
      canvasDrawing.draw(x, y, (drawData) => {
        websocket.sendDrawing(drawData.x0, drawData.y0, drawData.x1, drawData.y1, drawData.color, drawData.width)
      })
    }
  })

  canvas.addEventListener("mouseup", () => {
    canvasDrawing.stopDrawing()
  })

  canvas.addEventListener("mouseleave", () => {
    canvasDrawing.stopDrawing()
  })

  /**
   * Touch support for mobile
   */
  canvas.addEventListener("touchstart", (e) => {
    const touch = e.touches[0]
    const { x, y } = canvasDrawing.getCanvasCoordinates(touch.clientX, touch.clientY)
    canvasDrawing.startDrawing(x, y)
  })

  canvas.addEventListener("touchmove", (e) => {
    e.preventDefault()
    const touch = e.touches[0]
    const { x, y } = canvasDrawing.getCanvasCoordinates(touch.clientX, touch.clientY)

    websocket.sendCursorPosition(x, y)

    if (canvasDrawing.isDrawing) {
      canvasDrawing.draw(x, y, (drawData) => {
        websocket.sendDrawing(drawData.x0, drawData.y0, drawData.x1, drawData.y1, drawData.color, drawData.width)
      })
    }
  })

  canvas.addEventListener("touchend", () => {
    canvasDrawing.stopDrawing()
  })
}
