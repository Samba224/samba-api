// ════════════════════════════════════════════════════════════
// SCRAPER SERVICE - Connexion à l'API RSS
// ════════════════════════════════════════════════════════════

// 🔧 CONFIGURATION
// Remplacer par votre URL Ngrok si vous exposez l'API
// Ou garder localhost si vous testez sur émulateur
const API_BASE_URL = 'http://samba-api-production.up.railway.app';

// Pour émulateur Android : 'http://10.0.2.2:3000'
// Pour Ngrok : 'https://votre-url.ngrok.io'
// Pour Railway/Render : 'https://votre-app.railway.app'

// ════════════════════════════════════════════════════════════
// FONCTIONS PRINCIPALES
// ════════════════════════════════════════════════════════════

/**
 * Récupère les thèmes Discover dynamiques
 */
export async function fetchDiscoverThemes() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/discover`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.themes) {
      return data.themes;
    }

    return getFallbackThemes();
  } catch (error) {
    console.error('❌ Erreur fetchDiscoverThemes:', error.message);
    return getFallbackThemes();
  }
}

/**
 * Récupère les articles d'un site spécifique
 */
export async function fetchSiteNews(siteName) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/news/${siteName}`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.articles) {
      return data.articles;
    }

    return [];
  } catch (error) {
    console.error(`❌ Erreur fetchSiteNews (${siteName}):`, error.message);
    return [];
  }
}

/**
 * Récupère tous les articles de tous les sites
 */
export async function fetchAllNews() {
  try {
    const response = await fetch(`${API_BASE_URL}/api/news/all`);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    
    if (data.success && data.articles) {
      return data.articles;
    }

    return [];
  } catch (error) {
    console.error('❌ Erreur fetchAllNews:', error.message);
    return [];
  }
}

/**
 * Vérifie si l'API est disponible
 */
export async function checkAPIHealth() {
  try {
    const response = await fetch(`${API_BASE_URL}/`, {
      timeout: 5000
    });
    
    return response.ok;
  } catch (error) {
    console.error('❌ API non disponible:', error.message);
    return false;
  }
}

// ════════════════════════════════════════════════════════════
// CACHE SIMPLE
// ════════════════════════════════════════════════════════════

const cache = new Map();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

export async function fetchWithCache(key, fetchFunction) {
  const cached = cache.get(key);
  
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    console.log(`📦 Cache utilisé pour: ${key}`);
    return cached.data;
  }

  try {
    const data = await fetchFunction();
    cache.set(key, { data, timestamp: Date.now() });
    return data;
  } catch (error) {
    console.error(`❌ Erreur fetchWithCache (${key}):`, error);
    
    // Si erreur, retourner cache expiré si disponible
    if (cached) {
      console.log(`📦 Utilisation du cache expiré pour: ${key}`);
      return cached.data;
    }
    
    return null;
  }
}

/**
 * Vider le cache manuellement
 */
export function clearCache() {
  cache.clear();
  console.log('🗑️ Cache vidé');
}

// ════════════════════════════════════════════════════════════
// FALLBACK THEMES (si API offline)
// ════════════════════════════════════════════════════════════

function getFallbackThemes() {
  return [
    {
      id: 1,
      title: "Simandou 2025 : Le Géant qui Réveille la Guinée",
      summary: "Le projet ferroviaire de 650 km démarre cette année. Impact économique majeur attendu.",
      category: "ÉCONOMIE",
      image: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=800",
      url: "https://guineematin.com"
    },
    {
      id: 2,
      title: "Startups Tech à Conakry : La Silicon Valley Africaine ?",
      summary: "De l'IA à la fintech, les jeunes entrepreneurs guinéens innovent.",
      category: "TECHNOLOGIE",
      image: "https://images.unsplash.com/photo-1451187530220-a093f13aeeef?w=800",
      url: "https://aminata.com"
    },
    {
      id: 3,
      title: "Barrages de Kaléta et Souapiti : Vers la Souveraineté Énergétique",
      summary: "La Guinée produit désormais 70% de son électricité grâce à l'hydroélectricité.",
      category: "ÉNERGIE",
      image: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800",
      url: "https://guineenews.org"
    }
  ];
}

// ════════════════════════════════════════════════════════════
// UTILITAIRES
// ════════════════════════════════════════════════════════════

/**
 * Formater une date relative
 */
export function formatRelativeTime(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'À l\'instant';
  if (diffMins < 60) return `Il y a ${diffMins} min`;
  if (diffHours < 24) return `Il y a ${diffHours}h`;
  if (diffDays < 7) return `Il y a ${diffDays}j`;
  
  return date.toLocaleDateString('fr-FR', { 
    day: 'numeric', 
    month: 'short' 
  });
}

/**
 * Nettoyer le HTML d'un texte
 */
export function stripHTML(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>/g, '').trim();
}

/**
 * Tronquer un texte
 */
export function truncate(text, maxLength = 150) {
  if (!text || text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + '...';
}