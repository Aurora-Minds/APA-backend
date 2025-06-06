const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const auth = require('../middleware/auth');
const Task = require('../models/Task');

// GET current user
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// UPDATE current user
router.put('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (req.body.name) user.name = req.body.name;
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(req.body.password, salt);
    }
    if (req.body.theme) user.theme = req.body.theme;
    await user.save();
    res.json({ msg: 'Account updated' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// GET user subjects
router.get('/me/subjects', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ subjects: user.subjects || [] });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ADD a subject
router.post('/me/subjects', auth, async (req, res) => {
  try {
    const { subject } = req.body;
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ msg: 'Invalid subject' });
    }
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (user.subjects.includes(subject)) {
      return res.status(400).json({ msg: 'Subject already exists' });
    }
    user.subjects.push(subject);
    await user.save();
    res.json({ subjects: user.subjects });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// DELETE a subject (only if not in use by any task)
router.delete('/me/subjects/:subject', auth, async (req, res) => {
  try {
    const subject = decodeURIComponent(req.params.subject);
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (!user.subjects.includes(subject)) {
      return res.status(404).json({ msg: 'Subject not found' });
    }
    // Check if any task uses this subject
    const taskInUse = await Task.findOne({ user: req.user.id, subject });
    if (taskInUse) {
      return res.status(400).json({ msg: 'Cannot delete subject in use by a task' });
    }
    user.subjects = user.subjects.filter(s => s !== subject);
    await user.save();
    res.json({ subjects: user.subjects });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router; 