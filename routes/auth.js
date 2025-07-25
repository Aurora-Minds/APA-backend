const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { check, validationResult } = require('express-validator');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { google } = require('googleapis');

// Google OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

const scopes = [
  'https://www.googleapis.com/auth/calendar.events'
];

// @route   GET api/auth/google
// @desc    Initiate Google OAuth2 flow
// @access  Private
router.get('/google', auth, (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: req.user.id // Pass user ID in state to associate tokens with user
  });
  res.redirect(url);
});

// @route   GET api/auth/google/callback
// @desc    Google OAuth2 callback
// @access  Public
router.get('/google/callback', async (req, res) => {
    const { code, state } = req.query;
    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        // Find user by ID from state and save refresh token
        const user = await User.findById(state);
        if (user) {
            user.googleRefreshToken = tokens.refresh_token;
            await user.save();
        }

        // Redirect to settings page with success message
        res.redirect('/settings?google_auth=success');
    } catch (err) {
        console.error('Error with Google OAuth2 callback:', err);
        res.redirect('/settings?google_auth=error');
    }
});

// @route   POST api/auth/register
// @desc    Register user
// @access  Public
router.post('/register', [
    check('name', 'Name is required').not().isEmpty(),
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Please enter a password with 6 or more characters').isLength({ min: 6 })
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { name, email, password } = req.body;

    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        user = new User({
            name,
            email,
            password
        });

        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);

        await user.save();

        const payload = {
            user: {
                id: user.id
            }
        };

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'aurora-minds-jwt-secret-2024',
            { expiresIn: '24h' },
            (err, token) => {
                if (err) throw err;
                const userResponse = { ...user._doc };
                delete userResponse.password;
                res.json({ token, user: userResponse });
            }
        );
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', [
    check('email', 'Please include a valid email').isEmail(),
    check('password', 'Password is required').exists(),
    check('rememberMe', 'Remember me must be a boolean').optional().isBoolean()
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, rememberMe } = req.body;

    try {
        let user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const payload = {
            user: {
                id: user.id
            }
        };

        // Set token expiration based on rememberMe
        const expiresIn = rememberMe ? '7d' : '24h'; // 7 days if rememberMe is true, 24 hours if false

        jwt.sign(
            payload,
            process.env.JWT_SECRET || 'aurora-minds-jwt-secret-2024',
            { expiresIn },
            (err, token) => {
                if (err) throw err;
                const userResponse = { ...user._doc };
                delete userResponse.password;
                res.json({ token, user: userResponse });
            }
        );
    } catch (err) {
        console.error('Error during login:', err.message);
        res.status(500).json({ msg: 'Server error during login' });
    }
});

router.get('/', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json({ user });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router; 