document.addEventListener('DOMContentLoaded', () => {
    // --- Tab Navigation ---
    const navLinks = document.querySelectorAll('.admin-nav ul li a');
    const sections = document.querySelectorAll('.admin-section');

    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            document.querySelector('.admin-nav .active').classList.remove('active');
            document.querySelector('.admin-section.active').classList.remove('active');
            link.parentElement.classList.add('active');
            document.querySelector(link.getAttribute('href')).classList.add('active');
        });
    });

    // --- Reusable Functions ---
    const showNotification = (message, isSuccess = true) => {
        const notification = document.createElement('div');
        notification.className = `notification ${isSuccess ? 'success' : 'error'}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => {
            notification.classList.add('hide');
            setTimeout(() => document.body.removeChild(notification), 500);
        }, 3500);
    };

    // --- Dynamic List Management ---
    const setupDynamicList = (containerId, addButtonId, itemTemplate) => {
        const container = document.getElementById(containerId);
        const addButton = document.getElementById(addButtonId);

        const addItem = (data = {}) => {
            const item = document.createElement('div');
            item.className = 'dynamic-item';
            item.innerHTML = itemTemplate(data);
            item.querySelector('.btn-remove').addEventListener('click', () => item.remove());
            container.appendChild(item);
        };

        addButton.addEventListener('click', () => addItem());
        return { addItem };
    };

    const serviceTemplate = (data) => `
        <input type="text" class="service-title" placeholder="Service Title" value="${data.title || ''}">
        <input type="text" class="service-icon" placeholder="FontAwesome Icon (e.g., fas fa-dumbbell)" value="${data.icon || ''}">
        <textarea class="service-desc" rows="2" placeholder="Service Description">${data.desc || ''}</textarea>
        <button type="button" class="btn-remove">Remove</button>
    `;

    const testimonialTemplate = (data) => `
        <textarea class="testimonial-text" rows="3" placeholder="Testimonial Text">${data.text || ''}</textarea>
        <input type="text" class="testimonial-name" placeholder="Client Name" value="${data.name || ''}">
        <input type="text" class="testimonial-info" placeholder="Client Info (e.g., Lost 15kg)" value="${data.info || ''}">
        <button type="button" class="btn-remove">Remove</button>
    `;

    const servicesManager = setupDynamicList('services-list', 'add-service-btn', serviceTemplate);
    const testimonialsManager = setupDynamicList('testimonials-list', 'add-testimonial-btn', testimonialTemplate);

    // Initial data load (example)
    servicesManager.addItem({ title: 'Personal Training', icon: 'fas fa-dumbbell', desc: 'Customized workout plans designed specifically for your body type, goals, and lifestyle.' });
    servicesManager.addItem({ title: 'Nutrition Coaching', icon: 'fas fa-apple-alt', desc: 'Practical nutrition strategies that fit your lifestyle without extreme restrictions.' });
    testimonialsManager.addItem({ text: 'Working with Ayaan completely changed my approach to fitness. I\'ve lost 15kg and gained confidence I never thought possible.', name: 'Rahul Sharma', info: 'Lost 15kg in 6 months' });

    // --- Data Collection ---
    const collectContent = (sectionId) => {
        const content = {};
        const section = document.getElementById(sectionId);
        section.querySelectorAll('input, textarea').forEach(input => {
            if (input.id) content[input.id.split('-').pop()] = input.value;
        });

        if (sectionId === 'services') {
            content.services = Array.from(section.querySelectorAll('.dynamic-item')).map(item => ({
                title: item.querySelector('.service-title').value,
                icon: item.querySelector('.service-icon').value,
                desc: item.querySelector('.service-desc').value,
            }));
        }

        if (sectionId === 'testimonials') {
            content.testimonials = Array.from(section.querySelectorAll('.dynamic-item')).map(item => ({
                text: item.querySelector('.testimonial-text').value,
                name: item.querySelector('.testimonial-name').value,
                info: item.querySelector('.testimonial-info').value,
            }));
        }
        return content;
    };

    // --- Event Listeners for Saving ---
    document.querySelectorAll('.btn-save').forEach(button => {
        button.addEventListener('click', async (e) => {
            const section = e.target.closest('.admin-section').id;
            const content = collectContent(section);

            const originalText = button.textContent;
            button.textContent = 'Saving...';
            button.disabled = true;

            try {
                const response = await fetch('/api/update-content', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ section, content }),
                });
                const data = await response.json();
                if (!data.success) throw new Error(data.message || 'Failed to update content.');
                showNotification('Changes saved and deployed successfully!');
            } catch (error) {
                console.error('Error saving changes:', error);
                showNotification(`Error: ${error.message}`, false);
            } finally {
                button.textContent = originalText;
                button.disabled = false;
            }
        });
    });

    // --- Image Upload Handling ---
    document.querySelectorAll('.image-upload').forEach(input => {
        input.addEventListener('change', async () => {
            const file = input.files[0];
            const section = input.dataset.section;
            if (!file || !section) return;

            const formData = new FormData();
            formData.append('image', file);
            formData.append('section', section);

            const previewImg = document.getElementById(`${section}-image-preview`);
            const originalSrc = previewImg.src;
            previewImg.src = URL.createObjectURL(file); // Instant preview

            showNotification('Uploading image...');

            try {
                const response = await fetch('/api/upload-image', { method: 'POST', body: formData });
                const data = await response.json();
                if (!data.success) throw new Error(data.message || 'Image upload failed.');
                showNotification('Image uploaded and deployed successfully!');
            } catch (error) {
                console.error('Error uploading image:', error);
                showNotification(`Error: ${error.message}`, false);
                previewImg.src = originalSrc; // Revert preview on error
            }
        });
    });
});