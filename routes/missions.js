const express = require("express")
const fs = require("fs").promises
const path = require("path")
const jwt = require("jsonwebtoken")

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const USERS_FILE = path.join(__dirname, "../database/users.json")
const MISSIONS_FILE = path.join(__dirname, "../database/missions.json")

// Helper functions
async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function writeUsers(users) {
  try {
    await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2))
    return true
  } catch (error) {
    console.error("Error writing users:", error)
    return false
  }
}

async function readMissions() {
  try {
    const data = await fs.readFile(MISSIONS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function writeMissions(missions) {
  try {
    await fs.writeFile(MISSIONS_FILE, JSON.stringify(missions, null, 2))
    return true
  } catch (error) {
    console.error("Error writing missions:", error)
    return false
  }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({ error: "Access token required" })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: "Invalid token" })
    }
    req.user = user
    next()
  })
}

// Get user missions
router.get("/", authenticateToken, async (req, res) => {
  try {
    const users = await readUsers()
    const user = users.find((u) => u.id === req.user.id)

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Get user's missions with progress calculation
    const missions = user.missions || []
    const activeMissions = missions.filter((mission) => !mission.completed)

    // Calculate progress for active missions
    const missionsWithProgress = activeMissions.map((mission) => {
      let progress = 0

      if (user.youtubeInfo && mission.type === "subscribers") {
        const current = Number.parseInt(user.youtubeInfo.currentSubscribers.replace(/[^0-9]/g, "")) || 0
        const target = Number.parseInt(mission.targetValue) || 1
        const initial = Number.parseInt(mission.initialValue) || 0

        progress = Math.min(100, Math.max(0, ((current - initial) / (target - initial)) * 100))
      }

      return {
        ...mission,
        progress: Math.round(progress),
      }
    })

    res.json(missionsWithProgress)
  } catch (error) {
    console.error("Get missions error:", error)
    res.status(500).json({ error: "Failed to fetch missions" })
  }
})

// Complete mission
router.post("/:missionId/complete", authenticateToken, async (req, res) => {
  try {
    const { missionId } = req.params
    const users = await readUsers()
    const user = users.find((u) => u.id === req.user.id)

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    // Find and complete the mission
    const missionIndex = user.missions.findIndex((m) => m.id === missionId)
    if (missionIndex === -1) {
      return res.status(404).json({ error: "Mission not found" })
    }

    const mission = user.missions[missionIndex]

    // Check if mission can be completed
    if (mission.completed) {
      return res.status(400).json({ error: "Mission already completed" })
    }

    // Mark mission as completed
    user.missions[missionIndex].completed = true
    user.missions[missionIndex].completedAt = new Date().toISOString()

    await writeUsers(users)

    res.json({
      message: "Mission completed successfully!",
      mission: user.missions[missionIndex],
    })
  } catch (error) {
    console.error("Complete mission error:", error)
    res.status(500).json({ error: "Failed to complete mission" })
  }
})

module.exports = router
