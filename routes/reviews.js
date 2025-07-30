const express = require("express")
const fs = require("fs").promises
const path = require("path")
const jwt = require("jsonwebtoken")

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const REVIEWS_FILE = path.join(__dirname, "../database/reviews.json")
const USERS_FILE = path.join(__dirname, "../database/users.json")

// Helper functions
async function readReviews() {
  try {
    const data = await fs.readFile(REVIEWS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

async function writeReviews(reviews) {
  try {
    await fs.writeFile(REVIEWS_FILE, JSON.stringify(reviews, null, 2))
    return true
  } catch (error) {
    console.error("Error writing reviews:", error)
    return false
  }
}

async function readUsers() {
  try {
    const data = await fs.readFile(USERS_FILE, "utf8")
    return JSON.parse(data)
  } catch (error) {
    return []
  }
}

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers["authorization"]
  const token = authHeader && authHeader.split(" ")[1]

  if (!token) {
    return res.status(401).json({
      error: "Please login to submit a review",
      redirectTo: "/login",
    })
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: "Please login to submit a review",
        redirectTo: "/login",
      })
    }
    req.user = user
    next()
  })
}

// Get all approved reviews
router.get("/", async (req, res) => {
  try {
    const reviews = await readReviews()
    const approvedReviews = reviews.filter((review) => review.approved)
    res.json(approvedReviews)
  } catch (error) {
    console.error("Get reviews error:", error)
    res.status(500).json({ error: "Failed to fetch reviews" })
  }
})

// Submit a review (requires authentication)
router.post("/", authenticateToken, async (req, res) => {
  try {
    const { rating, comment } = req.body

    if (!rating || !comment) {
      return res.status(400).json({ error: "Rating and comment are required" })
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" })
    }

    const users = await readUsers()
    const user = users.find((u) => u.id === req.user.id)

    if (!user) {
      return res.status(404).json({ error: "User not found" })
    }

    const reviews = await readReviews()

    // Check if user already submitted a review
    const existingReview = reviews.find((r) => r.userId === user.id)
    if (existingReview) {
      return res.status(400).json({ error: "You have already submitted a review" })
    }

    const newReview = {
      id: reviews.length + 1,
      userId: user.id,
      name: user.fullName,
      email: user.email,
      rating: Number.parseInt(rating),
      comment: comment.trim(),
      subscribers: "New Creator", // Default for new users
      verified: false,
      approved: false, // Admin needs to approve
      createdAt: new Date().toISOString(),
    }

    reviews.push(newReview)
    await writeReviews(reviews)

    res.status(201).json({
      message: "Review submitted successfully. It will be visible after admin approval.",
      review: newReview,
    })
  } catch (error) {
    console.error("Submit review error:", error)
    res.status(500).json({ error: "Failed to submit review" })
  }
})

// Like a review
router.post("/:id/like", async (req, res) => {
  try {
    const reviews = await readReviews()
    const review = reviews.find((r) => r.id === Number.parseInt(req.params.id))

    if (!review) {
      return res.status(404).json({ error: "Review not found" })
    }

    review.likes = (review.likes || 0) + 1
    await writeReviews(reviews)

    res.json({
      message: "Review liked",
      likes: review.likes,
    })
  } catch (error) {
    console.error("Like review error:", error)
    res.status(500).json({ error: "Failed to like review" })
  }
})

module.exports = router
