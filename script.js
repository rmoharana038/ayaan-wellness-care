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

// Use environment variable REPO_PATH or fallback to current directory
const repoPath = process.env.REPO_PATH || path.resolve(__dirname);

// Ensure the images directory exists
const imagesDir = path.join(repoPath, 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir, { recursive: true });
}

// Configure git
const git = simpleGit(repoPath);

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, imagesDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from repoPath
app.use(express.static(repoPath));

// API endpoint to update website content
app.post('/api/update-content', async (req, res) => {
  try {
    const { section, content } = req.body;
    
    // Update the index.html file based on the section and content
    await updateWebsiteContent(section, content);
    
    // Commit and push changes to GitHub
    await commitAndPushChanges(`Update ${section} section content`);
    
    // Trigger Render deployment
    await triggerRenderDeploy();
    
    res.status(200).json({ success: true, message: 'Content updated and deployed successfully' });
  } catch (error) {
    console.error('Error updating content:', error);
    res.status(500).json({ success: false, message: 'Error updating content', error: error.message });
  }
});

// API endpoint to handle file uploads
app.post('/api/upload-image', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const { section } = req.body;
    const imagePath = `images/${req.file.filename}`;
    
    // Update image reference in index.html if section is provided
    if (section) {
      await updateImageReference(section, imagePath);
    }
    
    // Commit and push changes to GitHub
    await commitAndPushChanges(`Update ${section} image`);
    
    // Trigger Render deployment
    await triggerRenderDeploy();
    
    res.status(200).json({ 
      success: true, 
      message: 'Image uploaded successfully', 
      imagePath: imagePath 
    });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ success: false, message: 'Error uploading image', error: error.message });
  }
});

// Function to update website content in index.html
async function updateWebsiteContent(section, content) {
  const indexPath = path.join(repoPath, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  
  switch (section) {
    case 'general':
      indexHtml = indexHtml.replace(/<title>.*?<\/title>/, `<title>${content.siteTitle}</title>`);
      indexHtml = indexHtml.replace(/<div class="logo">\s*<h1>.*?<\/h1>/, `<div class="logo">\n        <h1>${content.logoText}</h1>`);
      break;
    case 'hero':
      indexHtml = indexHtml.replace(/<div class="hero-content">\s*<h1>.*?<\/h1>/, `<div class="hero-content">\n                <h1>${content.title}</h1>`);
      indexHtml = indexHtml.replace(/<div class="hero-content">\s*<h1>.*?<\/h1>\s*<p>.*?<\/p>/, 
        `<div class="hero-content">\n                <h1>${content.title}</h1>\n                <p>${content.text}</p>`);
      const heroContentRegex = /<div class="hero-content">\s*<h1>.*?<\/h1>\s*<p>.*?<\/p>\s*<p>.*?<\/p>/;
      const heroContentReplacement = `<div class="hero-content">\n                <h1>${content.title}</h1>\n                <p>${content.text}</p>\n                <p>${content.subtext}</p>`;
      indexHtml = indexHtml.replace(heroContentRegex, heroContentReplacement);
      indexHtml = indexHtml.replace(/<a href="#contact" class="btn">.*?<\/a>/, `<a href="#contact" class="btn">${content.buttonText}</a>`);
      break;
    // Add more cases as needed
  }
  
  fs.writeFileSync(indexPath, indexHtml, 'utf8');
}

// Function to update image references in index.html
async function updateImageReference(section, imagePath) {
  const indexPath = path.join(repoPath, 'index.html');
  let indexHtml = fs.readFileSync(indexPath, 'utf8');
  
  switch (section) {
    case 'hero':
      indexHtml = indexHtml.replace(/src="images\/.*?" alt="Fitness Trainer" id="trainer-image"/, `src="${imagePath}" alt="Fitness Trainer" id="trainer-image"`);
      break;
    // Add more cases as needed
  }
  
  fs.writeFileSync(indexPath, indexHtml, 'utf8');
}

// Function to commit and push changes to GitHub
async function commitAndPushChanges(commitMessage) {
  try {
    await git.add('.');
    await git.commit(commitMessage);
    
    const repoUrl = `https://${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}.git`;
    
    await git.removeRemote('origin').catch(() => {});
    await git.addRemote('origin', repoUrl);
    
    await git.push('origin', process.env.GITHUB_BRANCH || 'main');
    
    console.log('Changes pushed to GitHub successfully');
  } catch (error) {
    console.error('Error pushing changes to GitHub:', error);
    throw error;
  }
}

// Function to trigger Render deployment
async function triggerRenderDeploy() {
  try {
    if (!process.env.RENDER_API_KEY || !process.env.RENDER_SERVICE_ID) {
      console.log('Render API key or service ID not provided. Skipping deployment trigger.');
      return;
    }
    
    const response = await axios.post(
      `https://api.render.com/v1/services/${process.env.RENDER_SERVICE_ID}/deploys`,
      {},
      {
        headers: {
          'Authorization': `Bearer ${process.env.RENDER_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    console.log('Render deployment triggered successfully:', response.data);
  } catch (error) {
    console.error('Error triggering Render deployment:', error);
    throw error;
  }
}

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
