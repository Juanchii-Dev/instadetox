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

    // Verificamos si la última pregunta del usuario está relacionada con un error de conexión
    const lastUserMessage = messages.filter(msg => msg.role === 'user').pop();
    
    // Si hay problemas con la API, usamos una respuesta local para fines de demostración
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "demo") {
      console.log("Usando modo de demostración (sin API Key de OpenAI)");
      
      // Respondemos con un mensaje genérico para demostración
      return res.json({
        content: `**Funcionamiento en modo de demostración.**\n\nHola, soy AURA en modo de demostración. Actualmente, no puedo generar respuestas personalizadas debido a limitaciones de la API. Pero puedo ayudarte con:\n\n1. Recomendaciones generales sobre desintoxicación digital\n2. Información sobre las funciones de la aplicación\n3. Consejos para el bienestar digital\n\n¿En qué estás interesado? 🌱`
      });
    }

    try {
      // Preparar los mensajes para la API de OpenAI
      const formattedMessages = [
        SYSTEM_MESSAGE,
        ...messages.slice(-10) // Limitamos a los últimos 10 mensajes para mantener el contexto manejable
      ];

      // Realizar la petición a la API de OpenAI
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini", // Modelo más ligero que consume menos créditos
        messages: formattedMessages,
        temperature: 0.7,
        max_tokens: 500,
      });

      // Obtener la respuesta del asistente
      const assistantMessage = response.choices[0].message;

      // Enviar la respuesta al cliente
      return res.json({
        content: assistantMessage.content
      });
    } catch (apiError) {
      console.error("Error en la llamada a la API de OpenAI:", apiError);
      
      // Si hay un error con la API, entregamos una respuesta genérica
      return res.json({
        content: `**Respuesta de emergencia:**\n\nLo siento, estoy experimentando dificultades técnicas para procesar tu consulta en este momento. \n\nPuedes intentar:\n\n1. Hacer una pregunta más sencilla\n2. Intentarlo de nuevo más tarde\n3. Explorar otras secciones de la aplicación mientras tanto\n\n¿Hay algo más en lo que pueda ayudarte dentro de mis capacidades actuales? 🔧`
      });
    }
  } catch (error) {
    console.error("Error general en el procesamiento de la solicitud de chat:", error);
    // En lugar de devolver un error 500, entregamos una respuesta degradada
    res.json({
      content: `**Disculpa la interrupción**\n\nHa ocurrido un error inesperado. Por favor, intenta refrescar la página o vuelve más tarde. Estamos trabajando para mejorar tu experiencia. 🛠️`
    });
  }
};