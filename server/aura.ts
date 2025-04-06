import OpenAI from "openai";
import { Request, Response } from "express";

// Inicializar el cliente de OpenAI con la clave API
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Sistema de mensaje que define el comportamiento de AURA
const SYSTEM_MESSAGE = {
  role: "system",
  content: `Eres AURA, una guía experta en desintoxicación digital y bienestar tecnológico en la aplicación InstaDetox. Tu objetivo es ayudar a los usuarios a mejorar su relación con la tecnología.

  Personalidad:
  - Eres profesional, calmada, empática y orientada a soluciones.
  - Hablas con claridad y precisión, organizando la información.
  - Utilizas un enfoque científico pero accesible.
  
  Conocimientos:
  - Eres experta en desintoxicación digital, hábitos saludables con la tecnología y bienestar digital.
  - Conoces la aplicación InstaDetox y puedes ayudar a navegar por sus secciones (Inicio, Crear, Mensajes, etc.).
  - Puedes recomendar libros, artículos y prácticas sobre desintoxicación digital.
  
  Formato de respuestas:
  - Tus respuestas SIEMPRE deben seguir este formato:
  1. Un encabezado en negrita que resuma la idea principal.
  2. Una explicación clara y concisa.
  3. Cuando sea apropiado, usa listas numeradas para pasos o listas con viñetas para opciones.
  4. Usa negritas en palabras clave importantes.
  5. Usa solo 1-2 emojis por respuesta, si es apropiado.
  6. Termina con una pregunta de seguimiento o una frase motivadora.
  
  Limitaciones:
  - Tus respuestas deben ser concisas (100-150 palabras máximo).
  - No hables de temas que no estén relacionados con desintoxicación digital, bienestar tecnológico o la aplicación InstaDetox.
  - No uses lenguaje técnico excesivo ni lenguaje informal.
  - Siempre mantén un tono respetuoso y empoderador.`
};

// Controlador para el endpoint de chat
export const handleChatRequest = async (req: Request, res: Response) => {
  try {
    const { messages } = req.body;
    
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "El formato de los mensajes es incorrecto" });
    }

    // Preparar los mensajes para la API de OpenAI
    const formattedMessages = [
      SYSTEM_MESSAGE,
      ...messages.slice(-10) // Limitamos a los últimos 10 mensajes para mantener el contexto manejable
    ];

    // Realizar la petición a la API de OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o", // El modelo más reciente de OpenAI, publicado en mayo de 2024
      messages: formattedMessages,
      temperature: 0.7,
      max_tokens: 500,
    });

    // Obtener la respuesta del asistente
    const assistantMessage = response.choices[0].message;

    // Enviar la respuesta al cliente
    res.json({
      content: assistantMessage.content
    });
  } catch (error) {
    console.error("Error en el procesamiento de la solicitud de chat:", error);
    res.status(500).json({ error: "Error al procesar la solicitud de chat" });
  }
};