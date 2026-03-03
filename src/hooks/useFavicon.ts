import { useEffect } from 'react';
import { GoogleGenAI } from '@google/genai';

export function useFavicon() {
  useEffect(() => {
    async function generateAndSetFavicon() {
      const storedIcon = localStorage.getItem('txtodo-favicon');
      
      if (storedIcon) {
        setFavicon(storedIcon);
        return;
      }

      try {
        console.log('Generating favicon using Gemini...');
        const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash-image',
          contents: 'A minimalist, flat vector icon of a checklist or to-do list with a checkmark, clean background, suitable for an app icon or favicon. Solid colors, modern design.',
          config: {
            imageConfig: {
              aspectRatio: "1:1",
              imageSize: "512px"
            }
          }
        });

        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            const base64Data = `data:image/png;base64,${part.inlineData.data}`;
            localStorage.setItem('txtodo-favicon', base64Data);
            setFavicon(base64Data);
            console.log('Favicon generated successfully!');
            break;
          }
        }
      } catch (error) {
        console.error('Failed to generate favicon:', error);
      }
    }

    function setFavicon(url: string) {
      let link: HTMLLinkElement | null = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = url;
    }

    generateAndSetFavicon();
  }, []);
}
