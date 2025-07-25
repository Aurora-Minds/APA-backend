const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');
const Task = require('../models/Task');
const FocusSession = require('../models/FocusSession');
const { sendEmail, sendTaskReminder, sendDailyDigest, sendWeeklyReport } = require('../services/emailService');

// @route   GET api/email-reminders/preferences
// @desc    Get user's email notification preferences
// @access  Private
router.get('/preferences', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('emailNotifications');
    res.json({ preferences: user.emailNotifications || {} });
  } catch (error) {
    console.error('Error fetching email preferences:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   PUT api/email-reminders/preferences
// @desc    Update user's email notification preferences
// @access  Private
router.put('/preferences', auth, async (req, res) => {
  try {
    const { taskReminders, dailyDigest, weeklyReport, reminderTime } = req.body;
    
    const user = await User.findById(req.user.id);
    user.emailNotifications = {
      taskReminders: taskReminders !== undefined ? taskReminders : true,
      dailyDigest: dailyDigest !== undefined ? dailyDigest : false,
      weeklyReport: weeklyReport !== undefined ? weeklyReport : true,
      reminderTime: reminderTime || '09:00' // Default to 9 AM
    };
    
    await user.save();
    res.json({ preferences: user.emailNotifications });
  } catch (error) {
    console.error('Error updating email preferences:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/email-reminders/test
// @desc    Send a test email to verify email settings
// @access  Private
router.post('/test', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    
    if (!user.email) {
      return res.status(400).json({ msg: 'No email address found for user' });
    }
    
    const testResult = await sendEmail(
      user.email,
      'taskReminder',
      [user.name, 'Test Task', new Date().toLocaleDateString()]
    );
    
    if (testResult.success) {
      res.json({ 
        msg: `Test email sent successfully to ${user.email}`,
        userEmail: user.email,
        userName: user.name
      });
    } else {
      res.status(500).json({ msg: 'Failed to send test email', error: testResult.error });
    }
  } catch (error) {
    console.error('Error sending test email:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET api/email-reminders/test-all-users
// @desc    Send test emails to all users (for admin testing)
// @access  Private
router.get('/test-all-users', auth, async (req, res) => {
  try {
    // Get all users with emails
    const users = await User.find({ email: { $exists: true, $ne: null } });
    
    const results = [];
    for (const user of users) {
      try {
        const testResult = await sendEmail(
          user.email,
          'taskReminder',
          [user.name, 'Test Task', new Date().toLocaleDateString()]
        );
        
        results.push({
          user: user.name,
          email: user.email,
          success: testResult.success,
          error: testResult.error || null
        });
      } catch (error) {
        results.push({
          user: user.name,
          email: user.email,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({ 
      msg: `Test emails sent to ${users.length} users`,
      results 
    });
  } catch (error) {
    console.error('Error sending test emails to all users:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   POST api/email-reminders/send-task-reminder
// @desc    Send reminder for a specific task (for testing)
// @access  Private
router.post('/send-task-reminder/:taskId', auth, async (req, res) => {
  try {
    const task = await Task.findById(req.params.taskId);
    if (!task || task.user.toString() !== req.user.id) {
      return res.status(404).json({ msg: 'Task not found' });
    }
    
    const user = await User.findById(req.user.id);
    
    if (!user.email) {
      return res.status(400).json({ msg: 'No email address found for user' });
    }
    
    const reminderResult = await sendTaskReminder(
      user.email,
      user.name,
      task.title,
      task.dueDate
    );
    
    if (reminderResult.success) {
      res.json({ msg: `Task reminder sent successfully to ${user.email}` });
    } else {
      res.status(500).json({ msg: 'Failed to send reminder', error: reminderResult.error });
    }
  } catch (error) {
    console.error('Error sending task reminder:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router; 