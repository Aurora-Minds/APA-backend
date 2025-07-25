const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Email templates
const emailTemplates = {
  taskReminder: (userName, taskTitle, dueDate) => ({
    subject: `Reminder: ${taskTitle} is due soon`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4318ff;">Aurora Minds - Task Reminder</h2>
        <p>Hi ${userName},</p>
        <p>This is a friendly reminder that your task <strong>"${taskTitle}"</strong> is due on <strong>${dueDate}</strong>.</p>
        <p>Don't let procrastination win! Take action now and turn your goals into achievements.</p>
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Quick Actions:</h3>
          <ul>
            <li>Start working on the task now</li>
            <li>Break it down into smaller steps</li>
            <li>Set a focus timer for 25 minutes</li>
            <li>Update the task status</li>
          </ul>
        </div>
        <p>Login to your account: <a href="https://www.auroraminds.xyz" style="color: #4318ff;">Aurora Minds</a></p>
        <p>Best regards,<br>The Aurora Minds Team</p>
      </div>
    `
  }),
  
  dailyDigest: (userName, tasks, focusStats) => ({
    subject: 'Your Daily Aurora Minds Digest',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4318ff;">Aurora Minds - Daily Digest</h2>
        <p>Hi ${userName},</p>
        <p>Here's your productivity summary for today:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Today's Focus Stats:</h3>
          <p><strong>Focus Sessions:</strong> ${focusStats.sessions || 0}</p>
          <p><strong>Total Focus Time:</strong> ${focusStats.totalTime || 0} minutes</p>
          <p><strong>Tasks Completed:</strong> ${focusStats.completedTasks || 0}</p>
        </div>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Upcoming Tasks:</h3>
          ${tasks.length > 0 ? 
            `<ul>${tasks.map(task => `<li>${task.title} - Due: ${task.dueDate}</li>`).join('')}</ul>` :
            '<p>No upcoming tasks! Great job staying on top of things.</p>'
          }
        </div>
        
        <p>Keep up the great work! Login to continue your productivity journey: <a href="https://www.auroraminds.xyz" style="color: #4318ff;">Aurora Minds</a></p>
        <p>Best regards,<br>The Aurora Minds Team</p>
      </div>
    `
  }),
  
  weeklyReport: (userName, weeklyStats) => ({
    subject: 'Your Weekly Aurora Minds Report',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4318ff;">Aurora Minds - Weekly Report</h2>
        <p>Hi ${userName},</p>
        <p>Here's your productivity summary for this week:</p>
        
        <div style="background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Weekly Stats:</h3>
          <p><strong>Total Focus Sessions:</strong> ${weeklyStats.totalSessions || 0}</p>
          <p><strong>Total Focus Time:</strong> ${weeklyStats.totalTime || 0} minutes</p>
          <p><strong>Tasks Completed:</strong> ${weeklyStats.completedTasks || 0}</p>
          <p><strong>Average Daily Focus:</strong> ${weeklyStats.avgDailyFocus || 0} minutes</p>
          <p><strong>Productivity Score:</strong> ${weeklyStats.productivityScore || 0}%</p>
        </div>
        
        <p>Great job this week! Keep pushing towards your goals.</p>
        <p>Login to view detailed analytics: <a href="https://www.auroraminds.xyz" style="color: #4318ff;">Aurora Minds</a></p>
        <p>Best regards,<br>The Aurora Minds Team</p>
      </div>
    `
  })
};

// Send email function
const sendEmail = async (to, template, data) => {
  try {
    const emailContent = emailTemplates[template](...data);
    
    const mailOptions = {
      from: `"Aurora Minds" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: emailContent.subject,
      html: emailContent.html
    };
    
    const result = await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to ${to}:`, result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error(`Error sending email to ${to}:`, error);
    return { success: false, error: error.message };
  }
};

// Send task reminder
const sendTaskReminder = async (userEmail, userName, taskTitle, dueDate) => {
  return await sendEmail(userEmail, 'taskReminder', [userName, taskTitle, dueDate]);
};

// Send daily digest
const sendDailyDigest = async (userEmail, userName, tasks, focusStats) => {
  return await sendEmail(userEmail, 'dailyDigest', [userName, tasks, focusStats]);
};

// Send weekly report
const sendWeeklyReport = async (userEmail, userName, weeklyStats) => {
  return await sendEmail(userEmail, 'weeklyReport', [userName, weeklyStats]);
};

module.exports = {
  sendEmail,
  sendTaskReminder,
  sendDailyDigest,
  sendWeeklyReport
}; 