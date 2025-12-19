
import React, { useState } from 'react';
import { Upload, FileText, MessageSquare, Trash2, Copy, Send, ExternalLink, AlertCircle, Edit2, Check, X, ChevronDown } from 'lucide-react';
import * as XLSX from 'xlsx';
import { ClientRecord, GeneratedMessage, MessageType } from './types';
import { generateCollectionMessage } from './services/geminiService';

const App: React.FC = () => {
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [messages, setMessages] = useState<GeneratedMessage[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; value: string }>({ name: '', value: '' });
  const [selectedType, setSelectedType] = useState<MessageType>('assertiva');

  const messageTypes: { id: MessageType; label: string; icon: string }[] = [
    { id: 'cordial', label: 'Lembrete Amigável', icon: '😊' },
    { id: 'assertiva', label: 'Cobrança Padrão', icon: '📢' },
    { id: 'urgente', label: 'Aviso Urgente', icon: '⚠️' },
    { id: 'negociacao', label: 'Proposta de Acordo', icon: '🤝' },
  ];

  const cleanName = (name: string) => {
    return name.split('-')[0].trim();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
    let file: File | undefined;
    
    if ('files' in e.target && e.target.files?.[0]) {
      file = e.target.files[0];
    } else if ('dataTransfer' in e && e.dataTransfer.files?.[0]) {
      file = e.dataTransfer.files[0];
    }

    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

      const rows = data.slice(1);
      
      const parsedClients: ClientRecord[] = rows.map((row, index) => {
        const id = `CL-${index}-${Date.now()}`;
        const rawName = String(row[1] || 'Cliente Sem Nome');
        const name = cleanName(rawName);
        const installments = Number(row[4] || 1); 
        const daysLate = Number(row[5] || 0);
        const valorTotalOriginal = Number(row[8] || 0);
        
        const valorComMargem = Math.ceil(valorTotalOriginal * 1.05);

        return {
          id,
          name,
          installments,
          daysLate,
          originalValue: valorTotalOriginal,
          juros: 0,
          valorTotalOriginal,
          valorComMargem,
          phone: String(row[3] || '').replace(/\D/g, '')
        };
      }).filter(c => c.valorTotalOriginal > 0);

      setClients(parsedClients);
    };
    reader.readAsBinaryString(file);
  };

  const handleGenerateMessages = async () => {
    if (clients.length === 0) return;
    setIsProcessing(true);
    
    const newMessages: GeneratedMessage[] = clients.map(c => ({
      clientId: c.id,
      clientName: c.name,
      message: '',
      status: 'pending' as const
    }));
    setMessages(newMessages);

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i];
      setMessages(prev => prev.map(m => m.clientId === client.id ? { ...m, status: 'generating' } : m));
      
      const text = await generateCollectionMessage(client, selectedType);
      
      const isError = text.startsWith('Erro:');
      setMessages(prev => prev.map(m => m.clientId === client.id ? { 
        ...m, 
        message: text, 
        status: isError ? 'error' : 'done' 
      } : m));

      // Add delay between requests to avoid rate limits (429)
      if (i < clients.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    setIsProcessing(false);
  };

  const startEditing = (client: ClientRecord) => {
    setEditingClientId(client.id);
    setEditForm({ name: client.name, value: client.valorComMargem.toString() });
  };

  const saveEdit = (id: string) => {
    setClients(prev => prev.map(c => {
      if (c.id === id) {
        return {
          ...c,
          name: cleanName(editForm.name),
          valorComMargem: parseFloat(editForm.value) || 0
        };
      }
      return c;
    }));
    setEditingClientId(null);
  };

  const clearData = () => {
    setClients([]);
    setMessages([]);
    setEditingClientId(null);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 text-slate-800 antialiased">
      {/* Visual Logo Top Bar */}
      <div className="bg-white py-4 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 flex justify-center items-center flex-col">
          <div className="text-3xl md:text-4xl font-bold tracking-tighter flex items-baseline select-none">
            <span style={{ color: '#E35D6A' }}>super</span>
            <span style={{ color: '#6A7CB5' }}>moda</span>
          </div>
          <div className="text-xs md:text-sm tracking-[0.3em] font-medium text-slate-400 -mt-0.5 uppercase select-none">
            calçados
          </div>
        </div>
      </div>

      <header className="bg-red-700 border-b border-red-800 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-white/10 p-1.5 rounded text-white">
              <AlertCircle size={16} />
            </div>
            <div>
              <h1 className="text-sm font-bold text-white leading-none uppercase tracking-tight">DIAS D'AVILA</h1>
              <span className="text-[9px] text-red-100 font-medium uppercase tracking-wider opacity-70">Gestão de Crediário</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {clients.length > 0 && (
              <button 
                onClick={clearData}
                className="flex items-center gap-1.5 text-white hover:bg-red-800 transition-colors text-[10px] font-bold uppercase px-3 py-1.5 rounded-md border border-white/20"
              >
                <Trash2 size={12} />
                Limpar
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 md:py-8">
        {clients.length === 0 ? (
          <div 
            className={`max-w-xl mx-auto border-2 border-dashed rounded-3xl p-8 md:p-12 text-center transition-all bg-white shadow-sm ${dragActive ? 'border-red-400 bg-red-50' : 'border-slate-200 hover:border-slate-300'}`}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileUpload(e); }}
          >
            <div className="bg-slate-50 w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-slate-100">
              <Upload className="text-red-600" size={28} />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2 tracking-tight">Importar Planilha</h2>
            <p className="text-slate-500 mb-6 text-sm font-medium">
              Importe o relatório de inadimplência para iniciar.
            </p>
            <label className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg font-bold text-xs cursor-pointer transition-all shadow-sm inline-flex items-center gap-2 active:scale-95 uppercase tracking-wide">
              <FileText size={14} />
              Carregar XLS
              <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />
            </label>
          </div>
        ) : (
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Left Sidebar: Client List & Selection */}
            <div className="lg:w-1/3 flex flex-col gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col h-fit">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 uppercase text-[11px] tracking-wider">Configurar Cobrança</h3>
                </div>
                
                {/* Tone Selection */}
                <div className="p-4 bg-white border-b border-slate-100">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-3 tracking-widest">Estilo da Mensagem</p>
                  <div className="grid grid-cols-1 gap-2">
                    {messageTypes.map((type) => (
                      <button
                        key={type.id}
                        onClick={() => setSelectedType(type.id)}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border ${
                          selectedType === type.id 
                            ? 'bg-red-50 border-red-200 text-red-700 shadow-sm' 
                            : 'bg-white border-slate-100 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <span className="text-lg">{type.icon}</span>
                        <span className="text-xs font-bold uppercase tracking-tight">{type.label}</span>
                        {selectedType === type.id && <div className="ml-auto w-1.5 h-1.5 bg-red-600 rounded-full" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clients List */}
                <div className="p-4 bg-slate-50/50 border-b border-slate-100">
                  <div className="flex justify-between items-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Inadimplentes</p>
                    <span className="bg-red-600 text-white px-2 py-0.5 rounded-md text-[9px] font-black">
                      {clients.length}
                    </span>
                  </div>
                </div>
                
                <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                  {clients.map((client) => (
                    <div key={client.id} className="p-3.5 hover:bg-slate-50 transition-colors group">
                      {editingClientId === client.id ? (
                        <div className="space-y-2 bg-slate-50 p-1 rounded-lg">
                          <input 
                            type="text" 
                            className="w-full text-xs font-bold uppercase p-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
                            value={editForm.name}
                            onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                            placeholder="Nome do Cliente"
                            autoFocus
                          />
                          <div className="flex items-center gap-2">
                            <div className="relative flex-1">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-[10px] font-bold">R$</span>
                              <input 
                                type="number" 
                                className="w-full text-xs font-bold p-2 pl-7 border border-slate-300 rounded-md bg-white text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
                                value={editForm.value}
                                onChange={(e) => setEditForm({ ...editForm, value: e.target.value })}
                                placeholder="Valor"
                              />
                            </div>
                            <button onClick={() => saveEdit(client.id)} className="p-2 bg-green-600 text-white rounded-md shadow-sm"><Check size={14}/></button>
                            <button onClick={() => setEditingClientId(null)} className="p-2 bg-slate-200 text-slate-600 rounded-md shadow-sm"><X size={14}/></button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-start mb-1">
                            <p className="font-bold text-slate-900 truncate pr-2 text-[11px] uppercase flex items-center gap-1" title={client.name}>
                              {client.name}
                              <button onClick={() => startEditing(client)} className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-600 transition-all ml-1">
                                <Edit2 size={10} />
                              </button>
                            </p>
                            <span className="text-[9px] font-black text-red-600 shrink-0">
                              {client.daysLate}d
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-medium">{client.installments} parc.</span>
                            <span className="font-bold text-slate-900">R$ {client.valorComMargem.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                
                <div className="p-4 bg-white border-t border-slate-200">
                  <button 
                    onClick={handleGenerateMessages}
                    disabled={isProcessing}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:text-slate-500 text-white py-3.5 rounded-xl font-bold text-xs uppercase transition-all shadow-md flex items-center justify-center gap-2 active:scale-[0.98] tracking-widest"
                  >
                    {isProcessing ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Gerando...
                      </>
                    ) : (
                      <>
                        <Send size={14} />
                        Gerar {clients.length} Mensagens
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Main Content: Messages */}
            <div className="lg:w-2/3 flex flex-col gap-4">
              {messages.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-sm">
                  <div className="bg-slate-50 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-200 border border-slate-100">
                    <MessageSquare size={36} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 tracking-tight">Área de Mensagens</h3>
                  <p className="text-slate-500 max-w-xs mx-auto text-sm font-medium leading-relaxed">
                    Selecione o estilo acima e clique em "Gerar" para criar os textos da <span className="text-red-600 font-bold">SUPERMODA</span>.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-1">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 uppercase tracking-tight">
                      <div className="w-1 h-5 bg-red-600 rounded-full" />
                      Mensagens ({selectedType})
                    </h2>
                  </div>
                  <div className="space-y-4">
                    {messages.map((msg) => (
                      <div key={msg.clientId} className={`bg-white rounded-2xl border shadow-sm overflow-hidden transition-all hover:border-red-100 group ${msg.status === 'error' ? 'border-red-300' : 'border-slate-200'}`}>
                        <div className="px-5 py-3 border-b border-slate-100 flex justify-between items-center bg-slate-50/30">
                          <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${msg.status === 'done' ? 'bg-green-500' : msg.status === 'generating' ? 'bg-amber-500 animate-pulse' : msg.status === 'error' ? 'bg-red-500' : 'bg-slate-300'}`} />
                            <span className="font-bold text-slate-800 text-xs uppercase tracking-tight truncate max-w-[200px] md:max-w-none">{msg.clientName}</span>
                          </div>
                          {msg.status === 'done' && (
                            <div className="flex gap-2">
                              <button 
                                onClick={() => copyToClipboard(msg.message)}
                                className="p-2 text-slate-400 hover:text-red-600 transition-colors bg-white rounded-lg border border-slate-100 shadow-sm"
                                title="Copiar"
                              >
                                <Copy size={16} />
                              </button>
                              <a 
                                href={`https://wa.me/${clients.find(c => c.id === msg.clientId)?.phone}?text=${encodeURIComponent(msg.message)}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-slate-400 hover:text-green-600 transition-colors bg-white rounded-lg border border-slate-100 shadow-sm"
                                title="WhatsApp"
                              >
                                <ExternalLink size={16} />
                              </a>
                            </div>
                          )}
                        </div>
                        <div className="p-5">
                          {msg.status === 'generating' ? (
                            <div className="space-y-2">
                              <div className="h-3 bg-slate-100 rounded-full animate-pulse w-full" />
                              <div className="h-3 bg-slate-100 rounded-full animate-pulse w-5/6" />
                            </div>
                          ) : msg.status === 'done' || msg.status === 'error' ? (
                            <div>
                              <p className={`whitespace-pre-wrap leading-relaxed font-medium text-[13px] font-mono p-4 rounded-xl border ${msg.status === 'error' ? 'bg-red-50 border-red-100 text-red-600' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
                                {msg.message}
                              </p>
                              {msg.status === 'done' && (
                                <div className="mt-4 flex justify-end gap-2">
                                  <button 
                                     onClick={() => copyToClipboard(msg.message)}
                                     className="text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-red-600 px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5"
                                  >
                                    <Copy size={12} />
                                    Copiar
                                  </button>
                                  <a 
                                     href={`https://wa.me/${clients.find(c => c.id === msg.clientId)?.phone}?text=${encodeURIComponent(msg.message)}`}
                                     target="_blank"
                                     rel="noopener noreferrer"
                                     className="text-[10px] font-bold uppercase tracking-widest bg-green-600 text-white hover:bg-green-700 px-4 py-2 rounded-lg transition-all flex items-center gap-2 shadow-sm"
                                  >
                                    <Send size={12} />
                                    WhatsApp
                                  </a>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="text-slate-400 italic text-[11px] text-center">Aguardando geração...</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Mobile Sticky CTA */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 py-3 px-4 md:hidden z-40 shadow-lg">
        <button 
          onClick={clients.length === 0 ? () => document.querySelector('input')?.click() : handleGenerateMessages}
          disabled={isProcessing}
          className="w-full bg-red-600 text-white py-4 rounded-xl font-bold text-sm uppercase shadow-md flex items-center justify-center gap-2 active:scale-95 transition-transform tracking-widest"
        >
          {clients.length === 0 ? <Upload size={18} /> : <Send size={18} />}
          {clients.length === 0 ? 'Importar XLS' : isProcessing ? 'Processando...' : `Gerar (${selectedType})`}
        </button>
      </footer>
    </div>
  );
};

export default App;
