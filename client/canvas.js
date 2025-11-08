/**
 * Canvas drawing module - handles all local canvas operations
 * Manages the drawing state, rendering, and path optimization
 */

window.CanvasDrawing = class {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId)

    if (!this.canvas) {
      console.error("[v0] Canvas element not found with id:", canvasId)
      return
    }

    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true })
    this.isDrawing = false
    this.currentColor = "#000000"
    this.currentWidth = 3
    this.currentTool = "brush"

    // Drawing state
    this.lastX = 0
    this.lastY = 0
    this.drawingBuffer = [] // Buffer for smoother lines

    // Setup canvas
    this.resizeCanvas()
    window.addEventListener("resize", () => this.resizeCanvas())
  }

  /**
   * Resize canvas to fill the container
   */
  resizeCanvas() {
    const container = this.canvas.parentElement
    this.canvas.width = container.clientWidth
    this.canvas.height = container.clientHeight
  }

  /**
   * Start a new drawing operation
   */
  startDrawing(x, y) {
    this.isDrawing = true
    this.lastX = x
    this.lastY = y
    this.drawingBuffer = [{ x, y }]
  }

  /**
   * Draw a line from last position to current position
   * Supports both brush and eraser tools
   */
  draw(x, y, emitCallback) {
    if (!this.isDrawing) return

    this.drawingBuffer.push({ x, y })

    // Draw line on canvas
    this.ctx.beginPath()
    this.ctx.moveTo(this.lastX, this.lastY)
    this.ctx.lineTo(x, y)
    this.ctx.strokeStyle = this.currentTool === "eraser" ? "#FFFFFF" : this.currentColor
    this.ctx.lineWidth = this.currentWidth
    this.ctx.lineCap = "round"
    this.ctx.lineJoin = "round"

    if (this.currentTool === "eraser") {
      this.ctx.globalCompositeOperation = "destination-out"
    } else {
      this.ctx.globalCompositeOperation = "source-over"
    }

    this.ctx.stroke()

    // Emit drawing data to server
    if (emitCallback) {
      emitCallback({
        x0: this.lastX,
        y0: this.lastY,
        x1: x,
        y1: y,
        color: this.currentTool === "eraser" ? "ERASER" : this.currentColor,
        width: this.currentWidth,
      })
    }

    this.lastX = x
    this.lastY = y
  }

  /**
   * Stop drawing operation
   */
  stopDrawing() {
    this.isDrawing = false
    this.drawingBuffer = []
  }

  /**
   * Redraw the entire canvas from a history of operations
   * Critical for undo/redo and synchronization
   */
  redrawCanvas(operations) {
    // Clear canvas
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    this.ctx.globalCompositeOperation = "source-over"

    if (!operations || operations.length === 0) {
      return
    }

    // Replay all operations
    operations.forEach((op) => {
      if (op.type === "draw") {
        this.ctx.beginPath()
        this.ctx.moveTo(op.x0, op.y0)
        this.ctx.lineTo(op.x1, op.y1)
        this.ctx.strokeStyle = op.color === "ERASER" ? "#FFFFFF" : op.color
        this.ctx.lineWidth = op.width
        this.ctx.lineCap = "round"
        this.ctx.lineJoin = "round"

        if (op.color === "ERASER") {
          this.ctx.globalCompositeOperation = "destination-out"
        } else {
          this.ctx.globalCompositeOperation = "source-over"
        }

        this.ctx.stroke()
      }
    })

    this.ctx.globalCompositeOperation = "source-over"
  }

  /**
   * Clear the canvas completely
   */
  clearCanvas() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  /**
   * Set the current drawing color
   */
  setColor(color) {
    this.currentColor = color
  }

  /**
   * Set the current stroke width
   */
  setWidth(width) {
    this.currentWidth = width
  }

  /**
   * Set the current tool (brush or eraser)
   */
  setTool(tool) {
    this.currentTool = tool
    this.canvas.style.cursor = tool === "eraser" ? "cell" : "crosshair"
  }

  /**
   * Get canvas dimensions for coordinate translation
   */
  getCanvasBounds() {
    return this.canvas.getBoundingClientRect()
  }

  /**
   * Convert client coordinates to canvas coordinates
   */
  getCanvasCoordinates(clientX, clientY) {
    const bounds = this.getCanvasBounds()
    return {
      x: clientX - bounds.left,
      y: clientY - bounds.top,
    }
  }
}
