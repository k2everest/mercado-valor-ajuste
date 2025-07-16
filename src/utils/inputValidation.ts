// Input validation and sanitization utilities
export class InputValidator {
  // Validate Brazilian postal code (CEP)
  static validateCEP(cep: string): boolean {
    const cepRegex = /^\d{5}-?\d{3}$/;
    return cepRegex.test(cep);
  }

  // Sanitize HTML content
  static sanitizeHTML(input: string): string {
    const element = document.createElement('div');
    element.textContent = input;
    return element.innerHTML;
  }

  // Validate email format
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Validate password strength
  static validatePassword(password: string): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('Password must be at least 8 characters long');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }
    
    if (!/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }
    
    if (!/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }
    
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  // Rate limiting utility
  static createRateLimiter(maxRequests: number, windowMs: number) {
    const requests: number[] = [];
    
    return {
      checkLimit: (): boolean => {
        const now = Date.now();
        // Remove old requests outside the window
        while (requests.length > 0 && requests[0] <= now - windowMs) {
          requests.shift();
        }
        
        if (requests.length >= maxRequests) {
          return false; // Rate limit exceeded
        }
        
        requests.push(now);
        return true; // Request allowed
      },
      getRemainingTime: (): number => {
        if (requests.length === 0) return 0;
        return Math.max(0, requests[0] + windowMs - Date.now());
      }
    };
  }

  // Sanitize and validate numeric input
  static validateNumeric(value: string, min?: number, max?: number): {
    isValid: boolean;
    value: number | null;
    error?: string;
  } {
    const sanitized = value.replace(/[^\d.-]/g, '');
    const parsed = parseFloat(sanitized);
    
    if (isNaN(parsed)) {
      return { isValid: false, value: null, error: 'Invalid number format' };
    }
    
    if (min !== undefined && parsed < min) {
      return { isValid: false, value: null, error: `Value must be at least ${min}` };
    }
    
    if (max !== undefined && parsed > max) {
      return { isValid: false, value: null, error: `Value must be at most ${max}` };
    }
    
    return { isValid: true, value: parsed };
  }
}