// Secure token storage utilities with proper encryption for Mercado Livre
export class SecureStorage {
  private static readonly ENCRYPTION_KEY_NAME = 'ml_storage_key';
  private static readonly ALGORITHM = 'AES-GCM';
  
  private static async getEncryptionKey(): Promise<CryptoKey> {
    // Try to get existing key from IndexedDB
    const keyData = await this.getFromIndexedDB(this.ENCRYPTION_KEY_NAME);
    
    if (keyData) {
      return await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: this.ALGORITHM },
        false,
        ['encrypt', 'decrypt']
      );
    }
    
    // Generate new key if none exists
    const key = await crypto.subtle.generateKey(
      { name: this.ALGORITHM, length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
    
    // Store key for future use
    const exportedKey = await crypto.subtle.exportKey('raw', key);
    await this.saveToIndexedDB(this.ENCRYPTION_KEY_NAME, exportedKey);
    
    return key;
  }

  private static async encrypt(value: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      const encoder = new TextEncoder();
      const data = encoder.encode(value);
      
      // Generate random IV for each encryption
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      const encrypted = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv },
        key,
        data
      );
      
      // Combine IV and encrypted data
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv);
      combined.set(new Uint8Array(encrypted), iv.length);
      
      // Convert to base64 for storage
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  private static async decrypt(value: string): Promise<string> {
    try {
      const key = await this.getEncryptionKey();
      
      // Convert from base64
      const combined = new Uint8Array(
        atob(value).split('').map(char => char.charCodeAt(0))
      );
      
      // Extract IV and encrypted data
      const iv = combined.slice(0, 12);
      const encrypted = combined.slice(12);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv },
        key,
        encrypted
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    } catch (error) {
      console.error('Decryption failed:', error);
      return '';
    }
  }

  private static async getFromIndexedDB(key: string): Promise<ArrayBuffer | null> {
    return new Promise((resolve) => {
      const request = indexedDB.open('SecureStorage', 1);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['keys'], 'readonly');
        const store = transaction.objectStore('keys');
        const getRequest = store.get(key);
        
        getRequest.onsuccess = () => {
          resolve(getRequest.result || null);
        };
        
        getRequest.onerror = () => {
          resolve(null);
        };
      };
      
      request.onerror = () => {
        resolve(null);
      };
    });
  }

  private static async saveToIndexedDB(key: string, value: ArrayBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SecureStorage', 1);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('keys')) {
          db.createObjectStore('keys');
        }
      };
      
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(['keys'], 'readwrite');
        const store = transaction.objectStore('keys');
        const putRequest = store.put(value, key);
        
        putRequest.onsuccess = () => resolve();
        putRequest.onerror = () => reject(putRequest.error);
      };
      
      request.onerror = () => reject(request.error);
    });
  }

  // Mercado Livre token management
  static async setMLTokens(accessToken: string, refreshToken: string, expiresIn: number): Promise<void> {
    const tokenData = {
      accessToken,
      refreshToken,
      expiresAt: Date.now() + (expiresIn * 1000) - 60000 // Subtract 1 minute for safety
    };
    await this.setSecureItem('ml_tokens', JSON.stringify(tokenData));
  }

  static async getMLTokens(): Promise<{ accessToken: string; refreshToken: string; expiresAt: number } | null> {
    const tokenStr = await this.getSecureItem('ml_tokens');
    if (!tokenStr) return null;
    
    try {
      return JSON.parse(tokenStr);
    } catch {
      return null;
    }
  }

  static async isMLTokenExpired(): Promise<boolean> {
    const tokens = await this.getMLTokens();
    if (!tokens) return true;
    return Date.now() >= tokens.expiresAt;
  }

  static async setSecureItem(key: string, value: string): Promise<void> {
    try {
      const encrypted = await this.encrypt(value);
      localStorage.setItem(`secure_${key}`, encrypted);
    } catch (error) {
      console.error('Failed to store secure item:', error);
    }
  }

  static async getSecureItem(key: string): Promise<string | null> {
    try {
      const encrypted = localStorage.getItem(`secure_${key}`);
      return encrypted ? await this.decrypt(encrypted) : null;
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