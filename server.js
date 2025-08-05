require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { exec } = require('child_process');
const { JSDOM } = require('jsdom');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.static(__dirname));

// --- Multer Setup for Image Uploads ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, 'images')),
    filename: (req, file, cb) => cb(null, file.originalname),
});
const upload = multer({ storage });

// --- Centralized Error Handling ---
const handleError = (res, message, error) => {
    console.error(`❌ ${message}:`, error);
    res.status(500).json({ success: false, message, error: error.message });
};

// --- API Endpoints ---

app.post('/api/update-content', async (req, res) => {
    console.log('✅ Received request to /api/update-content');
    try {
        const { section, content } = req.body;
        const indexPath = path.join(__dirname, 'index.html');

        if (!fs.existsSync(indexPath)) {
            throw new Error('index.html not found');
        }

        const html = fs.readFileSync(indexPath, 'utf8');
        const dom = new JSDOM(html);
        const { document } = dom.window;

        // --- Master Update Function ---
        updateContent(document, section, content);

        fs.writeFileSync(indexPath, dom.serialize(), 'utf8');
        await commitAndPushChanges(`Update ${section} content`);

        res.status(200).json({ success: true, message: 'Content updated and pushed to GitHub' });
    } catch (error) {
        handleError(res, 'Error updating content', error);
    }
});

app.post('/api/upload-image', upload.single('image'), async (req, res) => {
    console.log('✅ Received request to /api/upload-image');
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const { section } = req.body;
        const imagePath = `images/${req.file.filename}`;
        const indexPath = path.join(__dirname, 'index.html');

        if (section && fs.existsSync(indexPath)) {
            const html = fs.readFileSync(indexPath, 'utf8');
            const dom = new JSDOM(html);
            const { document } = dom.window;

            updateImageReference(document, section, imagePath);

            fs.writeFileSync(indexPath, dom.serialize(), 'utf8');
            await commitAndPushChanges(`Update ${section} image`);
        }

        res.status(200).json({ success: true, message: 'Image uploaded successfully', imagePath });
    } catch (error) {
        handleError(res, 'Error uploading image', error);
    }
});

// --- HTML Manipulation Functions ---

function updateContent(document, section, content) {
    const selectors = {
        general: {
            title: 'title',
            logo: '.logo h1',
        },
        hero: {
            title: '.hero-content h1',
            text: '.hero-content p:nth-of-type(1)',
            subtext: '.hero-content p:nth-of-type(2)',
            button: '.hero-content .btn',
        },
        about: {
            title: '#about .section-header h2',
            subtitle: '.about-text h3',
            text: '.about-text p',
            button: '.about-text .btn',
        },
        services: {
            title: '#services .section-header h2',
            list: '.services-grid',
        },
        testimonials: {
            title: '#testimonials .section-header h2',
            list: '.testimonial-slider',
        },
        contact: {
            title: '#contact .section-header h2',
            subtitle: '.contact-info h3',
            text: '.contact-info > p',
            email: '.contact-item:nth-of-type(1) p',
            phone: '.contact-item:nth-of-type(2) p',
            location: '.contact-item:nth-of-type(3) p',
            instagram: '.social-links a:nth-of-type(1)',
            facebook: '.social-links a:nth-of-type(2)',
            youtube: '.social-links a:nth-of-type(3)',
        },
        footer: {
            logo: '.footer-logo h2',
            tagline: '.footer-logo p',
            newsletterTitle: '.footer-newsletter h3',
            newsletterText: '.footer-newsletter p',
            copyright: '.footer-bottom p',
        },
    };

    if (!selectors[section]) return;

    for (const key in content) {
        if (selectors[section][key]) {
            const element = document.querySelector(selectors[section][key]);
            if (element) {
                if (key.includes('link')) {
                    element.href = content[key];
                } else {
                    element.innerHTML = content[key];
                }
            }
        }
    }

    // Handle dynamic lists
    if (section === 'services' && content.services) {
        const container = document.querySelector(selectors.services.list);
        container.innerHTML = ''; // Clear existing services
        content.services.forEach(s => {
            const card = document.createElement('div');
            card.className = 'service-card';
            card.innerHTML = `<div class="service-icon"><i class="${s.icon}"></i></div><h3>${s.title}</h3><p>${s.desc}</p>`;
            container.appendChild(card);
        });
    }

    if (section === 'testimonials' && content.testimonials) {
        const container = document.querySelector(selectors.testimonials.list);
        container.innerHTML = ''; // Clear existing testimonials
        content.testimonials.forEach((t, index) => {
            const slide = document.createElement('div');
            slide.className = `testimonial-slide${index === 0 ? ' active' : ''}`;
            slide.innerHTML = `<div class="testimonial-content"><div class="quote"><i class="fas fa-quote-left"></i></div><p>${t.text}</p><div class="client-info"><h4>${t.name}</h4><p>${t.info}</p></div></div>`;
            container.appendChild(slide);
        });
        // Re-add controls if they were cleared
        const controls = document.createElement('div');
        controls.className = 'testimonial-controls';
        controls.innerHTML = '<button class="prev-btn"><i class="fas fa-chevron-left"></i></button><button class="next-btn"><i class="fas fa-chevron-right"></i></button>';
        container.appendChild(controls);
    }
}

function updateImageReference(document, section, imagePath) {
    const selector = {
        hero: '#trainer-image',
        about: '#about-image',
    }[section];

    if (selector) {
        const element = document.querySelector(selector);
        if (element) {
            element.src = imagePath;
        }
    }
}

// --- Git & Deployment ---

async function commitAndPushChanges(message) {
    return new Promise((resolve, reject) => {
        const commands = [
            'git config --global user.email "bot@ayaanwellness.com"',
            'git config --global user.name "Ayaan Wellness Bot"',
            'git add .',
            `git commit -m "${message}"`,
            `git push https://x-access-token:${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPO_OWNER}/${process.env.GITHUB_REPO_NAME}.git HEAD:${process.env.GITHUB_BRANCH}`
        ].join(' && ');

        exec(commands, (error, stdout, stderr) => {
            if (error) {
                console.error(`Git command failed: ${stderr}`);
                return reject(new Error(`Git push failed: ${stderr}`));
            }
            console.log(`Git command success: ${stdout}`);
            resolve(stdout);
        });
    });
}

// --- Start Server ---
app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
});
