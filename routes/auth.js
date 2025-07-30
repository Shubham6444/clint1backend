const express = require("express")
const bcrypt = require("bcryptjs")
const jwt = require("jsonwebtoken")
const fs = require("fs").promises
const path = require("path")
const crypto = require("crypto")

const router = express.Router()
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key"
const USERS_FILE = path.join(__dirname, "../database/users.json")

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

// Register new user
router.post("/register", async (req, res) => {
  try {
    const { fullName, email, whatsappNumber, password, confirmPassword } = req.body

    // Validation
    if (!fullName || !email || !whatsappNumber || !password || !confirmPassword) {
      return res.status(400).json({ error: "All fields are required" })
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match" })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" })
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address" })
    }

    // WhatsApp number validation (basic)
    const whatsappRegex = /^\+?[1-9]\d{1,14}$/
    if (!whatsappRegex.test(whatsappNumber.replace(/\s/g, ""))) {
      return res.status(400).json({ error: "Please enter a valid WhatsApp number" })
    }

    const users = await readUsers()

    // Check if user already exists
    const existingUser = users.find((user) => user.email === email)
    if (existingUser) {
      return res.status(400).json({ error: "User with this email already exists" })
    }

    // Hash password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Create new user
    const newUser = {
      id: users.length + 1,
      fullName,
      email,
      whatsappNumber,
      password: hashedPassword,
      isAdmin: email === "admin@creatorhub.com", // Make first admin
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    users.push(newUser)
    await writeUsers(users)

    // Generate JWT token
    const token = jwt.sign({ id: newUser.id, email: newUser.email, isAdmin: newUser.isAdmin }, JWT_SECRET, {
      expiresIn: "7d",
    })

    // Remove password from response
    const { password: _, ...userResponse } = newUser

    res.status(201).json({
      message: "User registered successfully",
      user: userResponse,
      token,
    })
  } catch (error) {
    console.error("Registration error:", error)
    res.status(500).json({ error: "Failed to register user" })
  }
})

// Login user
router.post("/login", async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body
    console.log("Login attempt:", { emailOrPhone, password: "***" })

    if (!emailOrPhone || !password) {
      return res.status(400).json({ error: "Email/Phone and password are required" })
    }

    const users = await readUsers()

    // Find user by email or phone
    const user = users.find((u) => u.email === emailOrPhone || u.whatsappNumber === emailOrPhone)
    console.log("User found:", user ? "Yes" : "No")

    if (!user) {
      return res.status(400).json({ error: "Invalid email/phone or password" })
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password)
    console.log("Password valid:", isPasswordValid)

    if (!isPasswordValid) {
      return res.status(400).json({ error: "Invalid email/phone or password" })
    }

    // Generate JWT token
    const token = jwt.sign({ id: user.id, email: user.email, isAdmin: user.isAdmin }, JWT_SECRET, {
      expiresIn: "7d",
    })

    // Remove password from response
    const { password: _, ...userResponse } = user

    res.json({
      message: "Login successful",
      user: userResponse,
      token,
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ error: "Failed to login" })
  }
})

// Get current user - MODIFIED TO WORK WITHOUT TOKEN
router.get("/me", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"]
    const token = authHeader && authHeader.split(" ")[1]

    if (!token) {
      // Return a default user or empty response instead of error
      return res.json({
        id: null,
        fullName: "Guest User",
        email: "guest@example.com",
        isAdmin: false,
        createdAt: new Date().toISOString(),
      })
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET)
      const users = await readUsers()
      const user = users.find((u) => u.id === decoded.id)

      if (!user) {
        // Return guest user instead of error
        return res.json({
          id: null,
          fullName: "Guest User",
          email: "guest@example.com",
          isAdmin: false,
          createdAt: new Date().toISOString(),
        })
      }

      // Remove password from response
      const { password: _, ...userResponse } = user
      res.json(userResponse)
    } catch (jwtError) {
      console.log("JWT verification failed:", jwtError.message)
      // Return guest user instead of error
      return res.json({
        id: null,
        fullName: "Guest User",
        email: "guest@example.com",
        isAdmin: false,
        createdAt: new Date().toISOString(),
      })
    }
  } catch (error) {
    console.error("Get user error:", error)
    // Return guest user instead of error
    res.json({
      id: null,
      fullName: "Guest User",
      email: "guest@example.com",
      isAdmin: false,
      createdAt: new Date().toISOString(),
    })
  }
})

// Forgot password
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body

    if (!email) {
      return res.status(400).json({ error: "Email is required" })
    }

    const users = await readUsers()
    const user = users.find((u) => u.email === email)

    if (!user) {
      // Don't reveal if email exists or not for security
      return res.json({ message: "If the email exists, a reset link has been sent" })
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex")
    const resetTokenExpiry = new Date(Date.now() + 3600000) // 1 hour from now

    // Update user with reset token
    user.resetToken = resetToken
    user.resetTokenExpiry = resetTokenExpiry.toISOString()
    user.updatedAt = new Date().toISOString()

    await writeUsers(users)

    // In a real app, you would send an email here
    // For demo purposes, we'll just log the token
    console.log(`Password reset token for ${email}: ${resetToken}`)
    console.log(`Reset URL: http://localhost:3000/reset-password?token=${resetToken}`)

    res.json({ message: "If the email exists, a reset link has been sent" })
  } catch (error) {
    console.error("Forgot password error:", error)
    res.status(500).json({ error: "Failed to process forgot password request" })
  }
})

// Reset password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body

    if (!token || !password) {
      return res.status(400).json({ error: "Token and password are required" })
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long" })
    }

    const users = await readUsers()
    const user = users.find((u) => u.resetToken === token)

    if (!user) {
      return res.status(400).json({ error: "Invalid or expired reset token" })
    }

    // Check if token is expired
    if (new Date() > new Date(user.resetTokenExpiry)) {
      return res.status(400).json({ error: "Reset token has expired" })
    }

    // Hash new password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Update user password and clear reset token
    user.password = hashedPassword
    user.resetToken = null
    user.resetTokenExpiry = null
    user.updatedAt = new Date().toISOString()

    await writeUsers(users)

    res.json({ message: "Password reset successfully" })
  } catch (error) {
    console.error("Reset password error:", error)
    res.status(500).json({ error: "Failed to reset password" })
  }
})

module.exports = router
