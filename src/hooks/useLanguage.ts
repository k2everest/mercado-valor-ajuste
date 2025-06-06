
import { useState, useEffect } from 'react';

type Language = 'pt' | 'es' | 'en';

interface Translations {
  [key: string]: {
    [lang in Language]: string;
  };
}

const translations: Translations = {
  'hero.title': {
    pt: 'Ajuste Inteligente de Preços',
    es: 'Ajuste Inteligente de Precios',
    en: 'Smart Price Adjustment'
  },
  'hero.subtitle': {
    pt: 'Calcule o valor real dos seus produtos no Mercado Livre considerando os custos de frete gratuito',
    es: 'Calcula el valor real de tus productos en Mercado Libre considerando los costos de envío gratuito',
    en: 'Calculate the real value of your Mercado Libre products considering free shipping costs'
  },
  'features.mercadolivre': {
    pt: 'Integração Mercado Livre',
    es: 'Integración Mercado Libre',
    en: 'Mercado Libre Integration'
  },
  'features.automatic_calculation': {
    pt: 'Cálculo Automático',
    es: 'Cálculo Automático',
    en: 'Automatic Calculation'
  },
  'features.csv_export': {
    pt: 'Exportação CSV',
    es: 'Exportación CSV',
    en: 'CSV Export'
  },
  'features.multilanguage': {
    pt: 'Multilíngue',
    es: 'Multiidioma',
    en: 'Multilingual'
  },
  'features.import_title': {
    pt: 'Importação Automática',
    es: 'Importación Automática',
    en: 'Automatic Import'
  },
  'features.import_description': {
    pt: 'Conecte sua conta do Mercado Livre e importe automaticamente todos os seus produtos anunciados',
    es: 'Conecta tu cuenta de Mercado Libre e importa automáticamente todos tus productos publicados',
    en: 'Connect your Mercado Libre account and automatically import all your listed products'
  },
  'features.calculation_title': {
    pt: 'Cálculo Inteligente',
    es: 'Cálculo Inteligente',
    en: 'Smart Calculation'
  },
  'features.calculation_description': {
    pt: 'Calcule automaticamente o valor líquido subtraindo ou somando os custos de frete gratuito',
    es: 'Calcula automáticamente el valor neto restando o sumando los costos de envío gratuito',
    en: 'Automatically calculate net value by subtracting or adding free shipping costs'
  },
  'features.export_title': {
    pt: 'Exportação Fácil',
    es: 'Exportación Fácil',
    en: 'Easy Export'
  },
  'features.export_description': {
    pt: 'Exporte a lista final de produtos ajustados para CSV para análise ou atualização em massa',
    es: 'Exporta la lista final de productos ajustados a CSV para análisis o actualización masiva',
    en: 'Export the final list of adjusted products to CSV for analysis or bulk updates'
  },
  'auth.welcome': {
    pt: 'Bem-vindo',
    es: 'Bienvenido',
    en: 'Welcome'
  },
  'auth.welcome_description': {
    pt: 'Entre na sua conta para começar a ajustar seus preços',
    es: 'Inicia sesión en tu cuenta para comenzar a ajustar tus precios',
    en: 'Sign in to your account to start adjusting your prices'
  },
  'auth.email': {
    pt: 'E-mail',
    es: 'Correo electrónico',
    en: 'Email'
  },
  'auth.password': {
    pt: 'Senha',
    es: 'Contraseña',
    en: 'Password'
  },
  'auth.login': {
    pt: 'Entrar',
    es: 'Iniciar sesión',
    en: 'Sign In'
  },
  'auth.register': {
    pt: 'Criar conta',
    es: 'Crear cuenta',
    en: 'Create Account'
  },
  'auth.no_account': {
    pt: 'Não tem uma conta?',
    es: '¿No tienes una cuenta?',
    en: "Don't have an account?"
  },
  'auth.have_account': {
    pt: 'Já tem uma conta?',
    es: '¿Ya tienes una cuenta?',
    en: 'Already have an account?'
  },
  'dashboard.title': {
    pt: 'Painel de Controle',
    es: 'Panel de Control',
    en: 'Dashboard'
  },
  'dashboard.connect_ml': {
    pt: 'Conectar Mercado Livre',
    es: 'Conectar Mercado Libre',
    en: 'Connect Mercado Libre'
  },
  'dashboard.products': {
    pt: 'Produtos',
    es: 'Productos',
    en: 'Products'
  },
  'dashboard.original_price': {
    pt: 'Preço Original',
    es: 'Precio Original',
    en: 'Original Price'
  },
  'dashboard.status': {
    pt: 'Status',
    es: 'Estado',
    en: 'Status'
  },
  'dashboard.free_shipping': {
    pt: 'Frete Grátis',
    es: 'Envío Gratis',
    en: 'Free Shipping'
  },
  'dashboard.actions': {
    pt: 'Ações',
    es: 'Acciones',
    en: 'Actions'
  },
  'dashboard.subtract_shipping': {
    pt: 'Subtrair Frete',
    es: 'Restar Envío',
    en: 'Subtract Shipping'
  },
  'dashboard.add_shipping': {
    pt: 'Somar Frete',
    es: 'Sumar Envío',
    en: 'Add Shipping'
  },
  'dashboard.export_csv': {
    pt: 'Exportar CSV',
    es: 'Exportar CSV',
    en: 'Export CSV'
  },
  'dashboard.settings': {
    pt: 'Configurações',
    es: 'Configuraciones',
    en: 'Settings'
  },
  'dashboard.shipping_cost': {
    pt: 'Custo do Frete',
    es: 'Costo de Envío',
    en: 'Shipping Cost'
  },
  'dashboard.logout': {
    pt: 'Sair',
    es: 'Cerrar sesión',
    en: 'Logout'
  }
};

export const useLanguage = () => {
  const [language, setLanguage] = useState<Language>(() => {
    // Auto-detect language from browser
    const browserLang = navigator.language.toLowerCase();
    if (browserLang.startsWith('pt')) return 'pt';
    if (browserLang.startsWith('es')) return 'es';
    return 'en';
  });

  const t = (key: string): string => {
    return translations[key]?.[language] || key;
  };

  const changeLanguage = (newLang: Language) => {
    setLanguage(newLang);
  };

  return { language, changeLanguage, t };
};
