const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { check, validationResult } = require('express-validator');
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
    console.error('Error fetching user:', err.message);
    res.status(500).json({ msg: 'Error fetching user data. Please try again later.' });
  }
});

// Update user profile
router.put('/me', [
  auth,
  [
    check('name', 'Name is required').optional().not().isEmpty().trim(),
    check('email', 'Please include a valid email').optional().isEmail(),
    check('password', 'Password must be at least 6 characters').optional().isLength({ min: 6 })
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const updateFields = {};
    if (req.body.name) updateFields.name = req.body.name.trim();
    if (req.body.email) updateFields.email = req.body.email.trim().toLowerCase();
    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      updateFields.password = await bcrypt.hash(req.body.password, salt);
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $set: updateFields },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error('Error updating user:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ msg: 'Invalid user data provided' });
    }
    if (err.code === 11000) {
      return res.status(400).json({ msg: 'Email address already exists' });
    }
    res.status(500).json({ msg: 'Error updating user profile. Please try again later.' });
  }
});

// GET user subjects
router.get('/me/subjects', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ subjects: user.subjects || [] });
  } catch (err) {
    console.error('Error fetching subjects:', err.message);
    res.status(500).json({ msg: 'Error fetching subjects. Please try again later.' });
  }
});

// ADD a subject
router.post('/me/subjects', [
  auth,
  [
    check('subject', 'Subject is required').not().isEmpty().trim()
  ]
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const { subject } = req.body;
    const trimmedSubject = subject.trim();
    
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    
    if (user.subjects.includes(trimmedSubject)) {
      return res.status(400).json({ msg: 'Subject already exists' });
    }
    
    user.subjects.push(trimmedSubject);
    await user.save();
    res.json({ subjects: user.subjects });
  } catch (err) {
    console.error('Error adding subject:', err.message);
    if (err.name === 'ValidationError') {
      return res.status(400).json({ msg: 'Invalid subject data provided' });
    }
    res.status(500).json({ msg: 'Error adding subject. Please try again later.' });
  }
});

// DELETE a subject (only if not in use by any task)
router.delete('/me/subjects/:subject', auth, async (req, res) => {
  try {
    const subject = decodeURIComponent(req.params.subject);
    if (!subject || typeof subject !== 'string' || !subject.trim()) {
      return res.status(400).json({ msg: 'Invalid subject' });
    }

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
    console.error('Error deleting subject:', err.message);
    res.status(500).json({ msg: 'Error deleting subject. Please try again later.' });
  }
});

module.exports = router; 