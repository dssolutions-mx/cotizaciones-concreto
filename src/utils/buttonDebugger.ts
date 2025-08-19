/**
 * Debug utility to understand why RoleProtectedButton renders so frequently
 */

let renderCount = 0;
let lastProps: any = null;

export function debugRoleProtectedButtonRenders(props: any, componentName = 'RoleProtectedButton') {
  renderCount++;
  
  if (renderCount % 10 === 0) { // Log every 10th render to avoid spam
    console.log(`🔍 [${componentName}] Render #${renderCount}`);
    
    if (lastProps) {
      const changes: string[] = [];
      
      // Check each prop for changes
      Object.keys(props).forEach(key => {
        if (key === 'onClick') {
          // Special handling for functions
          if (props[key] !== lastProps[key]) {
            changes.push(`${key}: function reference changed`);
          }
        } else if (Array.isArray(props[key])) {
          if (JSON.stringify(props[key]) !== JSON.stringify(lastProps[key])) {
            changes.push(`${key}: array changed`);
          }
        } else if (props[key] !== lastProps[key]) {
          changes.push(`${key}: ${lastProps[key]} → ${props[key]}`);
        }
      });
      
      if (changes.length > 0) {
        console.log(`   Changed props: ${changes.join(', ')}`);
      } else {
        console.log(`   🚨 NO PROPS CHANGED - Unnecessary render!`);
      }
    }
    
    lastProps = { ...props };
  }
}

// Global debugging toggle
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).debugButtonRenders = {
    enable: () => {
      console.log('🔍 Button render debugging enabled');
      (window as any).__DEBUG_BUTTON_RENDERS__ = true;
    },
    disable: () => {
      console.log('🔍 Button render debugging disabled');
      (window as any).__DEBUG_BUTTON_RENDERS__ = false;
      renderCount = 0;
      lastProps = null;
    },
    status: () => {
      console.log(`Button renders tracked: ${renderCount}`);
    }
  };
}
