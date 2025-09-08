// Mobile Performance Optimizer
(function() {
    // Detect if device is low-performance
    const isLowPerformance = () => {
        const ua = navigator.userAgent;
        const isMobile = /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
        const isOldAndroid = /Android [1-4]\./i.test(ua);
        const isLowRAM = navigator.deviceMemory && navigator.deviceMemory < 4;
        
        return isMobile || isOldAndroid || isLowRAM;
    };
    
    // Apply performance optimizations
    if (isLowPerformance()) {
        document.documentElement.classList.add('low-performance');
        
        // Disable smooth scrolling
        document.documentElement.style.scrollBehavior = 'auto';
        
        // Reduce animation frame rate
        const style = document.createElement('style');
        style.textContent = `
            .low-performance * {
                animation-duration: 0.01ms !important;
                transition-duration: 0.1s !important;
            }
        `;
        document.head.appendChild(style);
    }
})();