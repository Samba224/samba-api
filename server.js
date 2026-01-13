const express = require('express');
const axios = require('axios');
const { XMLParser } = require('fast-xml-parser');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const parser = new XMLParser();

// ═══════════════════════════════════════════════════════════
// 📡 SCRAPING VIA RSS FEEDS (Plus fiable)
// ═══════════════════════════════════════════════════════════

const RSS_FEEDS = {
  'guineematin': 'https://guineematin.com/feed',
  'aminata': 'https://aminata.com/feed',
  'guineenews': 'https://guineenews.org/feed',
  'africaguinee': 'https://africaguinee.com/feed'
};

async function fetchRSS(url, siteName) {
  try {
    console.log(`📡 Fetching RSS: ${siteName}...`);
    
    const response = await axios.get(url, {
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SambaIA/1.0)'
      }
    });

    const data = parser.parse(response.data);
    const items = data.rss?.channel?.item || data.feed?.entry || [];

    const articles = (Array.isArray(items) ? items : [items]).slice(0, 10).map((item, i) => {
      // Extraction du contenu complet
      const rawContent = item['content:encoded'] || item.content || item.description || item.summary || '';
      const cleanContent = rawContent
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Enlever scripts
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Enlever styles
        .replace(/<[^>]+>/g, '') // Enlever HTML
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#8217;/g, "'")
        .replace(/&#8211;/g, '-')
        .replace(/\s+/g, ' ') // Normaliser espaces
        .trim();
      
      // Extraction de l'excerpt (résumé court)
      const excerpt = cleanContent.substring(0, 250) + (cleanContent.length > 250 ? '...' : '');
      
      // Extraction du contenu complet (limité à 3000 caractères)
      const fullContent = cleanContent.substring(0, 3000);
      
      return {
        id: `${siteName}_${Date.now()}_${i}`,
        title: (item.title || 'Sans titre').trim(),
        excerpt: excerpt,
        summary: excerpt, // Alias pour compatibilité
        content: fullContent,
        link: item.link?.['#text'] || item.link || item.id || '#',
        image: extractImage(item),
        source: siteName,
        category: categorize(item.title || ''),
        timestamp: item.pubDate || item.published || item.updated || new Date().toISOString(),
        author: item.creator || item.author?.name || item.author || 'Rédaction'
      };
    });

    console.log(`✅ ${articles.length} articles RSS de ${siteName}`);
    return articles;

  } catch (error) {
    console.error(`❌ Erreur RSS ${siteName}:`, error.message);
    return [];
  }
}

function extractImage(item) {
  // 1. Media RSS namespace
  if (item['media:content']?.['@_url']) return item['media:content']['@_url'];
  if (item['media:thumbnail']?.['@_url']) return item['media:thumbnail']['@_url'];
  
  // 2. Enclosure (podcasts/attachments)
  if (item.enclosure?.['@_url']) {
    const url = item.enclosure['@_url'];
    if (url.match(/\.(jpg|jpeg|png|gif|webp)$/i)) return url;
  }
  
  // 3. Direct image field
  if (item.image?.url) return item.image.url;
  if (typeof item.image === 'string') return item.image;
  
  // 4. Extract from HTML content
  const htmlContent = item['content:encoded'] || item.description || item.summary || '';
  
  // Chercher balise img
  const imgMatch = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch && imgMatch[1]) {
    let imgUrl = imgMatch[1];
    // Nettoyer l'URL
    imgUrl = imgUrl.replace(/&amp;/g, '&');
    return imgUrl;
  }
  
  // 5. Chercher URL d'image dans le texte
  const urlMatch = htmlContent.match(/(https?:\/\/[^\s<>"]+?\.(?:jpg|jpeg|png|gif|webp))/i);
  if (urlMatch) return urlMatch[1];
  
  return null;
}

function categorize(title) {
  const lower = title.toLowerCase();
  if (lower.match(/économie|banque|mine|simandou/)) return 'ÉCONOMIE';
  if (lower.match(/politique|président|élection/)) return 'POLITIQUE';
  if (lower.match(/tech|numérique|innovation/)) return 'TECHNOLOGIE';
  if (lower.match(/santé|éducation|culture|sport/)) return 'SOCIÉTÉ';
  return 'ACTUALITÉ';
}

// Cache
const cache = new Map();
const CACHE_DURATION = 15 * 60 * 1000; // 15 minutes

async function getCached(key, fetchFn) {
  const cached = cache.get(key);
  if (cached && Date.now() - cached.time < CACHE_DURATION) {
    console.log(`📦 Cache: ${key}`);
    return cached.data;
  }
  const data = await fetchFn();
  cache.set(key, { data, time: Date.now() });
  return data;
}

// ═══════════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════════

app.get('/', (req, res) => {
  res.json({
    message: '🦁 API Samba IA - RSS Scraping',
    version: '4.0.0 - RSS',
    endpoints: {
      'GET /api/news/:site': 'Articles via RSS',
      'GET /api/news/all': 'Tous les flux',
      'GET /api/discover': 'Thèmes découverte'
    },
    sites: Object.keys(RSS_FEEDS)
  });
});

app.get('/api/news/:site', async (req, res) => {
  const { site } = req.params;
  if (!RSS_FEEDS[site]) {
    return res.status(404).json({ success: false, error: 'Site non trouvé' });
  }

  try {
    const articles = await getCached(site, () => fetchRSS(RSS_FEEDS[site], site));
    res.json({
      success: true,
      site,
      count: articles.length,
      articles,
      lastUpdate: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/news/all', async (req, res) => {
  try {
    const results = await Promise.all(
      Object.entries(RSS_FEEDS).map(([name, url]) =>
        getCached(name, () => fetchRSS(url, name))
      )
    );
    const combined = results.flat();
    res.json({
      success: true,
      total: combined.length,
      articles: combined
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/discover', async (req, res) => {
  try {
    const articles = await getCached('guineematin', () =>
      fetchRSS(RSS_FEEDS.guineematin, 'guineematin')
    );
    const themes = articles.slice(0, 6).map((a, i) => ({
      id: i + 1,
      title: a.title,
      summary: a.excerpt,
      category: a.category,
      image: a.image || `https://source.unsplash.com/800x600/?africa,${i}`,
      url: a.link
    }));
    res.json({ success: true, themes });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`\n🦁 API RSS Samba IA - Port ${PORT}`);
  console.log(`📡 ${Object.keys(RSS_FEEDS).length} flux RSS configurés\n`);
});