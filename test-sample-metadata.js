// Test script to add sample metadata via browser console
// Copy and paste this into the browser console on the dashboard page

async function addSampleMetadata() {
  try {
    console.log('🚀 Adding sample metadata...');
    
    const response = await fetch('/api/add-sample-metadata', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include' // Include cookies for authentication
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error response:', response.status, errorText);
      return;
    }
    
    const result = await response.json();
    console.log('✅ Sample metadata added successfully:', result);
    
    // Refresh the page to see the updated tasks
    console.log('🔄 Refreshing page to show updated tasks...');
    window.location.reload();
    
  } catch (error) {
    console.error('❌ Error adding sample metadata:', error);
  }
}

// Run the function
addSampleMetadata();
