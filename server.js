require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname))); // Serve static files from the root

// Multer setup for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'images')),
    filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// API: Update content
app.post('/api/update-content', async (req, res) => {
    try {
        const { section, content } = req.body;
        const indexPath = path.join(__dirname, 'index.html');

        if (!fs.existsSync(indexPath)) {
            throw new Error('index.html not found');
        }

        await updateWebsiteContent(indexPath, section, content);
        await commitAndPushChanges(`Update ${section} section content`);

        res.status(200).json({ success: true, message: 'Content updated and pushed to GitHub' });
    } catch (error) {
        console.error('❌ Error updating content:', error);
        res.status(500).json({ success: false, message: 'Error updating content', error: error.message });
    }
});

// API: Upload image
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const { section } = req.body;
        const imagePath = `images/${req.file.filename}`;
        const indexPath = path.join(__dirname, 'index.html');

        if (section && fs.existsSync(indexPath)) {
            await updateImageReference(indexPath, section, imagePath);
        }

        await commitAndPushChanges(`Update ${section} image`);

        res.status(200).json({ success: true, message: 'Image uploaded successfully', imagePath });
    } catch (error) {
        console.error('❌ Error uploading image:', error);
        res.status(500).json({ success: false, message: 'Error uploading image', error: error.message });
    }
});

// Update content in index.html
async function updateWebsiteContent(indexPath, section, content) {
    let html = fs.readFileSync(indexPath, 'utf8');

    // Use DOM manipulation to update content
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html);
    const document = dom.window.document;

    switch (section) {
        case 'general':
            document.title = content.siteTitle;
            document.querySelector('.logo h1').textContent = content.logoText;
            break;
        case 'hero':
            document.querySelector('.hero-content h1').textContent = content.title;
            document.querySelector('.hero-content p:nth-of-type(1)').textContent = content.text;
            document.querySelector('.hero-content p:nth-of-type(2)').textContent = content.subtext;
            document.querySelector('.hero-content .btn').textContent = content.buttonText;
            break;
        // Add more cases for other sections
    }

    fs.writeFileSync(indexPath, dom.serialize(), 'utf8');
}

// Update image paths in index.html
async function updateImageReference(indexPath, section, imagePath) {
    let html = fs.readFileSync(indexPath, 'utf8');
    const { JSDOM } = require('jsdom');
    const dom = new JSDOM(html);
    const document = dom.window.document;

    switch (section) {
        case 'hero':
            document.getElementById('trainer-image').src = imagePath;
            break;
        case 'about':
            document.getElementById('about-image').src = imagePath;
            break;
        // Add more image references as needed
    }

    fs.writeFileSync(indexPath, dom.serialize(), 'utf8');
}

// Commit and push to GitHub
async function commitAndPushChanges(message) {
    return new Promise((resolve, reject) => {
        const commands = [
            'git config --global user.email "gemini-bot@google.com"',
            'git config --global user.name "Gemini Bot"',
            'git add .',
            `git commit -m "${message}"`,
            `git push https://${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}.git HEAD:${process.env.GITHUB_BRANCH}`
        ];

        exec(commands.join(' && '), (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return reject(error);
            }
            console.log(`stdout: ${stdout}`);
            console.error(`stderr: ${stderr}`);
            resolve(stdout);
        });
    });
}

// Start server
app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
});