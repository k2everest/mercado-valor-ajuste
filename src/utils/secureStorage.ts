// Secure token storage utilities
export class SecureStorage {
  private static encrypt(value: string): string {
    // Simple obfuscation - in production, use proper encryption
    return btoa(value);
  }

  private static decrypt(value: string): string {
    try {
      return atob(value);
    } catch {
      return '';
    }
  }

  static setSecureItem(key: string, value: string): void {
    try {
      const encrypted = this.encrypt(value);
      localStorage.setItem(`secure_${key}`, encrypted);
    } catch (error) {
      console.error('Failed to store secure item:', error);
    }
  }

  static getSecureItem(key: string): string | null {
    try {
      const encrypted = localStorage.getItem(`secure_${key}`);
      return encrypted ? this.decrypt(encrypted) : null;
    } catch (error) {
      console.error('Failed to retrieve secure item:', error);
      return null;
    }
  }

  static removeSecureItem(key: string): void {
    try {
      localStorage.removeItem(`secure_${key}`);
    } catch (error) {
      console.error('Failed to remove secure item:', error);
    }
  }

  static clearAll(): void {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('secure_')) {
          localStorage.removeItem(key);
        }
      });
    } catch (error) {
      console.error('Failed to clear secure storage:', error);
    }
  }
}