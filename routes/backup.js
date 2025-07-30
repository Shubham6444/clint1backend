const express = require("express")
const { createZipBackup, pushBackupToGitHub } = require("../utils/githubBackup")
const router = express.Router()

router.get("/backup/github", async (req, res) => {
  try {
    const { zipFilePath, zipFileName } = await createZipBackup()
    const githubPath = await pushBackupToGitHub(zipFilePath, zipFileName)
    res.json({ success: true, path: githubPath })
  } catch (err) {
    console.error("Backup error:", err)
    res.status(500).json({ error: "Backup failed", details: err.message })
  }
})

module.exports = router
