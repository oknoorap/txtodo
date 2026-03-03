import { GoogleGenAI } from "@google/genai";
import fs from "fs";
import path from "path";

async function run() {
  console.log('Generating favicon using Gemini...');
  try {
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
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        const publicDir = path.resolve(process.cwd(), 'public');
        if (!fs.existsSync(publicDir)) {
          fs.mkdirSync(publicDir);
        }
        fs.writeFileSync(path.resolve(publicDir, 'icon.png'), buffer);
        console.log('Icon generated successfully at', path.resolve(publicDir, 'icon.png'));
        break;
      }
    }
  } catch (error) {
    console.error('Failed to generate icon:', error);
    process.exit(1);
  }
}

run();
