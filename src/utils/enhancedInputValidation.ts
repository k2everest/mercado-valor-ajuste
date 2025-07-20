// Enhanced input validation with security focus
export class EnhancedInputValidator {
  // Enhanced ZIP code validation with country support
  static validateZipCode(zipCode: string, country: 'BR' | 'US' = 'BR'): { isValid: boolean; sanitized: string; error?: string } {
    const sanitized = zipCode.replace(/\D/g, '');
    
    if (country === 'BR') {
      if (sanitized.length !== 8) {
        return { isValid: false, sanitized, error: 'CEP deve ter 8 dígitos' };
      }
      // Validate against known invalid CEP patterns
      if (sanitized === '00000000' || sanitized === '99999999') {
        return { isValid: false, sanitized, error: 'CEP inválido' };
      }
    }
    
    return { isValid: true, sanitized };
  }

  // Enhanced product ID validation
  static validateProductId(productId: string): { isValid: boolean; sanitized: string; error?: string } {
    // Remove any non-alphanumeric characters except hyphens and underscores
    const sanitized = productId.replace(/[^a-zA-Z0-9\-_]/g, '');
    
    if (sanitized.length < 3) {
      return { isValid: false, sanitized, error: 'ID do produto muito curto' };
    }
    
    if (sanitized.length > 50) {
      return { isValid: false, sanitized, error: 'ID do produto muito longo' };
    }
    
    // Check for SQL injection patterns
    const sqlPatterns = /(\b(union|select|insert|update|delete|drop|create|alter)\b)/i;
    if (sqlPatterns.test(sanitized)) {
      return { isValid: false, sanitized: '', error: 'ID do produto contém caracteres proibidos' };
    }
    
    return { isValid: true, sanitized };
  }

  // Enhanced API token validation
  static validateApiToken(token: string): { isValid: boolean; error?: string } {
    if (!token || token.length < 10) {
      return { isValid: false, error: 'Token inválido ou muito curto' };
    }
    
    // Check for suspicious patterns
    if (token.includes('<script>') || token.includes('javascript:')) {
      return { isValid: false, error: 'Token contém conteúdo malicioso' };
    }
    
    return { isValid: true };
  }

  // Enhanced rate limiting with user tracking
  static createAdvancedRateLimiter(maxRequests: number, windowMs: number, identifier?: string) {
    const key = `rate_limit_${identifier || 'default'}`;
    
    return {
      checkLimit: (): boolean => {
        const now = Date.now();
        const windowStart = now - windowMs;
        
        // Get existing requests
        const storedData = localStorage.getItem(key);
        let requests: number[] = storedData ? JSON.parse(storedData) : [];
        
        // Filter out old requests
        requests = requests.filter(time => time > windowStart);
        
        // Check if limit exceeded
        if (requests.length >= maxRequests) {
          return false;
        }
        
        // Add current request
        requests.push(now);
        localStorage.setItem(key, JSON.stringify(requests));
        
        return true;
      },
      
      getRemainingTime: (): number => {
        const storedData = localStorage.getItem(key);
        if (!storedData) return 0;
        
        const requests: number[] = JSON.parse(storedData);
        if (requests.length === 0) return 0;
        
        const oldestRequest = Math.min(...requests);
        const timeUntilExpiry = (oldestRequest + windowMs) - Date.now();
        
        return Math.max(0, timeUntilExpiry);
      },
      
      getRequestCount: (): number => {
        const now = Date.now();
        const windowStart = now - windowMs;
        const storedData = localStorage.getItem(key);
        
        if (!storedData) return 0;
        
        const requests: number[] = JSON.parse(storedData);
        return requests.filter(time => time > windowStart).length;
      }
    };
  }

  // Secure URL validation for OAuth redirects
  static validateRedirectUrl(url: string, allowedDomains: string[]): { isValid: boolean; error?: string } {
    try {
      const urlObj = new URL(url);
      
      // Check protocol
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { isValid: false, error: 'Protocolo de URL não permitido' };
      }
      
      // Check domain
      const domain = urlObj.hostname.toLowerCase();
      const isAllowed = allowedDomains.some(allowed => 
        domain === allowed || domain.endsWith(`.${allowed}`)
      );
      
      if (!isAllowed) {
        return { isValid: false, error: 'Domínio não autorizado' };
      }
      
      return { isValid: true };
    } catch {
      return { isValid: false, error: 'URL malformada' };
    }
  }

  // Content Security Policy helper
  static generateCSPNonce(): string {
    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return btoa(String.fromCharCode(...array));
  }

  // XSS prevention
  static sanitizeForHTML(input: string): string {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  // Enhanced SQL injection prevention
  static sanitizeForDatabase(input: string): string {
    // Remove or escape dangerous characters
    return input
      .replace(/['"\\;]/g, '') // Remove quotes and backslashes
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove block comment start
      .replace(/\*\//g, '') // Remove block comment end
      .trim();
  }
}