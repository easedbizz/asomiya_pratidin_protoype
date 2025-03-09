// Modified survey.js for static GitHub Pages deployment

// Wait for Firebase to be initialized
window.addEventListener('firebaseInitialized', () => {
    setupSurveyorPage();
    checkAuthentication();
});

function setupSurveyorPage() {
    // Get current location
    document.getElementById('locationButton').addEventListener('click', function() {
        const locationText = document.getElementById('locationText');
        const locationLoading = document.getElementById('locationLoading');
        const locationCoordinates = document.getElementById('locationCoordinates');
        
        locationLoading.style.display = 'block';
        
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                // Success callback
                function(position) {
                    locationLoading.style.display = 'none';
                    locationCoordinates.style.display = 'block';
                    
                    const latitude = position.coords.latitude;
                    const longitude = position.coords.longitude;
                    
                    // Store the coordinates in hidden fields
                    document.getElementById('latitude').value = latitude;
                    document.getElementById('longitude').value = longitude;
                    
                    // Display coordinates
                    document.getElementById('displayLatitude').textContent = latitude.toFixed(8);
                    document.getElementById('displayLongitude').textContent = longitude.toFixed(8);
                    
                    // Update text
                    locationText.textContent = 'Location acquired';
                },
                // Error callback
                function(error) {
                    locationLoading.style.display = 'none';
                    
                    let errorMessage = "Unknown location error";
                    switch(error.code) {
                        case error.PERMISSION_DENIED:
                            errorMessage = "Location permission denied";
                            break;
                        case error.POSITION_UNAVAILABLE:
                            errorMessage = "Location unavailable";
                            break;
                        case error.TIMEOUT:
                            errorMessage = "Location request timed out";
                            break;
                    }
                    locationText.textContent = errorMessage;
                    
                    // Show error message
                    showErrorMessage(errorMessage);
                },
                // Options
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        } else {
            locationLoading.style.display = 'none';
            locationText.textContent = "Geolocation not supported by this browser";
            showErrorMessage("Geolocation not supported by this browser");
        }
    });

    // Form submission
    document.getElementById('customerForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        showLoading();
        
        // Get form data
        const customerData = {
            customerName: document.getElementById('customerName').value,
            contactNumber: document.getElementById('contactNumber').value,
            zone: document.getElementById('zone').value,
            agentName: document.getElementById('agentName').value,
            address: document.getElementById('address').value,
            remarks: document.getElementById('remarks').value,
            timestamp: new Date()
        };
        
        // Check if we're in demo mode
        const isDemo = window.location.hostname.includes('github.io');
        
        // Add location data if available
        const latitude = document.getElementById('latitude').value;
        const longitude = document.getElementById('longitude').value;
        
        if (latitude && longitude) {
            customerData.location = {
                latitude: parseFloat(latitude),
                longitude: parseFloat(longitude)
            };
            
            // Add Google Maps URL
            customerData.mapUrl = `https://www.google.com/maps?q=${latitude},${longitude}`;
        }
        
        try {
                // Normal Firebase mode
                // Add user ID if authenticated
                const user = auth.currentUser;
                if (user) {
                    customerData.surveyorId = user.uid;
                }
                
                // Add GeoPoint for Firestore
                if (latitude && longitude) {
                    try {
                        customerData.geopoint = new firebase.firestore.GeoPoint(
                            parseFloat(latitude), 
                            parseFloat(longitude)
                        );
                    } catch (error) {
                        console.error('Error creating GeoPoint:', error);
                    }
                }
                
                // Save data to Firestore
                const docRef = await db.collection('customers').add(customerData);
                console.log('Customer information saved with ID:', docRef.id);
                
                // Show success message
                showSuccessMessage('Customer information saved successfully!');
                
                // Reset form
                resetForm();
        } catch (error) {
            console.error('Error saving customer information:', error);
            showErrorMessage('Error saving customer information: ' + error.message);
        } finally {
            hideLoading();
        }
    });

    // Logout button functionality
    document.getElementById('logoutButton').addEventListener('click', function() {
        logout();
    });

    // For demo mode, populate agent dropdown
    if (window.location.hostname.includes('github.io')) {
        populateDemoAgents();
    }
}

// Populate agents from Firebase
async function populateAgents() {
    const agentSelect = document.getElementById('agentName');
    agentSelect.innerHTML = ''; // Clear existing options
    
    try {
        // Get agents with 'delivery' role from users collection
        const agentsSnapshot = await db.collection('users')
            .where('role', '==', 'delivery')
            .get();
        
        if (agentsSnapshot.empty) {
            // If no agents found, add a default option
            const option = document.createElement('option');
            option.value = 'agent1';
            option.textContent = 'Default Agent';
            agentSelect.appendChild(option);
            return;
        }
        
        // Add each agent to dropdown
        agentsSnapshot.forEach(doc => {
            const agentData = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = agentData.name || 'Agent ' + doc.id.substr(0, 5);
            agentSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading agents:', error);
        // Add fallback option if error occurs
        const option = document.createElement('option');
        option.value = 'agent1';
        option.textContent = 'Default Agent';
        agentSelect.appendChild(option);
    }
}

// Logout function
async function logout() {
    try {
        showLoading();
        
        // Firebase logout
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
        hideLoading();
        alert('Failed to sign out. Please try again.');
    }
}

// Show loading overlay
function showLoading() {
    document.getElementById('loadingOverlay').style.display = 'flex';
}

// Hide loading overlay
function hideLoading() {
    document.getElementById('loadingOverlay').style.display = 'none';
}

// Show success message
function showSuccessMessage(message) {
    const successMessage = document.getElementById('successMessage');
    successMessage.textContent = message;
    successMessage.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        successMessage.style.display = 'none';
    }, 3000);
}

// Show error message
function showErrorMessage(message) {
    const errorMessage = document.getElementById('errorMessage');
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 3000);
}

// Reset form
function resetForm() {
    document.getElementById('customerForm').reset();
    document.getElementById('locationText').textContent = 'Get customer location';
    document.getElementById('latitude').value = '';
    document.getElementById('longitude').value = '';
    document.getElementById('locationCoordinates').style.display = 'none';
    document.getElementById('displayLatitude').textContent = '-';
    document.getElementById('displayLongitude').textContent = '-';
}

// Check authentication
function checkAuthentication() {
    
    // Normal Firebase authentication
    auth.onAuthStateChanged(async user => {
        if (!user) {
            // Redirect to login page if not logged in
            console.log('User not logged in, redirecting to login page');
            window.location.href = 'index.html';
            return;
        }
        
        console.log('User logged in:', user.uid);
        
        try {
            // Check if the user is a surveyor
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists || userDoc.data().role !== 'surveyor') {
                console.log('User is not a surveyor, redirecting to login');
                await auth.signOut();
                window.location.href = 'index.html';
                return;
            }
            
            // User is verified, continue with the page
            console.log('Surveyor verified:', userDoc.data().name || user.displayName);
            
        } catch (error) {
            console.error('Error checking user role:', error);
            // If there's an error, sign out and redirect to login
            await auth.signOut();
            window.location.href = 'index.html';
        }
    });
}

// Add this to your login.js file:
document.getElementById('loginForm').addEventListener('submit', function(e) {
    // Adding a manual redirect as a fallback
    setTimeout(function() {
      const userType = document.getElementById('loginUserType').value;
      if (userType === 'surveyor') {
        window.location.replace('survey.html');
      } else {
        window.location.replace('delivery.html');
      }
    }, 3000); // 3 second fallback if Firebase auth is slow
  });