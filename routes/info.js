const express = require("express")
const fs = require("fs")
const path = require("path")
const router = express.Router()
// const authenticateToken = require("../middlewares/authenticateToken")

router.get("/user/:id/deals", async (req, res) => {
  try {
    const { id } = req.params

    if (!req.user || (!req.user.isAdmin && req.user.id != id)) {
      return res.status(403).json({ error: "Access denied" })
    }

    const filePath = path.join(__dirname, "../database/deals.json")
    const data = fs.readFileSync(filePath, "utf-8")
    const deals = JSON.parse(data)

    const userDeals = deals.filter((deal) => String(deal.userId) === String(id))

    res.json(userDeals)
  } catch (err) {
    console.error("Error fetching user deals:", err)
    res.status(500).json({ error: "Internal server error" })
  }
})

module.exports = router
