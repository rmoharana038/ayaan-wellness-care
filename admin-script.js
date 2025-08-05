// Tab Navigation
const navLinks = document.querySelectorAll('.admin-nav ul li a');
const sections = document.querySelectorAll('.admin-section');

navLinks.forEach(link => {
    link.addEventListener('click', function(e) {
        e.preventDefault();
        
        // Remove active class from all links and sections
        navLinks.forEach(link => link.parentElement.classList.remove('active'));
        sections.forEach(section => section.classList.remove('active'));
        
        // Add active class to clicked link
        this.parentElement.classList.add('active');
        
        // Show corresponding section
        const targetSection = document.querySelector(this.getAttribute('href'));
        targetSection.classList.add('active');
    });
});

// Image Preview Functionality
const imageInputs = document.querySelectorAll('input[type="file"]');

imageInputs.forEach(input => {
    input.addEventListener('change', function() {
        const file = this.files[0];
        if (file) {
            const reader = new FileReader();
            const previewId = this.id + '-preview';
            const previewImg = document.getElementById(previewId);
            
            reader.addEventListener('load', function() {
                previewImg.src = this.result;
            });
            
            reader.readAsDataURL(file);
        }
    });
});

// Add New Service
const addServiceBtn = document.querySelector('.btn-add-service');
const servicesList = document.querySelector('.services-list');
let serviceCount = 3; // Starting with 3 

if (addServiceBtn) {
    addServiceBtn.addEventListener('click', function() {
        serviceCount++;
        const newService = document.createElement('div');
        newService.className = 'service-item';
        newService.innerHTML = `
            <div class="form-group">
                <label for="service-title-${serviceCount}">Service Title</label>
                <input type="text" id="service-title-${serviceCount}" placeholder="Service Title">
            </div>
            <div class="form-group">
                <label for="service-desc-${serviceCount}">Service Description</label>
                <textarea id="service-desc-${serviceCount}" rows="3" placeholder="Service Description"></textarea>
            </div>
            <div class="form-group">
                <label for="service-icon-${serviceCount}">Service Icon (FontAwesome class)</label>
                <input type="text" id="service-icon-${serviceCount}" placeholder="fas fa-dumbbell">
            </div>
            <button class="btn-remove-service">Remove</button>
        `;
        servicesList.appendChild(newService);
        
        // Add event listener to the new remove button
        newService.querySelector('.btn-remove-service').addEventListener('click', function() {
            servicesList.removeChild(newService);
        });
    });
}

// Save Changes Functionality
const saveButtons = document.querySelectorAll('.btn-save');

// <-- FIXED HERE: Use relative API URL -->
const apiUrl = '/api'; // Use relative path for deployed environment

// Function to show notification
function showNotification(message, isSuccess = true) {
    const notification = document.createElement('div');
    notification.className = `notification ${isSuccess ? 'success' : 'error'}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Remove notification after 3 seconds
    setTimeout(() => {
        notification.classList.add('hide');
        setTimeout(() => {
            document.body.removeChild(notification);
        }, 500);
    }, 3000);
}

// Function to handle image uploads
async function uploadImage(file, section) {
    const formData = new FormData();
    formData.append('image', file);
    formData.append('section', section);
    
    try {
        const response = await fetch(`${apiUrl}/upload-image`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (!data.success) {
            throw new Error(data.message || 'Error uploading image');
        }
        
        return data.imagePath;
    } catch (error) {
        console.error('Error uploading image:', error);
        throw error;
    }
}

// Add event listeners to save buttons
saveButtons.forEach(button => {
    button.addEventListener('click', async function() {
        // Get the section ID
        const section = this.closest('.admin-section').id;
        let content = {};
        
        // Show loading state
        const originalText = this.textContent;
        this.textContent = 'Saving...';
        this.disabled = true;
        
        try {
            // Collect data based on the section
            switch (section) {
                case 'general':
                    content = {
                        siteTitle: document.getElementById('site-title').value,
                        logoText: document.getElementById('site-logo').value,
                        primaryColor: document.getElementById('primary-color').value
                    };
                    
                    // Handle favicon upload if file is selected
                    const faviconInput = document.getElementById('favicon');
                    if (faviconInput.files.length > 0) {
                        try {
                            await uploadImage(faviconInput.files[0], 'favicon');
                        } catch (error) {
                            console.error('Error uploading favicon:', error);
                        }
                    }
                    break;
                    
                case 'hero':
                    content = {
                        title: document.getElementById('hero-title').value,
                        text: document.getElementById('hero-text').value,
                        subtext: document.getElementById('hero-subtext').value,
                        buttonText: document.getElementById('hero-button').value
                    };
                    
                    // Handle hero image upload if file is selected
                    const heroImageInput = document.getElementById('hero-image');
                    if (heroImageInput.files.length > 0) {
                        try {
                            await uploadImage(heroImageInput.files[0], 'hero');
                        } catch (error) {
                            console.error('Error uploading hero image:', error);
                        }
                    }
                    break;
                    
                // Add more cases for other sections
                // ...
            }
            
            // Send the content to the server
            const response = await fetch(`${apiUrl}/update-content`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ section, content })
            });
            
            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Error updating content');
            }
            
            showNotification('Changes saved and deployed successfully!');
        } catch (error) {
            console.error('Error saving changes:', error);
            showNotification(`Error: ${error.message}`, false);
        } finally {
            // Restore button state
            this.textContent = originalText;
            this.disabled = false;
        }
    });
});
