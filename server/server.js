require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const simpleGit = require('simple-git');
const axios = require('axios');

const app = express();
const port = process.env.PORT || 3000;

// Define repository path (default: current directory or 'public' folder)
const repoPath = process.env.REPO_PATH || path.join(__dirname, 'public');
const imagesPath = path.join(repoPath, 'images');
const indexPath = path.join(repoPath, 'index.html');

// Ensure repo and images directories exist
if (!fs.existsSync(repoPath)) {
  console.error(`Repo path "${repoPath}" does not exist. Exiting.`);
  process.exit(1);
}
if (!fs.existsSync(imagesPath)) {
  fs.mkdirSync(imagesPath, { recursive: true });
}

// Initialize Git
const git = simpleGit(repoPath);

// Multer setup for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, imagesPath),
  filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(repoPath));

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API: Update content
app.post('/api/update-content', async (req, res) => {
  try {
    const { section, content } = req.body;

    if (!fs.existsSync(indexPath)) {
      throw new Error(`index.html not found in ${repoPath}`);
    }

    await updateWebsiteContent(section, content);
    await commitAndPushChanges(`Update ${section} section content`);
    await triggerRenderDeploy();

    res.status(200).json({ success: true, message: 'Content updated and deployed successfully' });
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

    if (section && fs.existsSync(indexPath)) {
      await updateImageReference(section, imagePath);
    }

    await commitAndPushChanges(`Update ${section} image`);
    await triggerRenderDeploy();

    res.status(200).json({ success: true, message: 'Image uploaded successfully', imagePath });
  } catch (error) {
    console.error('❌ Error uploading image:', error);
    res.status(500).json({ success: false, message: 'Error uploading image', error: error.message });
  }
});

// Update content in index.html
async function updateWebsiteContent(section, content) {
  let html = fs.readFileSync(indexPath, 'utf8');

  switch (section) {
    case 'general':
      html = html.replace(/<title>.*?<\/title>/, `<title>${content.siteTitle}</title>`);
      html = html.replace(/<div class="logo">\s*<h1>.*?<\/h1>/, `<div class="logo">\n        <h1>${content.logoText}</h1>`);
      break;

    case 'hero':
      const heroTitleRegex = /<div class="hero-content">\s*<h1>.*?<\/h1>/;
      const heroTextRegex = /<div class="hero-content">\s*<h1>.*?<\/h1>\s*<p>.*?<\/p>/;
      const heroFullRegex = /<div class="hero-content">\s*<h1>.*?<\/h1>\s*<p>.*?<\/p>\s*<p>.*?<\/p>/;

      if (!heroFullRegex.test(html)) {
        console.warn('⚠️ Could not match full hero section. Skipping hero update.');
        return;
      }

      html = html.replace(heroFullRegex,
        `<div class="hero-content">
                <h1>${content.title}</h1>
                <p>${content.text}</p>
                <p>${content.subtext}</p>`);

      html = html.replace(/<a href="#contact" class="btn">.*?<\/a>/,
        `<a href="#contact" class="btn">${content.buttonText}</a>`);
      break;

    // Add more sections as needed
  }

  fs.writeFileSync(indexPath, html, 'utf8');
}

// Update image paths in index.html
async function updateImageReference(section, imagePath) {
  let html = fs.readFileSync(indexPath, 'utf8');

  switch (section) {
    case 'hero':
      html = html.replace(/src="images\/.*?" alt="Fitness Trainer" id="trainer-image"/,
        `src="${imagePath}" alt="Fitness Trainer" id="trainer-image"`);
      break;

    // Add more image references as needed
  }

  fs.writeFileSync(indexPath, html, 'utf8');
}

// Commit and push to GitHub
async function commitAndPushChanges(message) {
  try {
    await git.add('.');
    await git.commit(message);

    const repoUrl = `https://${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}.git`;

    await git.removeRemote('origin').catch(() => console.log('ℹ️ No existing remote to remove'));
    await git.addRemote('origin', repoUrl);

    await git.push('origin', process.env.GITHUB_BRANCH || 'main');
    console.log('✅ Changes pushed to GitHub');
  } catch (error) {
    console.error('❌ Git push failed:', error);
    throw error;
  }
}

// Trigger deployment on Render
async function triggerRenderDeploy() {
  if (!process.env.RENDER_API_KEY || !process.env.RENDER_SERVICE_ID) {
    console.log('ℹ️ Render API key or service ID not set. Skipping deploy.');
    return;
  }

  try {
    const response = await axios.post(
      `https://api.render.com/v1/services/${process.env.RENDER_SERVICE_ID}/deploys`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('🚀 Render deploy triggered:', response.data);
  } catch (error) {
    console.error('❌ Render deployment failed:', error);
    throw error;
  }
}

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
