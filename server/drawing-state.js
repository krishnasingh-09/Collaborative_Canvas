/**
 * Convert to CommonJS and implement per-user undo/redo stacks
 * DrawingState manages collaborative canvas state with per-user undo/redo support
 */
class DrawingState {
  constructor() {
    this.history = [] // Main history of all operations
    this.userRedoStacks = new Map() // Per-user redo stacks: userId -> [operations]
  }

  /**
   * Add a new drawing operation to the history
   */
  addOperation(operation) {
    this.history.push(operation)
    // Clear redo stack for this user when new operation is added
    this.userRedoStacks.delete(operation.userId)
  }

  /**
   * Get the current history of all operations
   */
  getHistory() {
    return [...this.history]
  }

  /**
   * Undo only the last operation by a specific user
   */
  undoUserOperation(userId) {
    // Find the last operation by this user (search backwards)
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].userId === userId) {
        const operation = this.history.splice(i, 1)[0]

        // Add to user's redo stack
        if (!this.userRedoStacks.has(userId)) {
          this.userRedoStacks.set(userId, [])
        }
        this.userRedoStacks.get(userId).push(operation)

        console.log(`[v0] User ${userId} undid operation, history length: ${this.history.length}`)
        return true
      }
    }
    console.log(`[v0] No operations to undo for user ${userId}`)
    return false
  }

  /**
   * Redo the last undone operation by a specific user
   */
  redoUserOperation(userId) {
    const redoStack = this.userRedoStacks.get(userId)

    if (redoStack && redoStack.length > 0) {
      const operation = redoStack.pop()
      this.history.push(operation)

      console.log(`[v0] User ${userId} redid operation, history length: ${this.history.length}`)
      return true
    }

    console.log(`[v0] No operations to redo for user ${userId}`)
    return false
  }

  /**
   * Clear all history and redo stacks
   */
  clear() {
    this.history = []
    this.userRedoStacks.clear()
  }
}

module.exports = { DrawingState }
