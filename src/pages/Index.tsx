
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LoginForm } from "@/components/auth/LoginForm";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useLanguage } from "@/hooks/useLanguage";
import { ShoppingCart, Calculator, Download, Globe } from "lucide-react";

const Index = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { t } = useLanguage();

  if (isAuthenticated) {
    return <Dashboard onLogout={() => setIsAuthenticated(false)} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <Calculator className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">MercadoValor</h1>
          </div>
          <LanguageSelector />
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold text-gray-900 mb-6 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            {t('hero.title')}
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            {t('hero.subtitle')}
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Badge variant="secondary" className="text-sm py-2 px-4">
              <ShoppingCart className="h-4 w-4 mr-2" />
              {t('features.mercadolivre')}
            </Badge>
            <Badge variant="secondary" className="text-sm py-2 px-4">
              <Calculator className="h-4 w-4 mr-2" />
              {t('features.automatic_calculation')}
            </Badge>
            <Badge variant="secondary" className="text-sm py-2 px-4">
              <Download className="h-4 w-4 mr-2" />
              {t('features.csv_export')}
            </Badge>
            <Badge variant="secondary" className="text-sm py-2 px-4">
              <Globe className="h-4 w-4 mr-2" />
              {t('features.multilanguage')}
            </Badge>
          </div>
        </div>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <ShoppingCart className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-xl">{t('features.import_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                {t('features.import_description')}
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center group-hover:bg-green-200 transition-colors">
                <Calculator className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-xl">{t('features.calculation_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                {t('features.calculation_description')}
              </CardDescription>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Download className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle className="text-xl">{t('features.export_title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription className="text-center">
                {t('features.export_description')}
              </CardDescription>
            </CardContent>
          </Card>
        </div>

        {/* Login Section */}
        <div className="max-w-md mx-auto">
          <Card className="shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">{t('auth.welcome')}</CardTitle>
              <CardDescription>
                {t('auth.welcome_description')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <LoginForm onLogin={() => setIsAuthenticated(true)} />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Index;
