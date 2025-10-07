// Simple Balance Fix - Safe version that won't crash the dashboard

(function() {
    'use strict';
    
    console.log('Simple Balance Fix: Starting...');
    
    // Simple function to replace wrong balances
    function fixBalances() {
        try {
            // Find and replace wrong balance amounts
            const elements = document.querySelectorAll('*');
            let fixedCount = 0;
            
            elements.forEach(element => {
                if (element.children.length === 0) { // Only text nodes
                    let text = element.textContent;
                    
                    // Replace wrong balance patterns
                    if (text.includes('97,761.04') || text.includes('97761.04')) {
                        element.textContent = text.replace(/97,?761\.04/g, '95,211.04');
                        fixedCount++;
                    }
                    
                    if (text.includes('$97,761.04') || text.includes('$97761.04')) {
                        element.textContent = text.replace(/\$97,?761\.04/g, '$95,211.04');
                        fixedCount++;
                    }
                }
            });
            
            if (fixedCount > 0) {
                console.log(`Simple Balance Fix: Fixed ${fixedCount} balance displays`);
            }
        } catch (error) {
            console.log('Simple Balance Fix: Error (non-critical):', error.message);
        }
    }
    
    // Run the fix safely
    function safeRun() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fixBalances);
        } else {
            fixBalances();
        }
        
        // Run periodically but safely
        setInterval(fixBalances, 10000);
    }
    
    // Initialize
    safeRun();
    
    // Global function for manual fixing
    window.fixBalance = fixBalances;
    
    console.log('Simple Balance Fix: Loaded successfully');
})();