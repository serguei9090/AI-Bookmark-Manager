import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json({ limit: '10mb' }));

  // Helper to initialize Gemini client safely
  const getGeminiClient = () => {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY environment variable is not set');
    }
    return new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  };

  // API Route: Categorize existing bookmarks
  app.post('/api/ai/auto-sort', async (req, res) => {
    try {
      const { bookmarks, folders, systemPrompt } = req.body;
      const ai = getGeminiClient();
      
      const prompt = `
        You are an expert bookmark organizer. Please categorize these bookmarks into the provided folders.
        System Context: ${systemPrompt || 'Organize properly.'}
        
        Folders:
        ${folders.map((f: any) => `- ID: ${f.id}, Name: ${f.name}, Context: ${f.promptContext}`).join('\n')}
        
        Bookmarks:
        ${bookmarks.map((b: any) => `- ID: ${b.id}, URL: ${b.url}, Title: ${b.title}`).join('\n')}
        
        Return a JSON mapping of bookmark IDs to the best-matching folder ID. If no good match, use null.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              mapping: {
                type: Type.OBJECT,
                description: "Mapping where key is bookmark ID and value is the best folder ID.",
                additionalProperties: { type: Type.STRING },
              }
            },
            required: ["mapping"]
          }
        }
      });
      
      const jsonStr = response.text || "{}";
      const data = JSON.parse(jsonStr);
      res.json({ success: true, mapping: data.mapping });
    } catch (error: any) {
      console.error("AI Sort Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Propose categories
  app.post('/api/ai/propose-category', async (req, res) => {
    try {
      const { bookmarks, systemPrompt } = req.body;
      const ai = getGeminiClient();
      
      const prompt = `
        You are an expert bookmark organizer. Analyze these bookmarks and propose a set of logical folder categories for them.
        System Context: ${systemPrompt || 'Propose logical categories.'}
        
        Bookmarks:
        ${bookmarks.map((b: any) => `- URL: ${b.url}, Title: ${b.title}`).join('\n')}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              proposals: {
                type: Type.ARRAY,
                description: "List of proposed folder categories.",
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    promptContext: { type: Type.STRING, description: "A brief prompt context describing what type of sites go here." }
                  },
                  required: ["name", "promptContext"]
                }
              }
            },
            required: ["proposals"]
          }
        }
      });
      
      const jsonStr = response.text || "{}";
      const data = JSON.parse(jsonStr);
      res.json({ success: true, proposals: data.proposals });
    } catch (error: any) {
      console.error("AI Category Proposal Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // API Route: Summarize bookmark
  app.post('/api/ai/summarize', async (req, res) => {
    try {
      const { bookmark } = req.body;
      const ai = getGeminiClient();
      
      const prompt = `
        Provide a concise 1-2 sentence summary and max 5 tags for this bookmark.
        URL: ${bookmark.url}
        Title: ${bookmark.title}
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              summary: { type: Type.STRING },
              tags: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              }
            },
            required: ["summary", "tags"]
          }
        }
      });
      
      const jsonStr = response.text || "{}";
      const data = JSON.parse(jsonStr);
      res.json({ success: true, summary: data.summary, tags: data.tags });
    } catch (error: any) {
      console.error("AI Summarize Error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
