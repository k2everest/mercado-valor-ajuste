
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";
import { ShoppingCart, Calculator, Download, Globe, LogIn, TrendingUp } from "lucide-react";
import { useEffect } from "react";

const Index = () => {
  const { user, loading } = useAuth();
  const { t } = useLanguage();

  console.log('🏠 Index - Estado da autenticação:', { 
    loading, 
    user: user ? 'Autenticado' : 'Não autenticado',
    userId: user?.id 
  });

  useEffect(() => {
    document.title = 'MercadoValor | Novas funcionalidades';
    const meta = document.querySelector('meta[name="description"]') || document.createElement('meta');
    meta.setAttribute('name', 'description');
    meta.setAttribute('content', 'Destaque: Precificação com custos, NF-e e margem alvo.');
    document.head.appendChild(meta);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50 flex items-center justify-center">
        <div className="text-center">
          <Calculator className="h-12 w-12 text-blue-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-600">Carregando...</p>
        </div>
      </div>
    );
  }

  // Se o usuário está autenticado, mostrar o dashboard
  if (user) {
    console.log('✅ Usuário autenticado, renderizando Dashboard');
    return <Dashboard />;
  }

  // Se não está autenticado, mostrar a página inicial
  console.log('❌ Usuário não autenticado, renderizando Home');
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
            <LanguageSelector />
            <Button variant="outline" asChild>
              <a href="/pricing" className="flex items-center gap-2">
                <Calculator className="h-4 w-4" />
                Ver Precificação
              </a>
            </Button>
            <Button asChild>
              <a href="/auth" className="flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                Entrar
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-5xl font-bold text-gray-900 mb-6 bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
            Plataforma completa para gestão e precificação de produtos
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-8">
            Importação de NF-e, custos adicionais e cálculo automático de preço sugerido com margem alvo.
          </p>
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Badge variant="secondary" className="text-sm py-2 px-4">
              <ShoppingCart className="h-4 w-4 mr-2" /> Importação de produtos e NF-e
            </Badge>
            <Badge variant="secondary" className="text-sm py-2 px-4">
              <Calculator className="h-4 w-4 mr-2" /> Precificação automática
            </Badge>
            <Badge variant="secondary" className="text-sm py-2 px-4">
              <Download className="h-4 w-4 mr-2" /> Exportação CSV
            </Badge>
            <Badge variant="secondary" className="text-sm py-2 px-4">
              <Globe className="h-4 w-4 mr-2" /> Multi-idioma
            </Badge>
          </div>
          <div className="flex justify-center gap-3">
            <Button asChild>
              <a href="/pricing" className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Ver Precificação
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/auth" className="flex items-center gap-2">
                <LogIn className="h-5 w-5" />
                Entrar
              </a>
            </Button>
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

        {/* CTA Section */}
        <div className="text-center">
          <Card className="max-w-2xl mx-auto shadow-2xl border-0 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Novas funcionalidades de Precificação</CardTitle>
              <CardDescription>
                Importe NF-e, gerencie custos adicionais e calcule preços com margem alvo automaticamente.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button asChild className="w-full">
                <a href="/pricing" className="flex items-center justify-center gap-2">
                  <Calculator className="h-5 w-5" />
                  Explorar Precificação
                </a>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <a href="/auth" className="flex items-center justify-center gap-2">
                  <LogIn className="h-5 w-5" />
                  Criar conta grátis
                </a>
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Index;
