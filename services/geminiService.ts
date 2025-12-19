
import { GoogleGenAI } from "@google/genai";
import { ClientRecord, MessageType } from "../types";

const getToneInstruction = (type: MessageType): string => {
  switch (type) {
    case 'cordial':
      return "TOM CORDIAL/AMIGÁVEL: Use um tom de lembrete gentil. Comece perguntando se está tudo bem. Diga que notamos uma pequena pendência e gostaríamos de ajudar a regularizar.";
    case 'urgente':
      return "TOM URGENTE/SÉRIO: Use um tom de urgência. Mencione que o atraso prolongado pode afetar o limite de crédito e levar à suspensão do cadastro no crediário próprio.";
    case 'negociacao':
      return "TOM DE NEGOCIAÇÃO: Convide o cliente a vir à loja para conversar ou propôr um acordo. Mostre que a SUPERMODA valoriza a parceria e quer encontrar uma solução.";
    case 'assertiva':
    default:
      return "TOM ASSERTIVO/DIRETO: Seja profissional, direto e foque na quitação. Sem rodeios, mas com educação.";
  }
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateCollectionMessage = async (
  client: ClientRecord, 
  type: MessageType = 'assertiva',
  retries = 5,
  backoff = 4000
): Promise<string> => {
  const toneInstruction = getToneInstruction(type);
  
  const prompt = `
    Você é o responsável pelo setor de cobrança da loja SUPERMODA DIAS DAVILA.
    Sua tarefa é gerar uma mensagem de cobrança para WhatsApp eficiente.
    
    ESTILO DA MENSAGEM: ${toneInstruction}
    
    Dados do cliente:
    - Nome do Cliente: ${client.name}
    - Modalidade de Compra: CREDIÁRIO PRÓPRIO (SUPERMODA)
    - Quantidade de Parcelas Pendentes: ${client.installments}
    - Total de dias em atraso: ${client.daysLate}
    - Valor Total Atualizado para quitação: R$ ${client.valorComMargem.toFixed(2).replace('.', ',')}
    - Chave de Pagamento: PIX
    
    Regras Gerais:
    1. Identifique-se como sendo da SUPERMODA DIAS DAVILA.
    2. Informe o valor de R$ ${client.valorComMargem.toFixed(2).replace('.', ',')} como o valor total para quitação.
    3. Solicite o pagamento via PIX.
    4. Reforce que manter o crediário em dia garante crédito futuro.
    5. NÃO use a frase "caso já tenha pago, desconsidere".
    6. A mensagem deve ser curta, limpa e profissional.
    7. Use emojis de forma moderada e compatível com o tom escolhido.
  `;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          temperature: 0.7,
          topP: 0.9,
        }
      });
      
      return response.text || "Erro ao gerar mensagem de cobrança SUPERMODA.";
    } catch (error: any) {
      let isRateLimit = false;

      // Check standard HTTP status or response status
      if (error?.status === 429 || error?.response?.status === 429) {
        isRateLimit = true;
      }
      
      // Check structured error object (often used in Google APIs)
      if (error?.error?.code === 429 || error?.error?.status === 'RESOURCE_EXHAUSTED') {
        isRateLimit = true;
      }

      // Check message string content as fallback
      const errorMessage = error?.message || error?.toString() || '';
      if (
        errorMessage.includes('429') || 
        errorMessage.includes('RESOURCE_EXHAUSTED') || 
        errorMessage.includes('quota') ||
        errorMessage.includes('Too Many Requests')
      ) {
        isRateLimit = true;
      }
      
      if (isRateLimit && attempt < retries) {
        // Exponential backoff with jitter: backoff * 2^attempt + random(0-1000ms)
        const jitter = Math.random() * 1000;
        const waitTime = (backoff * Math.pow(2, attempt)) + jitter;
        
        console.warn(`Gemini Rate limit (429) hit. Retrying in ${Math.round(waitTime)}ms... (Attempt ${attempt + 1}/${retries})`);
        await delay(waitTime);
        continue;
      }

      console.error("Gemini API Error:", error);
      
      if (attempt === retries && isRateLimit) {
        return "Erro: Limite de cota da API excedido. Aguarde um minuto e tente novamente.";
      }
      
      return `Erro: ${isRateLimit ? 'Limite de requisições excedido.' : 'Falha na IA. Tente gerar novamente.'}`;
    }
  }
  
  return "Erro persistente ao gerar mensagem.";
};
