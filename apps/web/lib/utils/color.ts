/**
 * Color utility functions for generating contrasting backgrounds
 */

/**
 * Convert hex color to HSL
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  hex = hex.replace('#', '');
  
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

/**
 * Generate a contrasting background color from a hex color
 * Creates a lighter/darker version with opacity for subtle contrast
 */
export function getContrastingBackground(hexColor: string, opacity: number = 0.15): string {
  const hsl = hexToHsl(hexColor);
  
  // For dark colors, use a lighter version
  // For light colors, use a darker version
  // Adjust lightness to create contrast
  let adjustedLightness = hsl.l;
  
  if (hsl.l < 50) {
    // Dark color - make it lighter for background
    adjustedLightness = Math.min(95, hsl.l + 40);
  } else {
    // Light color - make it darker for background
    adjustedLightness = Math.max(5, hsl.l - 40);
  }
  
  // Convert back to hex with opacity
  return `hsla(${hsl.h}, ${hsl.s}%, ${adjustedLightness}%, ${opacity})`;
}

/**
 * Generate a background using the color with specified opacity
 */
export function getSubtleBackground(hexColor: string, opacity: number = 1.0): string {
  // Handle white color specially - use a light gray background instead
  if (hexColor.toUpperCase() === "#FFFFFF" || hexColor.toUpperCase() === "#FFF") {
    return opacity < 1.0 ? `rgba(240, 240, 240, ${opacity})` : `rgb(240, 240, 240)`; // Light gray for white icons
  }
  
  // Handle black color specially - use a dark gray background
  if (hexColor.toUpperCase() === "#000000" || hexColor.toUpperCase() === "#000") {
    return opacity < 1.0 ? `rgba(30, 30, 30, ${opacity})` : `rgb(30, 30, 30)`; // Dark gray for black icons
  }
  
  // Convert hex to rgba/rgb
  const r = parseInt(hexColor.substring(1, 3), 16);
  const g = parseInt(hexColor.substring(3, 5), 16);
  const b = parseInt(hexColor.substring(5, 7), 16);
  
  return opacity < 1.0 ? `rgba(${r}, ${g}, ${b}, ${opacity})` : `rgb(${r}, ${g}, ${b})`;
}
