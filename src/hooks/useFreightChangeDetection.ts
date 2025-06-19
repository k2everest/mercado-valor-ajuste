
import { useState, useEffect } from 'react';
import { toast } from "@/hooks/use-toast";

export const useFreightChangeDetection = () => {
  const [lastNotificationCheck, setLastNotificationCheck] = useState<string>('');
  const [changedItems, setChangedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    // Load last check from localStorage
    const stored = localStorage.getItem('last_notification_check');
    if (stored) {
      setLastNotificationCheck(stored);
    }
  }, []);

  const checkForChanges = async () => {
    const currentTime = new Date().toISOString();
    
    if (lastNotificationCheck) {
      const timeDiff = new Date(currentTime).getTime() - new Date(lastNotificationCheck).getTime();
      const hoursDiff = timeDiff / (1000 * 60 * 60);
      
      console.log(`🔍 Verificando mudanças desde ${hoursDiff.toFixed(1)} horas atrás`);
      
      if (hoursDiff > 24) {
        toast({
          title: "⚠️ Verificação recomendada",
          description: "Mais de 24h desde a última verificação. Recomendado recalcular fretes.",
          variant: "destructive"
        });
      }
    }
    
    // Update last check time
    setLastNotificationCheck(currentTime);
    localStorage.setItem('last_notification_check', currentTime);
    
    return currentTime;
  };

  const markItemAsChanged = (itemId: string) => {
    setChangedItems(prev => new Set([...prev, itemId]));
    
    toast({
      title: "🔄 Produto alterado",
      description: `Frete do produto ${itemId} pode ter mudado. Recalcule para obter valores atuais.`,
    });
  };

  const clearChangedItem = (itemId: string) => {
    setChangedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(itemId);
      return newSet;
    });
  };

  const hasItemChanged = (itemId: string) => {
    return changedItems.has(itemId);
  };

  return {
    lastNotificationCheck,
    checkForChanges,
    markItemAsChanged,
    clearChangedItem,
    hasItemChanged,
    changedItemsCount: changedItems.size
  };
};
