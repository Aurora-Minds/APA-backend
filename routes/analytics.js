const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const FocusSession = require('../models/FocusSession');
const Task = require('../models/Task');

// @route   GET api/analytics/focus-summary
// @desc    Get focus session summary for different time periods
// @access  Private
router.get('/focus-summary', auth, async (req, res) => {
  try {
    const { period = 'week' } = req.query;
    const userId = req.user.id;
    
    let startDate, endDate;
    const now = new Date();
    
    switch (period) {
      case 'today':
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'week':
        // Show last 7 days for consistency
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'month':
        // Show last 30 days for consistency
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 30);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      default:
        startDate = new Date(now);
        startDate.setDate(startDate.getDate() - 7);
        endDate = now;
    }
    
    // Get focus sessions and tasks for the specific period
    const [focusSessions, tasks] = await Promise.all([
      FocusSession.find({
        user: userId,
        startTime: { $gte: startDate, $lte: endDate }
      }).sort({ startTime: 1 }),
      Task.find({
        user: userId,
        createdAt: { $gte: startDate, $lte: endDate }
      })
    ]);
    
    // Calculate analytics
    const totalSessions = focusSessions.length;
    const totalTime = focusSessions.reduce((total, session) => total + (session.duration || 0), 0);
    const avgSessionLength = totalSessions > 0 ? Math.round(totalTime / totalSessions / 60) : 0;
    const totalHours = Math.round(totalTime / 3600 * 10) / 10;
    
    // Calculate task completion metrics
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const totalTasks = tasks.length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Daily breakdown
    const dailyStats = {};
    focusSessions.forEach(session => {
      if (session.startTime) {
        const date = session.startTime.toDateString();
        if (!dailyStats[date]) {
          dailyStats[date] = { sessions: 0, time: 0 };
        }
        dailyStats[date].sessions += 1;
        dailyStats[date].time += session.duration || 0;
      }
    });
    
    // Convert to array format for frontend
    const dailyBreakdown = Object.entries(dailyStats).map(([date, stats]) => ({
      date,
      sessions: stats.sessions,
      time: Math.round(stats.time / 60) // Convert to minutes
    }));
    
    // Productivity score (based on consistency, total time, and task completion)
    const daysWithSessions = Object.keys(dailyStats).length;
    
    // Calculate consistency based on the selected period
    let expectedDays;
    switch (period) {
      case 'today':
        expectedDays = 1;
        break;
      case 'week':
        expectedDays = 7;
        break;
      case 'month':
        expectedDays = 30;
        break;
      default:
        expectedDays = 7;
    }
    
    const consistencyScore = Math.round((daysWithSessions / expectedDays) * 100);
    
    // Ensure all values are valid numbers before calculation
    const validConsistencyScore = isNaN(consistencyScore) ? 0 : consistencyScore;
    const validTotalHours = isNaN(totalHours) ? 0 : totalHours;
    const validTaskCompletionRate = isNaN(taskCompletionRate) ? 0 : taskCompletionRate;
    
    // Weight the productivity calculation more heavily towards task completion
    const productivityScore = Math.min(100, Math.max(0, Math.round(
      (validConsistencyScore * 0.3) + (validTotalHours * 5) + (validTaskCompletionRate * 0.7)
    )));
    
    // Debug logging
    console.log('Analytics Debug:', {
      period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      totalSessions,
      totalTime: Math.round(totalTime / 60),
      totalHours,
      completedTasks,
      totalTasks,
      taskCompletionRate,
      daysWithSessions,
      expectedDays,
      consistencyScore,
      productivityScore,
      focusSessionsCount: focusSessions.length,
      tasksCount: tasks.length
    });
    
    res.json({
      period,
      summary: {
        totalSessions,
        totalTime: Math.round(totalTime / 60), // minutes
        totalHours,
        avgSessionLength,
        productivityScore,
        consistencyScore,
        completedTasks,
        totalTasks,
        taskCompletionRate
      },
      dailyBreakdown,
      focusSessions: focusSessions.map(session => ({
        id: session._id,
        startTime: session.startTime,
        duration: session.duration,
        subject: session.subject
      }))
    });
  } catch (error) {
    console.error('Error fetching focus summary:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET api/analytics/productivity-insights
// @desc    Get productivity insights and recommendations
// @access  Private
router.get('/productivity-insights', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get last 30 days of data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const focusSessions = await FocusSession.find({
      user: userId,
      startTime: { $gte: thirtyDaysAgo }
    });
    
    const tasks = await Task.find({
      user: userId,
      createdAt: { $gte: thirtyDaysAgo }
    });
    
    // Calculate insights
    const totalFocusTime = focusSessions.reduce((total, session) => total + (session.duration || 0), 0);
    const completedTasks = tasks.filter(task => task.status === 'completed').length;
    const totalTasks = tasks.length;
    const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
    
    // Best study times
    const hourlyStats = {};
    focusSessions.forEach(session => {
      if (session.startTime) {
        const hour = session.startTime.getHours();
        if (!hourlyStats[hour]) {
          hourlyStats[hour] = { sessions: 0, totalTime: 0 };
        }
        hourlyStats[hour].sessions += 1;
        hourlyStats[hour].totalTime += session.duration || 0;
      }
    });
    
    const bestHours = Object.entries(hourlyStats)
      .sort(([,a], [,b]) => b.totalTime - a.totalTime)
      .slice(0, 3)
      .map(([hour, stats]) => ({
        hour: parseInt(hour),
        sessions: stats.sessions,
        totalTime: Math.round(stats.totalTime / 60)
      }));
    
    // Subject performance
    const subjectStats = {};
    focusSessions.forEach(session => {
      const subject = session.subject || 'General';
      if (!subjectStats[subject]) {
        subjectStats[subject] = { sessions: 0, totalTime: 0 };
      }
      subjectStats[subject].sessions += 1;
      subjectStats[subject].totalTime += session.duration || 0;
    });
    
    const topSubjects = Object.entries(subjectStats)
      .sort(([,a], [,b]) => b.totalTime - a.totalTime)
      .slice(0, 5)
      .map(([subject, stats]) => ({
        subject,
        sessions: stats.sessions,
        totalTime: Math.round(stats.totalTime / 60)
      }));
    
    // Generate recommendations
    const recommendations = [];
    
    if (totalFocusTime < 3600) { // Less than 1 hour in 30 days
      recommendations.push({
        type: 'focus_time',
        title: 'Increase Focus Time',
        message: 'Try to dedicate at least 30 minutes daily to focused work sessions.',
        priority: 'high'
      });
    }
    
    if (completionRate < 70) {
      recommendations.push({
        type: 'completion_rate',
        title: 'Improve Task Completion',
        message: 'Focus on completing tasks rather than starting new ones.',
        priority: 'medium'
      });
    }
    
    if (bestHours.length > 0) {
      recommendations.push({
        type: 'optimal_time',
        title: 'Use Your Peak Hours',
        message: `Your most productive hours are ${bestHours[0].hour}:00. Schedule important tasks during these times.`,
        priority: 'low'
      });
    }
    
    res.json({
      insights: {
        totalFocusTime: Math.round(totalFocusTime / 60), // minutes
        completedTasks,
        totalTasks,
        completionRate,
        avgDailyFocus: Math.round(totalFocusTime / 30 / 60) // minutes per day
      },
      bestHours,
      topSubjects,
      recommendations
    });
  } catch (error) {
    console.error('Error fetching productivity insights:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

// @route   GET api/analytics/streak
// @desc    Get current streak information
// @access  Private
router.get('/streak', auth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get all focus sessions
    const focusSessions = await FocusSession.find({ user: userId }).sort({ startTime: -1 });
    
    // Calculate current streak
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Group sessions by date
    const sessionsByDate = {};
    focusSessions.forEach(session => {
      if (session.startTime) {
        const date = session.startTime.toDateString();
        if (!sessionsByDate[date]) {
          sessionsByDate[date] = [];
        }
        sessionsByDate[date].push(session);
      }
    });
    
    // Calculate streaks
    const dates = Object.keys(sessionsByDate).sort().reverse();
    let lastDate = null;
    
    for (const date of dates) {
      const sessionDate = new Date(date);
      
      if (lastDate === null) {
        // First date
        if (sessionDate >= today) {
          currentStreak = 1;
          tempStreak = 1;
        } else if (sessionDate >= yesterday) {
          currentStreak = 1;
          tempStreak = 1;
        } else {
          tempStreak = 1;
        }
      } else {
        const lastSessionDate = new Date(lastDate);
        const dayDiff = Math.floor((lastSessionDate - sessionDate) / (1000 * 60 * 60 * 24));
        
        if (dayDiff === 1) {
          // Consecutive day
          tempStreak++;
          if (sessionDate >= yesterday) {
            currentStreak = tempStreak;
          }
        } else {
          // Streak broken
          tempStreak = 1;
          if (sessionDate >= yesterday) {
            currentStreak = 1;
          }
        }
      }
      
      longestStreak = Math.max(longestStreak, tempStreak);
      lastDate = date;
    }
    
    res.json({
      currentStreak,
      longestStreak,
      totalSessions: focusSessions.length,
      totalFocusTime: Math.round(focusSessions.reduce((total, session) => total + (session.duration || 0), 0) / 60)
    });
  } catch (error) {
    console.error('Error calculating streak:', error);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router; 