// Modified delivery.js for static GitHub Pages deployment

// Wait for Firebase initialization
window.addEventListener('firebaseInitialized', () => {
    setupDeliveryPage();
    checkAuthentication();
});

let allCustomers = [];

function setupDeliveryPage() {
    // Set current date
    setCurrentDate();
    
    // Search input
    document.getElementById('searchInput').addEventListener('input', displayCustomers);
    
    // Status filter
    document.getElementById('statusFilter').addEventListener('change', displayCustomers);
    
    // Logout button
    document.getElementById('logoutButton').addEventListener('click', function() {
        logout();
    });
}

// Logout function
async function logout() {
    try {
        showLoading();
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Error signing out:', error);
        hideLoading();
        alert('Failed to sign out. Please try again.');
    }
}

// Current date formatting
function setCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
}

// Get the current delivery day ID (YYYY-MM-DD format based on IST timezone)
function getCurrentDeliveryDayId() {
    // Create date in IST time zone
    const now = new Date();
    
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000; // 5.5 hours in milliseconds
    const utcTime = now.getTime();
    const istTime = new Date(utcTime + istOffset);
    
    // Create today's 4 AM cutoff time in IST
    const today4AM = new Date(istTime);
    today4AM.setHours(4, 0, 0, 0);
    
    // If current time is before 4 AM, use yesterday's date
    if (istTime < today4AM) {
        istTime.setDate(istTime.getDate() - 1);
    }
    
    // Format as YYYY-MM-DD
    const year = istTime.getFullYear();
    const month = String(istTime.getMonth() + 1).padStart(2, '0');
    const day = String(istTime.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// Get the start and end times for the current delivery day (for display purposes)
function getCurrentDeliveryDayTimes() {
    // Get current delivery day ID
    const deliveryDayId = getCurrentDeliveryDayId();
    const [year, month, day] = deliveryDayId.split('-').map(Number);
    
    // Create start date (4 AM on the delivery day)
    const startIST = new Date(year, month - 1, day, 4, 0, 0);
    
    // Create end date (4 AM on the next day)
    const endIST = new Date(startIST);
    endIST.setDate(endIST.getDate() + 1);
    
    return { startIST, endIST };
}

// Format date for display
function formatDate(date) {
    if (!date) return 'N/A';
    
    // If it's a Firestore timestamp, convert to JS Date
    const jsDate = date.toDate ? date.toDate() : date;
    
    return jsDate.toLocaleDateString('en-US', { 
        day: 'numeric', 
        month: 'short',
        year: 'numeric'
    });
}

// Format time for display
function formatTime(date) {
    if (!date) return '';
    
    // If it's a Firestore timestamp, convert to JS Date
    const jsDate = date.toDate ? date.toDate() : date;
    
    return jsDate.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit'
    });
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
    successMessage.textContent = message || 'Delivery status updated successfully!';
    successMessage.style.display = 'block';
    
    // Hide after 3 seconds
    setTimeout(() => {
        successMessage.style.display = 'none';
    }, 3000);
}

// Load customers from Firebase
async function loadCustomers() {
    showLoading();
    
    try {
        // Get current user
        const user = auth.currentUser;
        if (!user) {
            console.log('No user logged in');
            hideLoading();
            return;
        }
        
        // Real Firebase mode below
        // Get agent zone from user document
        const userDoc = await db.collection('users').doc(user.uid).get();
        const agentData = userDoc.data();
        
        if (agentData) {
            // Update agent name in UI
            document.getElementById('agentName').textContent = agentData.name || user.displayName || 'Delivery Agent';
            
            // Get customers assigned to this agent
            let customersQuery = db.collection('customers');
            
            // If agent has assigned zone, filter by that zone
            if (agentData.zone) {
                customersQuery = customersQuery.where('zone', '==', agentData.zone);
            }
            
            // If agent has direct customer assignments
            if (agentData.agentId) {
                customersQuery = customersQuery.where('agentName', '==', agentData.agentId);
            }
            
            const customersSnapshot = await customersQuery.get();
            
            // Reset customers array
            allCustomers = [];
            
            // Process each customer
            customersSnapshot.forEach(doc => {
                const customerData = doc.data();
                allCustomers.push({
                    id: doc.id,
                    deliveredToday: false, // Default to false, will update next
                    ...customerData
                });
            });
            
            // Get delivery status from daily deliveries collection
            await loadDeliveryStatus();
            
            // Load delivery history for all customers
            await loadDeliveryHistory();
            
            // Display customers
            displayCustomers();
            updateStats();
        }
    } catch (error) {
        console.error('Error loading customers:', error);
        
        // If there's an error, load demo data
        allCustomers = getDemoCustomers();
        displayCustomers();
        updateStats();
    } finally {
        hideLoading();
    }
}

// Demo data function
function getDemoCustomers() {
    return [
        {
            id: 'customer1',
            customerName: 'John Doe',
            contactNumber: '9876543210',
            address: '123 Main St, Guwahati',
            zone: 'Guwahati',
            deliveredToday: false,
            mapUrl: 'https://www.google.com/maps?q=26.1445,91.7362',
            deliveryHistory: [
                {
                    id: 'hist1',
                    status: 'delivered',
                    timestamp: new Date(Date.now() - 86400000) // yesterday
                },
                {
                    id: 'hist2',
                    status: 'delivered',
                    timestamp: new Date(Date.now() - 172800000) // day before yesterday
                }
            ]
        },
        {
            id: 'customer2',
            customerName: 'Jane Smith',
            contactNumber: '8765432109',
            address: '456 Park Avenue, Dibrugarh',
            zone: 'Dibrugarh',
            deliveredToday: true,
            mapUrl: 'https://www.google.com/maps?q=27.4728,94.9120',
            deliveryHistory: [
                {
                    id: 'hist3',
                    status: 'delivered',
                    timestamp: new Date() // today
                },
                {
                    id: 'hist4',
                    status: 'delivered',
                    timestamp: new Date(Date.now() - 86400000) // yesterday
                }
            ]
        },
        {
            id: 'customer3',
            customerName: 'Robert Johnson',
            contactNumber: '7654321098',
            address: '789 River Road, North Lakhimpur',
            zone: 'North Lakhimpur',
            deliveredToday: false,
            mapUrl: 'https://www.google.com/maps?q=27.2380,94.1026',
            deliveryHistory: [
                {
                    id: 'hist5',
                    status: 'delivered',
                    timestamp: new Date(Date.now() - 86400000) // yesterday
                }
            ]
        },
        {
            id: 'customer4',
            customerName: 'Sarah Williams',
            contactNumber: '6543210987',
            address: '321 Hill View, Bongaigaon',
            zone: 'Bongaigaon',
            deliveredToday: false,
            mapUrl: 'https://www.google.com/maps?q=26.4753,90.5513',
            deliveryHistory: []
        }
    ];
}

// Load delivery status for the current day
async function loadDeliveryStatus() {
    // Skip for demo mode
    if (window.location.hostname.includes('github.io')) {
        return;
    }
    
    const deliveryDayId = getCurrentDeliveryDayId();
    const userId = auth.currentUser?.uid;
    
    if (!userId) return;
    
    try {
        console.log(`Loading delivery status for day: ${deliveryDayId}`);
        
        // Get the document for the current delivery day
        const dailyDeliveriesDoc = await db.collection('dailyDeliveries').doc(deliveryDayId).get();
        
        if (dailyDeliveriesDoc.exists) {
            const dailyData = dailyDeliveriesDoc.data();
            
            // If there's a delivered customers map for this agent
            if (dailyData && dailyData.deliveredCustomers && dailyData.deliveredCustomers[userId]) {
                const deliveredCustomers = dailyData.deliveredCustomers[userId];
                
                // Update delivery status for each customer
                allCustomers.forEach(customer => {
                    if (deliveredCustomers[customer.id]) {
                        customer.deliveredToday = true;
                    }
                });
                
                console.log(`Found ${Object.keys(deliveredCustomers).length} delivered customers for today`);
            } else {
                console.log('No deliveries found for today');
            }
        } else {
            console.log(`No delivery record found for day ${deliveryDayId}`);
        }
    } catch (error) {
        console.error('Error loading delivery status:', error);
    }
}

// Load delivery history for all customers
async function loadDeliveryHistory() {
    // Skip for demo mode
    if (window.location.hostname.includes('github.io')) {
        return;
    }
    
    for (const customer of allCustomers) {
        try {
            // Get recent delivery history
            const historySnapshot = await db.collection('deliveries')
                .where('customerId', '==', customer.id)
                .orderBy('timestamp', 'desc')
                .limit(5)
                .get();
            
            // Add history to customer object
            customer.deliveryHistory = [];
            historySnapshot.forEach(doc => {
                customer.deliveryHistory.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            
        } catch (error) {
            console.error(`Error loading history for customer ${customer.id}:`, error);
            customer.deliveryHistory = [];
        }
    }
}

// Display customers in UI
function displayCustomers() {
    const customersList = document.getElementById('customersList');
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    const statusFilter = document.getElementById('statusFilter').value;
    
    // Clear existing list
    customersList.innerHTML = '';
    
    // Filter customers based on search input and status filter
    const filteredCustomers = allCustomers.filter(customer => {
        const nameMatch = (customer.customerName || '').toLowerCase().includes(searchInput);
        const numberMatch = (customer.contactNumber || '').toLowerCase().includes(searchInput);
        
        // Apply status filter
        if (statusFilter === 'pending' && customer.deliveredToday) {
            return false;
        }
        if (statusFilter === 'delivered' && !customer.deliveredToday) {
            return false;
        }
        
        return nameMatch || numberMatch;
    });
    
    // Check if there are any customers after filtering
    if (filteredCustomers.length === 0) {
        customersList.innerHTML = '<div class="no-customers">No customers found</div>';
        return;
    }
    
    // Add each customer card
    filteredCustomers.forEach(customer => {
        const customerCard = document.createElement('div');
        customerCard.className = 'customer-card';
        
        // Create card content
        customerCard.innerHTML = `
            <div class="customer-header">
                <div class="customer-name">${customer.customerName || 'Unnamed Customer'}</div>
                <div class="customer-status ${customer.deliveredToday ? 'status-delivered' : 'status-pending'}">
                    ${customer.deliveredToday ? 'Delivered' : 'Pending'}
                </div>
            </div>
            <div class="customer-info">
                <div class="info-item">
                    <div class="info-label">Address:</div>
                    <div class="info-value">${customer.address || 'N/A'}</div>
                </div>
                <div class="info-item">
                    <div class="info-label">Zone:</div>
                    <div class="info-value">${customer.zone || 'N/A'}</div>
                </div>
            </div>
            <div class="contact-buttons">
                ${customer.contactNumber ? 
                  `<a href="tel:${customer.contactNumber}" class="contact-button call-button">
                    <span class="button-icon">📞</span> Call
                   </a>` : ''}
                ${customer.mapUrl ? 
                  `<a href="${customer.mapUrl}" target="_blank" class="contact-button map-button">
                    <span class="button-icon">🗺️</span> Directions
                   </a>` : ''}
            </div>
        `;
        
        // Add delivery history if available
        if (customer.deliveryHistory && customer.deliveryHistory.length > 0) {
            const historySection = document.createElement('div');
            historySection.className = 'delivery-history';
            
            let historyHTML = '<div class="history-title">Recent Delivery History</div>';
            
            customer.deliveryHistory.slice(0, 3).forEach(delivery => {
                historyHTML += `
                    <div class="history-item">
                        <div>${delivery.status === 'delivered' ? '✅ Delivered' : '⏳ Pending'}</div>
                        <div class="history-date">${formatDate(delivery.timestamp)} ${formatTime(delivery.timestamp)}</div>
                    </div>
                `;
            });
            
            historySection.innerHTML = historyHTML;
            customerCard.appendChild(historySection);
        }
        
        // Add action buttons
        const actionButtons = document.createElement('div');
        actionButtons.className = 'action-buttons';
        
        // Deliver button (text changes based on delivery status)
        const deliverButton = document.createElement('button');
        deliverButton.className = 'action-button deliver-button';
        
        if (customer.deliveredToday) {
            // Already delivered - show different text and disable button
            deliverButton.innerHTML = `<span class="button-icon">✓</span> Already Delivered`;
            deliverButton.disabled = true;
            deliverButton.style.opacity = '0.5';
            deliverButton.style.backgroundColor = '#88d488'; // Lighter green
        } else {
            // Not delivered - show normal text and enable button
            deliverButton.innerHTML = `<span class="button-icon">✓</span> Mark Delivered`;
            deliverButton.disabled = false;
            deliverButton.style.opacity = '1';
            deliverButton.addEventListener('click', () => markAsDelivered(customer.id));
        }
        
        actionButtons.appendChild(deliverButton);
        customerCard.appendChild(actionButtons);
        
        // Add card to list
        customersList.appendChild(customerCard);
    });
    
    // Add delivery day info
    const { startIST, endIST } = getCurrentDeliveryDayTimes();
    
    // Format dates for display
    const startFormatted = `${formatDate(startIST)} ${formatTime(startIST)}`;
    const endFormatted = `${formatDate(endIST)} ${formatTime(endIST)}`;
    const dayId = getCurrentDeliveryDayId();
    
    const deliveryInfo = document.createElement('div');
    deliveryInfo.style.textAlign = 'center';
    deliveryInfo.style.marginTop = '20px';
    deliveryInfo.style.color = '#666';
    deliveryInfo.style.fontSize = '14px';
    deliveryInfo.innerHTML = `
        <div>Current delivery day: ${startFormatted} to ${endFormatted} (IST)</div>
        <div style="margin-top: 5px; font-style: italic;">Delivery status will reset at 4:00 AM IST</div>
        <div style="margin-top: 5px; font-size: 12px;">Day ID: ${dayId}</div>
    `;
    customersList.appendChild(deliveryInfo);
}

// Mark customer as delivered
async function markAsDelivered(customerId) {
    showLoading();
    
    try {
        const user = auth.currentUser;
        if (!user) {
            console.log('No user logged in');
            hideLoading();
            return;
        }
        
        // Real Firebase mode below
        // Get the current delivery day ID
        const deliveryDayId = getCurrentDeliveryDayId();
        const userId = user.uid;
        
        // 1. Add to regular deliveries collection for history
        const deliveryData = {
            customerId: customerId,
            agentId: userId,
            status: 'delivered',
            timestamp: firebase.firestore.FieldValue.serverTimestamp(),
            deliveryDayId: deliveryDayId, // Add the day ID for easy filtering
            notes: ''
        };
        
        await db.collection('deliveries').add(deliveryData);
        
        // 2. Update daily deliveries document to track delivery status
        const dailyDeliveriesRef = db.collection('dailyDeliveries').doc(deliveryDayId);
        
        // Use transaction to safely update the document
        await db.runTransaction(async (transaction) => {
            const dailyDoc = await transaction.get(dailyDeliveriesRef);
            
            let dailyData = {};
            
            if (dailyDoc.exists) {
                dailyData = dailyDoc.data();
            }
            
            // Initialize nested objects if they don't exist
            if (!dailyData.deliveredCustomers) {
                dailyData.deliveredCustomers = {};
            }
            
            if (!dailyData.deliveredCustomers[userId]) {
                dailyData.deliveredCustomers[userId] = {};
            }
            
            // Mark this customer as delivered
            dailyData.deliveredCustomers[userId][customerId] = {
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            };
            
            // Update the document
            transaction.set(dailyDeliveriesRef, dailyData);
        });
        
        console.log(`Marked customer ${customerId} as delivered for day ${deliveryDayId}`);
        
        // Update local data
        const customerIndex = allCustomers.findIndex(c => c.id === customerId);
        if (customerIndex !== -1) {
            // Update delivered status
            allCustomers[customerIndex].deliveredToday = true;
            
            // Add to delivery history
            if (!allCustomers[customerIndex].deliveryHistory) {
                allCustomers[customerIndex].deliveryHistory = [];
            }
            
            // Add delivery to history with current timestamp
            allCustomers[customerIndex].deliveryHistory.unshift({
                ...deliveryData,
                timestamp: new Date()
            });
        }
        
        // Update UI
        displayCustomers();
        updateStats();
        showSuccessMessage();
        
    } catch (error) {
        console.error('Error marking as delivered:', error);
        alert('Failed to update delivery status. Please try again.');
    } finally {
        hideLoading();
    }
}

// Update stats counters
function updateStats() {
    let pending = 0;
    let completed = 0;
    
    allCustomers.forEach(customer => {
        if (customer.deliveredToday) {
            completed++;
        } else {
            pending++;
        }
    });
    
    document.getElementById('pendingCount').textContent = pending;
    document.getElementById('completedCount').textContent = completed;
    document.getElementById('totalCount').textContent = allCustomers.length;
}

// Check authentication and user role
function checkAuthentication() {
    
    // Normal Firebase authentication for non-demo environments
    auth.onAuthStateChanged(async user => {
        if (!user) {
            // Redirect to login page if not logged in
            console.log('User not logged in, redirecting to login page');
            window.location.href = 'index.html';
            return;
        }
        
        console.log('User logged in:', user.uid);
        
        try {
            // Check if the user is a delivery agent
            const userDoc = await db.collection('users').doc(user.uid).get();
            
            if (!userDoc.exists || userDoc.data().role !== 'delivery') {
                console.log('User is not a delivery agent, redirecting to login');
                await auth.signOut();
                window.location.href = 'index.html';
                return;
            }
            
            // User is verified, load customers
            console.log('Delivery agent verified:', userDoc.data().name || user.displayName);
            loadCustomers();
            
        } catch (error) {
            console.error('Error checking user role:', error);
            // If there's an error, sign out and redirect to login
            await auth.signOut();
            window.location.href = 'index.html';
        }
    });
}