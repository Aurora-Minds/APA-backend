const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   GET api/leaderboard
// @desc    Get leaderboard data (top users by XP)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const leaderboard = await User.find({}, 'name xp')
            .sort({ xp: -1 })
            .limit(100); // Limit to top 100 users

        res.json(leaderboard);
    } catch (err) {
        console.error('Error fetching leaderboard:', err.message);
        res.status(500).json({ msg: 'Server error while fetching leaderboard' });
    }
});

module.exports = router;
