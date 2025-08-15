const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const ClaimedReward = require('../models/ClaimedReward');
const rewardsData = require('../rewardsData');
const { v4: uuidv4 } = require('uuid');

// Helper function to calculate level from XP
const calculateLevel = (xp) => {
    let level = 1;
    let requiredXp = 100;
    while (xp >= requiredXp) {
        xp -= requiredXp;
        level++;
        requiredXp = 100 * level;
    }
    return level;
};

// @route   GET api/rewards
// @desc    Get all rewards and user's claim status
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const userLevel = calculateLevel(user.xp || 0);
        const claimedRewards = await ClaimedReward.find({ user: req.user.id });
        const claimedRewardIds = new Set(claimedRewards.map(r => r.rewardId));

        const rewardsWithStatus = rewardsData.map(reward => {
            let status = 'locked';
            if (claimedRewardIds.has(reward.id)) {
                status = 'claimed';
            } else if (userLevel >= reward.level) {
                status = 'unlocked';
            }
            return { ...reward, status };
        });

        res.json({ rewards: rewardsWithStatus, userLevel });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST api/rewards/claim/:rewardId
// @desc    Claim a reward
// @access  Private
router.post('/claim/:rewardId', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        const { rewardId } = req.params;
        const reward = rewardsData.find(r => r.id === rewardId);

        if (!reward) {
            return res.status(404).json({ msg: 'Reward not found' });
        }

        const userLevel = calculateLevel(user.xp || 0);
        if (userLevel < reward.level) {
            return res.status(403).json({ msg: 'You have not reached the required level for this reward' });
        }

        const alreadyClaimed = await ClaimedReward.findOne({ user: req.user.id, rewardId });
        if (alreadyClaimed) {
            return res.json(alreadyClaimed);
        }

        // Generate a mock code
        const code = `AURORA-${reward.id.toUpperCase()}-${uuidv4().split('-')[0].toUpperCase()}`;

        const newClaimedReward = new ClaimedReward({
            user: req.user.id,
            rewardId,
            code
        });

        await newClaimedReward.save();

        res.json(newClaimedReward);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;