const express = require('express');
const passport = require('passport');
const GitHubStrategy = require('passport-github2').Strategy;
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const router = express.Router();

// GitHub OAuth Strategy
passport.use(new GitHubStrategy({
    clientID: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
    callbackURL: "https://api.auroraminds.xyz/api/auth/github/callback"
  },
  async function(accessToken, refreshToken, profile, done) {
    try {
      console.log('GitHub OAuth profile:', {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        emails: profile.emails ? profile.emails.length : 0,
        photos: profile.photos ? profile.photos.length : 0
      });
      
      // Check if user already exists
      let user = await User.findOne({ githubId: profile.id });
      
      if (user) {
        // User exists, update profile info
        user.githubUsername = profile.username;
        user.githubAvatar = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;
        user.name = profile.displayName || profile.username;
        await user.save();
        return done(null, user);
      }
      
      // Check if user exists with same email (only if email exists)
      if (profile.emails && profile.emails.length > 0) {
        user = await User.findOne({ email: profile.emails[0].value });
        
        if (user) {
          // Link GitHub account to existing user
          user.githubId = profile.id;
          user.githubUsername = profile.username;
          user.githubAvatar = profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null;
          user.provider = 'github';
          await user.save();
          return done(null, user);
        }
      }
      
      // Create new user
      const userData = {
        name: profile.displayName || profile.username,
        githubId: profile.id,
        githubUsername: profile.username,
        githubAvatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
        provider: 'github'
      };
      
      // Add email if available
      if (profile.emails && profile.emails.length > 0) {
        userData.email = profile.emails[0].value;
      }
      
      user = new User(userData);
      
      await user.save();
      return done(null, user);
    } catch (error) {
      return done(error, null);
    }
  }
));

// Serialize user for session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

// GitHub OAuth routes
router.get('/github',
  passport.authenticate('github', { scope: [ 'user:email' ] })
);

router.get('/github/callback', 
  passport.authenticate('github', { failureRedirect: '/login' }),
  (req, res) => {
    try {
      // Successful authentication, redirect to frontend with token
      const payload = {
        user: {
          id: req.user._id
        }
      };
      
      const token = jwt.sign(
        payload,
        process.env.JWT_SECRET || 'aurora-minds-jwt-secret-2024',
        { expiresIn: '7d' }
      );
      
      console.log('GitHub OAuth successful for user:', req.user._id);
      
      // Redirect to frontend with token
      res.redirect(`https://www.auroraminds.xyz/auth-callback?token=${token}&success=true`);
    } catch (error) {
      console.error('Error in GitHub callback:', error);
      res.redirect(`https://www.auroraminds.xyz/login?error=oauth_failed`);
    }
  }
);

// Get current user (for checking if authenticated)
router.get('/user', (req, res) => {
  if (req.isAuthenticated()) {
    res.json({ user: req.user });
  } else {
    res.status(401).json({ message: 'Not authenticated' });
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ message: 'Error logging out' });
    }
    res.json({ message: 'Logged out successfully' });
  });
});

module.exports = router; 