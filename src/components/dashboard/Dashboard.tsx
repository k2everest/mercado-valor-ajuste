
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ProductsList } from "./ProductsList";
import { MercadoLibreConnection } from "./MercadoLibreConnection";
import { SettingsPanel } from "./SettingsPanel";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { Calculator, Settings, LogOut, User } from "lucide-react";

export const Dashboard = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { t } = useLanguage();
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Calculator className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">MercadoValor</h1>
          </div>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span>{user?.email}</span>
            </div>
            <LanguageSelector />
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
            >
              <Settings className="h-4 w-4 mr-2" />
              {t('dashboard.settings')}
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              {t('dashboard.logout')}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">{t('dashboard.title')}</h2>
          <p className="text-gray-600">
            Gerencie seus produtos e ajuste preços automaticamente
          </p>
        </div>

        {showSettings && (
          <div className="mb-8">
            <SettingsPanel />
          </div>
        )}

        {!isConnected ? (
          <MercadoLibreConnection onConnect={() => setIsConnected(true)} />
        ) : (
          <ProductsList />
        )}
      </div>
    </div>
  );
};
