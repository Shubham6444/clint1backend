const express = require("express")
const fs = require("fs").promises
const path = require("path")

const router = express.Router()
const CHANNELS_FILE = path.join(__dirname, "../database/channels.json")

// Helper functions
async function readChannels() {
  try {
    const data = await fs.readFile(CHANNELS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

// Get promoted channels
router.get("/promoted", async (req, res) => {
  try {
    const channels = await readChannels()
    const promotedChannels = channels.filter((channel) => channel.promoted && channel.active)
    res.json(promotedChannels)
  } catch (error) {
    console.error("Get promoted channels error:", error)
    res.status(500).json({ error: "Failed to fetch promoted channels" })
  }
})

// Get all active channels
router.get("/", async (req, res) => {
  try {
    const channels = await readChannels()
    const activeChannels = channels.filter((channel) => channel.active)
    res.json(activeChannels)
  } catch (error) {
    console.error("Get channels error:", error)
    res.status(500).json({ error: "Failed to fetch channels" })
  }
})

module.exports = router
