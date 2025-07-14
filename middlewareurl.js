// .env (create this file separately in the root)
// MONGO_URI=mongodb://localhost:27017/urlShortener
// PORT=5000
// BASE_URL=http://localhost:5000

// server.js
const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const cors = require('cors');
const urlRoutes = require('./routes/urlRoutes');
const logger = require('./middleware/logger');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(logger); // custom winston logger middleware

app.use('/', urlRoutes);

mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("MongoDB connected.");
    app.listen(process.env.PORT, () => {
        console.log(`Server running on port ${process.env.PORT}`);
    });
}).catch(err => console.error(err));

// models/Url.js
const mongoose = require('mongoose');

const urlSchema = new mongoose.Schema({
    shortCode: { type: String, required: true, unique: true },
    longUrl: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true }
});

module.exports = mongoose.model('Url', urlSchema);

// routes/urlRoutes.js
const express = require('express');
const router = express.Router();
const shortid = require('shortid');
const Url = require('../models/Url');
const dotenv = require('dotenv');
dotenv.config();

const BASE_URL = process.env.BASE_URL;

router.post('/shorten', async (req, res) => {
    const { longUrl, customCode, expiresIn } = req.body;
    if (!longUrl) return res.status(400).json({ error: 'Long URL is required' });

    let shortCode = customCode || shortid.generate();

    // Validate shortCode format
    if (!/^[a-zA-Z0-9_-]{4,20}$/.test(shortCode)) {
        return res.status(400).json({ error: 'Invalid shortcode format' });
    }

    // Check for uniqueness
    const exists = await Url.findOne({ shortCode });
    if (exists) {
        return res.status(409).json({ error: 'Shortcode already exists' });
    }

    const expiresAt = expiresIn
        ? new Date(Date.now() + parseInt(expiresIn) * 60 * 1000)
        : new Date(Date.now() + 30 * 60 * 1000);

    const newUrl = new Url({ shortCode, longUrl, expiresAt });
    await newUrl.save();

    res.json({ shortUrl: `${BASE_URL}/${shortCode}`, expiresAt });
});

router.get('/:shortCode', async (req, res) => {
    const { shortCode } = req.params;
    try {
        const urlEntry = await Url.findOne({ shortCode });
        if (!urlEntry) return res.status(404).json({ error: 'Short URL not found' });

        if (new Date() > urlEntry.expiresAt) {
            return res.status(410).json({ error: 'Short URL has expired' });
        }

        res.redirect(urlEntry.longUrl);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;

// middleware/logger.js
const winston = require('winston');

const logger = winston.createLogger({
    transports: [
        new winston.transports.File({ filename: 'logs/app.log' })
    ]
});

module.exports = (req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
};

module.exports = mongoose.model('Url', urlSchema);
