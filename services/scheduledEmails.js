const cron = require('node-cron');
const User = require('../models/User');
const Task = require('../models/Task');
const FocusSession = require('../models/FocusSession');
const { sendDailyDigest, sendWeeklyReport, sendTaskReminder } = require('./emailService');

// Daily digest job - runs at 9 AM every day
const scheduleDailyDigest = () => {
  cron.schedule('0 9 * * *', async () => {
    console.log('Running daily digest job...');
    
    try {
      const users = await User.find({ 'emailNotifications.dailyDigest': true });
      
      for (const user of users) {
        try {
          // Check if user has email
          if (!user.email) {
            console.log(`Skipping user ${user._id} - no email address`);
            continue;
          }
          
          // Get today's date
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          // Get today's focus sessions
          const focusSessions = await FocusSession.find({
            user: user._id,
            startTime: { $gte: today, $lt: tomorrow }
          });
          
          // Calculate focus stats
          const totalTime = focusSessions.reduce((total, session) => {
            return total + (session.duration || 0);
          }, 0);
          
          const focusStats = {
            sessions: focusSessions.length,
            totalTime: Math.round(totalTime / 60), // Convert to minutes
            completedTasks: 0 // Will be calculated from tasks
          };
          
          // Get upcoming tasks (due in next 3 days)
          const threeDaysFromNow = new Date();
          threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
          
          const upcomingTasks = await Task.find({
            user: user._id,
            dueDate: { $gte: today, $lte: threeDaysFromNow },
            completed: false
          }).limit(5);
          
          // Send daily digest
          await sendDailyDigest(user.email, user.name, upcomingTasks, focusStats);
          console.log(`Daily digest sent to ${user.email}`);
          
        } catch (error) {
          console.error(`Error sending daily digest to ${user.email}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in daily digest job:', error);
    }
  });
};

// Weekly report job - runs every Sunday at 6 PM
const scheduleWeeklyReport = () => {
  cron.schedule('0 18 * * 0', async () => {
    console.log('Running weekly report job...');
    
    try {
      const users = await User.find({ 'emailNotifications.weeklyReport': true });
      
      for (const user of users) {
        try {
          // Check if user has email
          if (!user.email) {
            console.log(`Skipping user ${user._id} - no email address`);
            continue;
          }
          
          // Get last week's date range
          const now = new Date();
          const lastWeek = new Date(now);
          lastWeek.setDate(lastWeek.getDate() - 7);
          
          // Get last week's focus sessions
          const focusSessions = await FocusSession.find({
            user: user._id,
            startTime: { $gte: lastWeek, $lte: now }
          });
          
          // Get last week's completed tasks
          const completedTasks = await Task.find({
            user: user._id,
            completed: true,
            completedAt: { $gte: lastWeek, $lte: now }
          });
          
          // Calculate weekly stats
          const totalTime = focusSessions.reduce((total, session) => {
            return total + (session.duration || 0);
          }, 0);
          
          const avgDailyFocus = focusSessions.length > 0 ? Math.round(totalTime / (60 * 7)) : 0;
          const productivityScore = Math.min(100, Math.round((completedTasks.length / 10) * 100));
          
          const weeklyStats = {
            totalSessions: focusSessions.length,
            totalTime: Math.round(totalTime / 60), // Convert to minutes
            completedTasks: completedTasks.length,
            avgDailyFocus: avgDailyFocus,
            productivityScore: productivityScore
          };
          
          // Send weekly report
          await sendWeeklyReport(user.email, user.name, weeklyStats);
          console.log(`Weekly report sent to ${user.email}`);
          
        } catch (error) {
          console.error(`Error sending weekly report to ${user.email}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in weekly report job:', error);
    }
  });
};

// Task reminder job - runs every hour to check for due tasks
const scheduleTaskReminders = () => {
  cron.schedule('0 * * * *', async () => {
    console.log('Running task reminder job...');
    
    try {
      const users = await User.find({ 'emailNotifications.taskReminders': true });
      
      for (const user of users) {
        try {
          // Check if user has email
          if (!user.email) {
            console.log(`Skipping user ${user._id} - no email address`);
            continue;
          }
          
          // Get tasks due in the next 24 hours
          const now = new Date();
          const tomorrow = new Date(now);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          const dueTasks = await Task.find({
            user: user._id,
            dueDate: { $gte: now, $lte: tomorrow },
            completed: false
          });
          
          // Send reminders for each due task
          for (const task of dueTasks) {
            // Check if we already sent a reminder for this task today
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            
            if (!task.lastReminderSent || task.lastReminderSent < today) {
              await sendTaskReminder(
                user.email,
                user.name,
                task.title,
                task.dueDate
              );
              
              // Update task to mark reminder as sent
              task.lastReminderSent = new Date();
              await task.save();
              
              console.log(`Task reminder sent to ${user.email} for task: ${task.title}`);
            }
          }
          
        } catch (error) {
          console.error(`Error sending task reminders to ${user.email}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in task reminder job:', error);
    }
  });
};

// Initialize all scheduled jobs
const initScheduledEmails = () => {
  scheduleDailyDigest();
  scheduleWeeklyReport();
  scheduleTaskReminders();
  console.log('Scheduled email jobs initialized');
};

module.exports = {
  initScheduledEmails
}; 