import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  Mic,
  Square,
  Send,
  Search,
  MapPin,
  Volume2,
  Image as ImageIcon,
  Video,
  Copy,
  Check,
  Download,
  RefreshCw,
  Upload,
  ExternalLink,
  FileText,
  Zap,
  MessageSquare,
  Radio,
  Layers,
  Briefcase,
} from "lucide-react";
import { api, fmtErr } from "@/lib/api";
import {
  buildSiteImagePlanningTable,
  buildMasterImagePromptMarkdown,
} from "@/lib/sitegen/masterImagePrompt";

export default function G360FreeAiHub({
  dark = false,
  activeBusiness,
  onOpenGbpPackage,
  onOpenCrm,
}) {
  const [activeTab, setActiveTab] = useState("chat");
  const [copiedKey, setCopiedKey] = useState("");

  const biz = activeBusiness || {name: "Nenhuma empresa selecionada", category: "", city: "", uf: "", rating: null, rating_count: null};

  // ---------------- 1. MULTI-TURN GEMINI CHATBOT STATE ----------------
  const [chatRole, setChatRole] = useState("estrategista");
  const [chatModel, setChatModel] = useState("gemini-3.8-flash");
  const [useMapsGrounding, setUseMapsGrounding] = useState(true);
  const [useSearchGrounding, setUseSearchGrounding] = useState(true);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  // ---------------- 2. AUDIO TRANSCRIPTION (gemini-3.5-transcribe) STATE ----------------
  const [recordingTarget, setRecordingTarget] = useState(null); // "transcribe" | "chat" | "voice"
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const [transcribeHint, setTranscribeHint] = useState("crm");
  const [transcribedText, setTranscribedText] = useState("");
  const [transcribing, setTranscribing] = useState(false);

  // ---------------- 3. LIVE VOICE CONVERSATION STATE ----------------
  const [voiceMode, setVoiceMode] = useState("consultor"); // "consultor" | "simulacao-cliente"
  const [voiceTextPrompt, setVoiceTextPrompt] = useState("");
  const [voiceLoading, setVoiceLoading] = useState(false);
  const [voiceTurns, setVoiceTurns] = useState([]);

  // ---------------- 4. MAPS & SEARCH GROUNDING RADAR STATE ----------------
  const [groundingQuery, setGroundingQuery] = useState(
    `${biz.category || "Sorveteria"} em ${biz.city || "Campo Grande"}`
  );
  const [mapsResult, setMapsResult] = useState(null);
  const [searchResult, setSearchResult] = useState(null);
  const [groundingLoading, setGroundingLoading] = useState(false);

  // ---------------- 5. FREE IMAGE & VIDEO STUDIO STATE ----------------
  const [imgPrompt, setImgPrompt] = useState(
    `Banner institucional moderno para ${biz.name} em ${biz.city} destacando qualidade e atendimento rápido`
  );
  const [imgAspect, setImgAspect] = useState("16:9");
  const [uploadedBase64, setUploadedBase64] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [imgLoading, setImgLoading] = useState(false);

  const [vidPrompt, setVidPrompt] = useState(
    `Apresentação dinâmica da ${biz.name} em ${biz.city} com chamada para WhatsApp e avaliação 5 estrelas`
  );
  const [vidAspect, setVidAspect] = useState("16:9");
  const [vidLoading, setVidLoading] = useState(false);
  const [videoMeta, setVideoMeta] = useState(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState("");
  const canvasRef = useRef(null);

  useEffect(() => {
    if (activeBusiness?.name) {
      const cityLabel = activeBusiness.city || "Anápolis";
      const catLabel = activeBusiness.category || "Empresa Local";
      setGroundingQuery(`${catLabel} em ${cityLabel}`);
      setImgPrompt(
        `Fotografia comercial realista para ${activeBusiness.name} (${catLabel}) em ${cityLabel}, luz natural equilibrada, sem textos sobrepostos`
      );
      setVidPrompt(
        `Apresentação comercial de ${activeBusiness.name} (${catLabel}) em ${cityLabel} com chamada para WhatsApp`
      );
      setMessages([]); setVoiceTurns([]);
    }
  }, [activeBusiness?.name, activeBusiness?.city, activeBusiness?.category]);

  const copyText = (key, text) => {
    navigator.clipboard.writeText(String(text || ""));
    setCopiedKey(key);
    toast.success("Copiado para a área de transferência!");
    setTimeout(() => setCopiedKey(""), 1800);
  };

  // ---------------- MICROPHONE RECORDING HELPER ----------------
  const startRecording = async (target) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64Audio = String(reader.result || "");
          if (target === "transcribe") {
            await handleTranscribeAudio(base64Audio, mr.mimeType || "audio/webm");
          } else if (target === "chat") {
            await handleTranscribeIntoChat(base64Audio, mr.mimeType || "audio/webm");
          } else if (target === "voice") {
            await handleVoiceConversationTurn(base64Audio, mr.mimeType || "audio/webm", "");
          }
        };
        reader.readAsDataURL(blob);
      };
      mediaRecorderRef.current = mr;
      mr.start();
      setRecordingTarget(target);
      toast.info("Microfone gravando... Clique em Parar quando terminar de falar.");
    } catch {
      // Fallback simulation if browser blocks mic in iframe preview
      toast.info("Simulando captura de áudio inteligente no ambiente de pré-visualização...");
      if (target === "transcribe") {
        await handleTranscribeAudio("", "audio/webm");
      } else if (target === "chat") {
        setChatInput(
          `Quais são os 3 argumentos mais fortes para fechar a otimização do Google Meu Negócio com ${biz.name}?`
        );
      } else if (target === "voice") {
        await handleVoiceConversationTurn("", "audio/webm", "");
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecordingTarget(null);
  };

  // ---------------- 1. CHAT HANDLER ----------------
  const handleSendChat = async (customText) => {
    const textToSend = String(customText ?? chatInput).trim();
    if (!textToSend) return;

    const nextHistory = [...messages, { role: "user", text: textToSend }];
    setMessages(nextHistory);
    setChatInput("");
    setChatLoading(true);

    try {
      const { data } = await api.post("/ai/chat", {
        message: textToSend,
        history: messages.map((m) => ({ role: m.role, text: m.text })),
        role: chatRole,
        model: chatModel,
        useSearch: useSearchGrounding,
        useMaps: useMapsGrounding,
        businessContext: biz,
      });

      setMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: data.reply || "Resposta processada.",
          source: data.source || chatModel,
          citations: data.citations || [],
        },
      ]);
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao consultar o assistente Gemini"));
    } finally {
      setChatLoading(false);
    }
  };

  const handleTranscribeIntoChat = async (audioBase64, mimeType) => {
    setTranscribing(true);
    try {
      const { data } = await api.post("/ai/transcribe", {
        audioBase64,
        mimeType,
        contextHint: "chat",
      });
      if (data.transcript) {
        setChatInput(data.transcript);
        toast.success("Fala transcrita com gemini-3.5-transcribe!");
      }
    } catch (e) {
      toast.error(fmtErr(e, "Falha ao transcrever áudio"));
    } finally {
      setTranscribing(false);
    }
  };

  // ---------------- 2. AUDIO TRANSCRIPTION HANDLER ----------------
  const handleTranscribeAudio = async (audioBase64, mimeType) => {
    setTranscribing(true);
    try {
      const { data } = await api.post("/ai/transcribe", {
        audioBase64,
        mimeType,
        contextHint: transcribeHint,
      });
      setTranscribedText(data.transcript || "");
      toast.success("Áudio transcrito gratuitamente via gemini-3.5-transcribe!");
    } catch (e) {
      toast.error(fmtErr(e, "Falha na transcrição de áudio"));
    } finally {
      setTranscribing(false);
    }
  };

  // ---------------- 3. LIVE VOICE CONVERSATION HANDLER ----------------
  const speakTextInBrowser = (text, audioDataUrl) => {
    if (audioDataUrl) {
      try {
        const audio = new Audio(audioDataUrl);
        audio.play().catch(() => {});
        return;
      } catch {}
    }
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "pt-BR";
        utter.rate = 1.03;
        window.speechSynthesis.speak(utter);
      } catch {}
    }
  };

  const handleVoiceConversationTurn = async (audioBase64, mimeType, manualText) => {
    setVoiceLoading(true);
    try {
      const { data } = await api.post("/ai/voice-turn", {
        audioBase64,
        mimeType,
        textInput: manualText || voiceTextPrompt,
        businessContext: biz,
        mode: voiceMode,
      });

      const turn = {
        speaker: voiceMode === "simulacao-cliente" ? `Proprietário (${biz.name})` : "Consultor Voz G360",
        userTranscript: data.userTranscript,
        spokenReply: data.spokenReply,
        audioDataUrl: data.audioDataUrl,
        source: data.source || "gemini-3.8-live",
      };

      setVoiceTurns((prev) => [turn, ...prev]);
      setVoiceTextPrompt("");
      speakTextInBrowser(data.spokenReply, data.audioDataUrl);
      toast.success("Resposta de voz gerada!");
    } catch (e) {
      toast.error(fmtErr(e, "Falha na conversa por voz"));
    } finally {
      setVoiceLoading(false);
    }
  };

  // ---------------- 4. MAPS & SEARCH GROUNDING HANDLER ----------------
  const handleRunGrounding = async () => {
    setGroundingLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        api.post("/ai/maps-grounding", {
          query: groundingQuery,
          businessName: biz.name,
          city: biz.city,
          category: biz.category,
          lat: biz.lat,
          lng: biz.lng,
        }),
        api.post("/ai/search-grounding", {
          query: `Tendências de busca e palavras-chave locais para ${groundingQuery}`,
          businessName: biz.name,
          city: biz.city,
          category: biz.category,
        }),
      ]);
      setMapsResult(mRes.data);
      setSearchResult(sRes.data);
      toast.success("Dados do Google Maps e Google Search atualizados!");
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao consultar Maps e Search Grounding"));
    } finally {
      setGroundingLoading(false);
    }
  };

  // ---------------- 5. FREE IMAGE & VIDEO STUDIO HANDLERS ----------------
  const handleUploadRefImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadedBase64(String(reader.result || ""));
      toast.success("Imagem base carregada para edição ou animação!");
    };
    reader.readAsDataURL(file);
  };

  const handleGenerateOrEditImage = async () => {
    setImgLoading(true);
    try {
      const { data } = await api.post("/ai/image", {
        prompt: imgPrompt,
        aspectRatio: imgAspect,
        base64Image: uploadedBase64 || undefined,
        businessName: biz.name,
        city: biz.city,
      });
      if (data.imageUrl) {
        setGeneratedImageUrl(data.imageUrl);
        toast.success("Arte gerada gratuitamente para o Perfil da Empresa e Site Express!");
      }
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao gerar imagem"));
    } finally {
      setImgLoading(false);
    }
  };

  const renderAnimatedCanvasVideo = (meta, baseImgSrc) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const w = vidAspect === "9:16" ? 540 : 960;
    const h = vidAspect === "9:16" ? 960 : 540;
    canvas.width = w;
    canvas.height = h;

    const bgImg = new Image();
    const imgToLoad = baseImgSrc || generatedImageUrl || "";
    if (imgToLoad) bgImg.src = imgToLoad;

    let frame = 0;
    const totalFrames = 120; // ~4 seconds at 30fps

    let recorder = null;
    const videoChunks = [];
    try {
      const stream = canvas.captureStream(30);
      recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) videoChunks.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(videoChunks, { type: "video/webm" });
        setRecordedVideoUrl(URL.createObjectURL(blob));
      };
      recorder.start();
    } catch {}

    const drawFrame = () => {
      const progress = frame / totalFrames;
      ctx.clearRect(0, 0, w, h);

      // Google Official Gradient Background with subtle zoom
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, "#0F172A");
      grad.addColorStop(0.55, "#1A73E8");
      grad.addColorStop(1, "#0D47A1");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      if (bgImg.complete && bgImg.naturalWidth > 0) {
        const scale = 1 + progress * 0.08;
        const sw = w * scale;
        const sh = h * scale;
        ctx.save();
        ctx.globalAlpha = 0.38;
        ctx.drawImage(bgImg, (w - sw) / 2, (h - sh) / 2, sw, sh);
        ctx.restore();
      }

      // Animated Google Glow Circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 - 20, 140 + Math.sin(progress * Math.PI * 2) * 18, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(251, 188, 4, 0.35)";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      // Badge
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      const badgeW = 260;
      ctx.fillRect(w / 2 - badgeW / 2, h / 2 - 110, badgeW, 34);
      ctx.fillStyle = "#FBBC04";
      ctx.font = "bold 13px Inter, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(meta.badge || "DESTAQUE GOOGLE").toUpperCase(), w / 2, h / 2 - 88);

      // Headline
      ctx.fillStyle = "#FFFFFF";
      ctx.font = `bold ${vidAspect === "9:16" ? 30 : 38}px Inter, sans-serif`;
      ctx.fillText(String(meta.headline || biz.name).slice(0, 32), w / 2, h / 2 - 25);

      // Caption
      ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
      ctx.font = `500 ${vidAspect === "9:16" ? 16 : 20}px Inter, sans-serif`;
      ctx.fillText(String(meta.caption || vidPrompt).slice(0, 58), w / 2, h / 2 + 22);

      // Bottom Google 4-color bar
      const barY = h - 12;
      const quarter = w / 4;
      ctx.fillStyle = "#4285F4";
      ctx.fillRect(0, barY, quarter, 12);
      ctx.fillStyle = "#EA4335";
      ctx.fillRect(quarter, barY, quarter, 12);
      ctx.fillStyle = "#FBBC04";
      ctx.fillRect(quarter * 2, barY, quarter, 12);
      ctx.fillStyle = "#34A853";
      ctx.fillRect(quarter * 3, barY, quarter, 12);

      frame++;
      if (frame <= totalFrames) {
        requestAnimationFrame(drawFrame);
      } else if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    };

    drawFrame();
  };

  const handleGenerateOrAnimateVideo = async () => {
    setVidLoading(true);
    try {
      const { data } = await api.post("/ai/video", {
        prompt: vidPrompt,
        aspectRatio: vidAspect,
        base64Image: uploadedBase64 || generatedImageUrl || undefined,
        businessName: biz.name,
        city: biz.city,
      });
      setVideoMeta(data);
      if (data.videoUrl) {
        setRecordedVideoUrl(data.videoUrl);
      } else {
        setTimeout(() => {
          renderAnimatedCanvasVideo(data, uploadedBase64 || generatedImageUrl);
        }, 100);
      }
      toast.success("Vídeo gerado e animado gratuitamente!");
    } catch (e) {
      toast.error(fmtErr(e, "Erro ao gerar vídeo"));
    } finally {
      setVidLoading(false);
    }
  };

  const cardSurface = dark
    ? "bg-[#14121E] border border-white/[0.08] text-[#EDE9FE] shadow-[0_4px_20px_rgba(0,0,0,0.35)] rounded-2xl"
    : "bg-white border border-slate-200/80 text-[#1A1033] shadow-[0_2px_12px_rgba(0,0,0,0.06)] rounded-2xl";
  const subSurface = dark
    ? "bg-white/[0.04] border border-white/[0.08] text-[#EDE9FE]"
    : "bg-slate-50 border border-slate-200/80 text-[#1A1033]";
  const textMuted = dark ? "text-[#9D98B3]" : "text-[#64748B]";

  return (
    <div className="max-w-[1440px] mx-auto w-full px-4 sm:px-6 py-6 space-y-6" data-testid="g360-free-ai-hub">
      {/* HEADER BANNER */}
      <div className={`rounded-2xl border backdrop-blur-xl p-5 sm:p-6 shadow-sm ${cardSurface}`}>
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] border border-[#7C3AED]/20">
              <Zap size={13} />
              <span>Central de IA — conexões dependem de homologação</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Central de IA, Voz e Criação Visual
            </h1>
            <p className={`text-xs sm:text-sm ${textMuted}`}>
              Recursos disponíveis para configuração em <strong>{biz.name}</strong> ({biz.city}): Chat Multi-Turno,
              Transcricao de Audio por Microfone, Conversa por Voz ao Vivo, Google Maps e Search Grounding, mais Estudio
              de Imagens e Vídeos. Nenhuma conexão ou gratuidade é garantida nesta versão local.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {[
              { id: "chat", label: "Chatbot Gemini", icon: MessageSquare },
              { id: "transcribe", label: "Transcrever Audio", icon: Mic },
              { id: "voice", label: "Conversa por Voz", icon: Radio },
              { id: "grounding", label: "Maps e Search", icon: MapPin },
              { id: "media", label: "Imagens e Videos", icon: Video },
            ].map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  data-testid={`free-ai-tab-${t.id}`}
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    active
                      ? "bg-[#7C3AED] text-white shadow-sm"
                      : dark
                      ? "bg-white/[0.04] text-[#9D98B3] hover:text-white border border-white/[0.08]"
                      : "bg-slate-50 text-[#64748B] hover:text-[#1A1033] border border-slate-200/80"
                  }`}
                >
                  <Icon size={14} />
                  <span>{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* TAB 1: MULTI-TURN GEMINI CHATBOT */}
      {activeTab === "chat" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`lg:col-span-4 rounded-2xl border p-5 space-y-5 ${cardSurface}`}>
            <div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                Configuracao do Consultor Gratuito
              </h2>
              <p className={`text-xs mt-1 ${textMuted}`}>
                As conexões externas exigem configuração, disponibilidade e autorização de uso.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold block">Especialidade do Consultor</label>
              <div className="grid grid-cols-1 gap-2">
                {[
                  {
                    id: "estrategista",
                    title: "Estrategista GBP Check & Geogrid",
                    desc: "Diagnostico de perfil, categorias e ranking 5x5",
                  },
                  {
                    id: "copywriter",
                    title: "Copywriter SEO Local",
                    desc: "Descricoes de 750 caracteres, servicos e posts",
                  },
                  {
                    id: "vendas",
                    title: "Fechador Comercial (Script 30s)",
                    desc: "Argumentos rapidos para fechar contrato na hora",
                  },
                ].map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setChatRole(r.id)}
                    className={`text-left p-3 rounded-xl border transition-all cursor-pointer ${
                      chatRole === r.id
                        ? "border-[#7C3AED] bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#EDE9FE]"
                        : dark
                        ? "border-white/[0.08] bg-white/[0.04] text-[#EDE9FE]"
                        : "border-slate-200/80 bg-slate-50 text-[#1A1033]"
                    }`}
                  >
                    <div className="text-xs font-bold">{r.title}</div>
                    <div className={`text-[11px] mt-0.5 ${textMuted}`}>{r.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold block">Modelo Gemini Gratuito</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setChatModel("gemini-3.8-flash")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                    chatModel === "gemini-3.8-flash"
                      ? "border-[#7C3AED] bg-[#7C3AED] text-white"
                      : subSurface
                  }`}
                >
                  gemini-3.8-flash (Completo)
                </button>
                <button
                  type="button"
                  onClick={() => setChatModel("gemini-3.1-flash-lite")}
                  className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                    chatModel === "gemini-3.1-flash-lite"
                      ? "border-[#7C3AED] bg-[#7C3AED] text-white"
                      : subSurface
                  }`}
                >
                  gemini-3.1-flash-lite (Ultra Rapido)
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold block">Fontes do Google em Tempo Real</label>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setUseMapsGrounding((v) => !v)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                    useMapsGrounding ? "border-[#10B981] bg-[#10B981]/10 text-[#10B981]" : subSurface
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <MapPin size={14} /> Google Maps Grounding
                  </span>
                  <span>{useMapsGrounding ? "ATIVO" : "DESATIVADO"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUseSearchGrounding((v) => !v)}
                  className={`flex items-center justify-between p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                    useSearchGrounding ? "border-[#7C3AED] bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA]" : subSurface
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Search size={14} /> Google Search Grounding
                  </span>
                  <span>{useSearchGrounding ? "ATIVO" : "DESATIVADO"}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-inherit">
              <div className={`text-[11px] font-bold uppercase tracking-wider ${textMuted}`}>
                Perguntas Rapidas para {biz.name}
              </div>
              {[
                `Crie um argumento de 30 segundos para vender a verificacao e otimizacao para ${biz.name}.`,
                `Quais sao as melhores palavras-chave locais para ${biz.category} em ${biz.city}?`,
                `Escreva uma resposta profissional para uma avaliacao de cliente em ${biz.name}.`,
              ].map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendChat(q)}
                  className={`w-full text-left text-xs p-2.5 rounded-xl border hover:border-[#7C3AED] transition-colors cursor-pointer ${subSurface}`}
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          <div className={`lg:col-span-8 rounded-2xl border flex flex-col h-[620px] ${cardSurface}`}>
            <div className="p-4 border-b border-inherit flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#7C3AED] to-[#9333EA] text-white grid place-items-center">
                  <Bot size={18} />
                </div>
                <div>
                  <div className="text-sm font-bold">Consultor G360 Multi-Turno</div>
                  <div className={`text-[11px] ${textMuted}`}>
                    Modelo ativo: {chatModel} | Empresa: {biz.name}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setMessages([
                    {
                      role: "model",
                      text: `Historico reiniciado. Pronto para analisar ${biz.name} em ${biz.city}.`,
                      source: chatModel,
                      citations: [],
                    },
                  ])
                }
                className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${subSurface}`}
              >
                <RefreshCw size={13} /> Limpar Conversa
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed ${
                      m.role === "user"
                        ? "bg-[#7C3AED] text-white shadow-sm"
                        : dark
                        ? "bg-white/[0.04] border border-white/[0.08] text-[#EDE9FE]"
                        : "bg-slate-50 border border-slate-200/80 text-[#1A1033]"
                    }`}
                  >
                    {m.text}

                    {m.citations && m.citations.length > 0 && (
                      <div className="mt-3 pt-2.5 border-t border-inherit flex flex-wrap gap-1.5">
                        {m.citations.map((c, cIdx) => (
                          <a
                            key={cIdx}
                            href={c.uri}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#7C3AED]/15 text-[#7C3AED] dark:text-[#A78BFA] hover:underline"
                          >
                            {c.type === "maps" ? <MapPin size={11} /> : <Search size={11} />}
                            <span>{c.title}</span>
                            <ExternalLink size={10} />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 px-1">
                    <span className={`text-[10px] ${textMuted}`}>
                      {m.role === "user" ? "Voce" : `Google ${m.source || chatModel}`}
                    </span>
                    {m.role === "model" && (
                      <button
                        type="button"
                        onClick={() => copyText(`chat-${idx}`, m.text)}
                        className="text-[10px] text-[#7C3AED] dark:text-[#A78BFA] font-semibold hover:underline cursor-pointer"
                      >
                        {copiedKey === `chat-${idx}` ? "Copiado" : "Copiar"}
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className={`text-xs font-medium px-3 py-2 rounded-xl inline-block ${subSurface}`}>
                  Processando estrategia com {chatModel}...
                </div>
              )}
            </div>

            <div className="p-4 border-t border-inherit flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  recordingTarget === "chat" ? stopRecording() : startRecording("chat")
                }
                title="Ditar mensagem por voz (gemini-3.5-transcribe)"
                className={`p-3 rounded-xl border transition-all cursor-pointer ${
                  recordingTarget === "chat"
                    ? "bg-[#EA4335] text-white border-[#EA4335] animate-pulse"
                    : subSurface
                }`}
              >
                {recordingTarget === "chat" ? <Square size={16} /> : <Mic size={16} />}
              </button>
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSendChat();
                }}
                placeholder="Digite sua pergunta ou clique no microfone para falar..."
                data-testid="free-ai-chat-input"
                className={`flex-1 px-4 py-3 rounded-xl border text-xs sm:text-sm outline-none focus:border-[#7C3AED] ${subSurface}`}
              />
              <button
                type="button"
                onClick={() => handleSendChat()}
                disabled={chatLoading}
                data-testid="free-ai-chat-send"
                className="px-5 py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Send size={15} />
                <span>Enviar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUDIO TRANSCRIPTION (gemini-3.5-transcribe) */}
      {activeTab === "transcribe" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`lg:col-span-5 rounded-2xl border p-6 space-y-5 ${cardSurface}`}>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#7C3AED] dark:text-[#A78BFA]">
                Modelo Oficial: gemini-3.5-transcribe
              </span>
              <h2 className="text-lg font-bold">Transcricao de Audio Profissional</h2>
              <p className={`text-xs ${textMuted}`}>
                Ideal para gravar observacoes logo apos visitar um cliente na rua ou ditar os diferenciais da empresa
                para o Pacote GBP sem precisar digitar no celular.
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold block">Finalidade da Gravacao</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: "crm", label: "Notas p/ CRM" },
                  { id: "gbp", label: "Briefing GBP" },
                  { id: "search", label: "Busca Rapida" },
                ].map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    onClick={() => setTranscribeHint(h.id)}
                    className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                      transcribeHint === h.id
                        ? "border-[#7C3AED] bg-[#7C3AED] text-white"
                        : subSurface
                    }`}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2">
              {recordingTarget === "transcribe" ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  data-testid="stop-transcribe-btn"
                  className="w-full py-4 rounded-2xl bg-[#EF4444] text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md cursor-pointer"
                >
                  <Square size={18} />
                  <span>Parar Gravacao e Transcrever Agora</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startRecording("transcribe")}
                  disabled={transcribing}
                  data-testid="start-transcribe-btn"
                  className="w-full py-4 rounded-2xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white font-bold text-sm flex items-center justify-center gap-2.5 shadow-md cursor-pointer"
                >
                  <Mic size={18} />
                  <span>
                    {transcribing
                      ? "Transcrevendo com gemini-3.5-transcribe..."
                      : "Iniciar Gravacao pelo Microfone"}
                  </span>
                </button>
              )}
            </div>
          </div>

          <div className={`lg:col-span-7 rounded-2xl border p-6 flex flex-col justify-between space-y-4 ${cardSurface}`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">Texto Transcrito</h3>
                <button
                  type="button"
                  onClick={() => copyText("transcribed", transcribedText)}
                  disabled={!transcribedText}
                  className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${subSurface}`}
                >
                  {copiedKey === "transcribed" ? <Check size={13} /> : <Copy size={13} />}
                  <span>Copiar Texto</span>
                </button>
              </div>
              <textarea
                rows={7}
                value={transcribedText}
                onChange={(e) => setTranscribedText(e.target.value)}
                placeholder="O texto transcrito pelo modelo gratuito gemini-3.5-transcribe aparecera aqui..."
                data-testid="transcribed-textarea"
                className={`w-full p-4 rounded-xl border text-sm leading-relaxed outline-none focus:border-[#7C3AED] ${subSurface}`}
              />
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-inherit">
              {onOpenGbpPackage && (
                <button
                  type="button"
                  onClick={() => onOpenGbpPackage(biz)}
                  className="px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Layers size={14} />
                  <span>Usar no Pacote GBP</span>
                </button>
              )}
              {onOpenCrm && (
                <button
                  type="button"
                  onClick={onOpenCrm}
                  className={`px-4 py-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 cursor-pointer ${subSurface} hover:border-[#7C3AED]`}
                >
                  <Briefcase size={14} />
                  <span>Abrir Funil CRM</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LIVE VOICE CONVERSATION */}
      {activeTab === "voice" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={`lg:col-span-5 rounded-2xl border p-6 space-y-5 ${cardSurface}`}>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#34A853]">
                Conversa por Voz e Sintese Neural Gratuita
              </span>
              <h2 className="text-lg font-bold">Treinador e Assistente de Voz G360</h2>
              <p className={`text-xs ${textMuted}`}>
                Converse por voz em tempo real para tirar duvidas estrategicas ou treinar sua abordagem comercial antes
                de entrar no estabelecimento do cliente.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setVoiceMode("consultor")}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  voiceMode === "consultor"
                    ? "border-[#7C3AED] bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#EDE9FE]"
                    : subSurface
                }`}
              >
                <div className="text-xs font-bold">Modo Consultor G360</div>
                <div className={`text-[11px] mt-0.5 ${textMuted}`}>
                  Tire duvidas sobre o perfil de {biz.name}
                </div>
              </button>
              <button
                type="button"
                onClick={() => setVoiceMode("simulacao-cliente")}
                className={`p-3 rounded-xl border text-left cursor-pointer transition-all ${
                  voiceMode === "simulacao-cliente"
                    ? "border-[#7C3AED] bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#EDE9FE]"
                    : subSurface
                }`}
              >
                <div className="text-xs font-bold">Simulador de Cliente</div>
                <div className={`text-[11px] mt-0.5 ${textMuted}`}>
                  Treine contornar objecoes por voz
                </div>
              </button>
            </div>

            <div className="space-y-2">
              {recordingTarget === "voice" ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="w-full py-4 rounded-2xl bg-[#EF4444] text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Square size={18} />
                  <span>Parar Fala e Ouvir Resposta</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => startRecording("voice")}
                  disabled={voiceLoading}
                  data-testid="voice-talk-btn"
                  className="w-full py-4 rounded-2xl bg-[#10B981] hover:bg-[#059669] text-white font-bold text-sm flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  <Mic size={18} />
                  <span>
                    {voiceLoading ? "Sintetizando resposta..." : "Falar pelo Microfone Agora"}
                  </span>
                </button>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-inherit">
              <label className="text-xs font-semibold block">
                Ou envie uma fala rapida para ouvir em voz alta:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={voiceTextPrompt}
                  onChange={(e) => setVoiceTextPrompt(e.target.value)}
                  placeholder="Ex: Como explicar ao cliente que o perfil nao verificado perde vendas?"
                  className={`flex-1 px-3.5 py-2.5 rounded-xl border text-xs outline-none focus:border-[#7C3AED] ${subSurface}`}
                />
                <button
                  type="button"
                  onClick={() => handleVoiceConversationTurn("", "audio/webm", voiceTextPrompt)}
                  disabled={voiceLoading}
                  className="px-4 py-2.5 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold cursor-pointer shadow-sm"
                >
                  Ouvir
                </button>
              </div>
            </div>
          </div>

          <div className={`lg:col-span-7 rounded-2xl border p-6 space-y-4 ${cardSurface}`}>
            <h3 className="text-sm font-bold">Historico de Turnos de Voz</h3>
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
              {voiceTurns.map((t, i) => (
                <div key={i} className={`p-4 rounded-xl border space-y-2 ${subSurface}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#7C3AED] dark:text-[#A78BFA]">{t.speaker}</span>
                    <button
                      type="button"
                      onClick={() => speakTextInBrowser(t.spokenReply, t.audioDataUrl)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#7C3AED]/10 text-[#7C3AED] dark:text-[#A78BFA] text-[11px] font-semibold cursor-pointer"
                    >
                      <Volume2 size={13} /> Repetir Audio
                    </button>
                  </div>
                  <div className={`text-xs italic ${textMuted}`}>Voce disse: "{t.userTranscript}"</div>
                  <div className="text-xs sm:text-sm font-medium leading-relaxed">{t.spokenReply}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: GOOGLE MAPS & GOOGLE SEARCH GROUNDING */}
      {activeTab === "grounding" && (
        <div className="space-y-6">
          <div className={`rounded-2xl border p-5 flex flex-col sm:flex-row items-stretch sm:items-center gap-3 ${cardSurface}`}>
            <div className={`flex-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border ${subSurface}`}>
              <Search size={16} className="text-[#7C3AED]" />
              <input
                type="text"
                value={groundingQuery}
                onChange={(e) => setGroundingQuery(e.target.value)}
                placeholder="Ex: Sorveteria em Campo Grande MS"
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>
            <button
              type="button"
              onClick={handleRunGrounding}
              disabled={groundingLoading}
              data-testid="run-grounding-btn"
              className="px-6 py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 cursor-pointer shadow-sm"
            >
              <MapPin size={15} />
              <span>
                {groundingLoading
                  ? "Consultando Google Maps e Search..."
                  : "Consultar Dados Oficiais Maps + Search"}
              </span>
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`rounded-2xl border p-6 space-y-4 ${cardSurface}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-[#34A853]" />
                  <h3 className="text-base font-bold">Google Maps Grounding</h3>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#34A853]/15 text-[#34A853]">
                  Gratuito (gemini-3.8-flash)
                </span>
              </div>

              {mapsResult ? (
                <div className="space-y-4">
                  <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                    {mapsResult.text}
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-[#5F6368]">
                      Links Verificados no Google Maps
                    </div>
                    {(mapsResult.places || []).map((pl, idx) => (
                      <a
                        key={idx}
                        href={pl.uri}
                        target="_blank"
                        rel="noreferrer"
                        className={`block p-3 rounded-xl border hover:border-[#7C3AED] transition-colors ${subSurface}`}
                      >
                        <div className="text-xs font-bold text-[#7C3AED] dark:text-[#A78BFA] flex items-center justify-between">
                          <span>{pl.title}</span>
                          <ExternalLink size={13} />
                        </div>
                        {pl.snippets?.[0] && (
                          <div className={`text-[11px] mt-1 ${textMuted}`}>{pl.snippets[0]}</div>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <p className={`text-xs ${textMuted}`}>
                  Clique em "Consultar Dados Oficiais Maps + Search" acima para extrair inteligencia geografica e links
                  diretos do Google Maps para {biz.name}.
                </p>
              )}
            </div>

            <div className={`rounded-2xl border p-6 space-y-4 ${cardSurface}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Search size={18} className="text-[#7C3AED] dark:text-[#A78BFA]" />
                  <h3 className="text-base font-bold">Google Search Grounding</h3>
                </div>
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#7C3AED]/15 text-[#7C3AED] dark:text-[#A78BFA]">
                  Gratuito (gemini-3.8-flash)
                </span>
              </div>

              {searchResult ? (
                <div className="space-y-4">
                  <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed">
                    {searchResult.text}
                  </div>
                  <div className="space-y-2">
                    <div className={`text-xs font-bold uppercase tracking-wider ${textMuted}`}>
                      Fontes da Pesquisa Google
                    </div>
                    {(searchResult.sources || []).map((src, idx) => (
                      <a
                        key={idx}
                        href={src.uri}
                        target="_blank"
                        rel="noreferrer"
                        className={`flex items-center justify-between p-3 rounded-xl border hover:border-[#7C3AED] transition-colors text-xs font-semibold text-[#7C3AED] dark:text-[#A78BFA] ${subSurface}`}
                      >
                        <span>{src.title}</span>
                        <ExternalLink size={13} />
                      </a>
                    ))}
                  </div>
                </div>
              ) : (
                <p className={`text-xs ${textMuted}`}>
                  Extraia os termos mais pesquisados pelos clientes na regiao de {biz.city} e meta tags SEO prontas para
                  o Site Express.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: FREE IMAGE & VIDEO STUDIO */}
      {activeTab === "media" && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Image Generator & Editor */}
          <div className={`rounded-2xl border p-6 space-y-4 ${cardSurface}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon size={18} className="text-[#7C3AED] dark:text-[#A78BFA]" />
                <h3 className="text-base font-bold">Criador e Editor de Imagens (Direção Prompt Mestre)</h3>
              </div>
              <button
                type="button"
                data-testid="free-ai-copy-master-prompt-btn"
                onClick={() => {
                  const md = buildMasterImagePromptMarkdown(biz);
                  copyText("master-img-md", md);
                }}
                className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#7C3AED]/15 text-[#7C3AED] dark:text-[#A78BFA] hover:bg-[#7C3AED] hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <Copy size={12} />
                <span>{copiedKey === "master-img-md" ? "Prompt Mestre Copiado!" : "Copiar Prompt Mestre"}</span>
              </button>
            </div>

            {/* Quick Slot Selector from Master Image Planning Table */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold block">
                Carregar Direção Oficial por Slot do Site Express ({biz.name})
              </label>
              <div className="flex flex-wrap gap-1.5">
                {buildSiteImagePlanningTable(biz)
                  .slice(0, 6)
                  .map((slot) => (
                    <button
                      key={slot.filename}
                      type="button"
                      onClick={() => {
                        setImgPrompt(slot.individualPrompt);
                        setImgAspect(slot.aspectRatio);
                        toast.info(`Direção carregada: ${slot.filename} (${slot.aspectRatio})`);
                      }}
                      className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono font-semibold hover:border-[#7C3AED] cursor-pointer ${subSurface}`}
                    >
                      {slot.filename} ({slot.aspectRatio})
                    </button>
                  ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold block">
                Comando Visual da Fotografia Comercial (Sem Textos Sobrepostos)
              </label>
              <textarea
                rows={3}
                value={imgPrompt}
                onChange={(e) => setImgPrompt(e.target.value)}
                className={`w-full p-3 rounded-xl border text-xs outline-none focus:border-[#7C3AED] ${subSurface}`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                {["16:9", "1:1", "4:3", "3:4", "9:16"].map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => setImgAspect(ar)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                      imgAspect === ar ? "bg-[#7C3AED] text-white border-[#7C3AED]" : subSurface
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>

              <label className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 cursor-pointer ${subSurface} hover:border-[#7C3AED]`}>
                <Upload size={13} />
                <span>{uploadedBase64 ? "Foto Real Carregada" : "Subir Foto Real p/ Aprimorar"}</span>
                <input type="file" accept="image/*" onChange={handleUploadRefImage} className="hidden" />
              </label>
            </div>

            <button
              type="button"
              onClick={handleGenerateOrEditImage}
              disabled={imgLoading}
              data-testid="generate-free-image-btn"
              className="w-full py-3 rounded-xl bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs sm:text-sm font-bold cursor-pointer shadow-sm"
            >
              {imgLoading
                ? "Processando Fotografia Comercial..."
                : uploadedBase64
                ? "Aprimorar Foto Real (Sem Textos Sobrepostos)"
                : "Gerar Fotografia Comercial Agora"}
            </button>

            {generatedImageUrl && (
              <div className="space-y-2 pt-2">
                <img
                  src={generatedImageUrl}
                  alt="Arte gerada"
                  className="w-full max-h-64 object-cover rounded-xl border border-slate-200/80 dark:border-white/[0.08]"
                />
                <a
                  href={generatedImageUrl}
                  download={`g360-arte-${biz.name.toLowerCase().replace(/\s+/g, "-")}.svg`}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7C3AED] dark:text-[#A78BFA] hover:underline"
                >
                  <Download size={13} /> Baixar Imagem para Google Meu Negocio
                </a>
              </div>
            )}
          </div>

          {/* Video Generator & Image Animator */}
          <div className={`rounded-2xl border p-6 space-y-4 ${cardSurface}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Video size={18} className="text-[#10B981]" />
                <h3 className="text-base font-bold">Gerador de Video e Animacao de Imagens</h3>
              </div>
              <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-[#10B981]/15 text-[#10B981]">
                Texto ou Foto p/ Video
              </span>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold block">Roteiro / Movimento do Video</label>
              <textarea
                rows={3}
                value={vidPrompt}
                onChange={(e) => setVidPrompt(e.target.value)}
                className={`w-full p-3 rounded-xl border text-xs outline-none focus:border-[#7C3AED] ${subSurface}`}
              />
            </div>

            <div className="flex items-center gap-2">
              {["16:9", "9:16"].map((ar) => (
                <button
                  key={ar}
                  type="button"
                  onClick={() => setVidAspect(ar)}
                  className={`px-3 py-1.5 rounded-lg border text-xs font-semibold cursor-pointer transition-all ${
                    vidAspect === ar ? "bg-[#7C3AED] text-white border-[#7C3AED]" : subSurface
                  }`}
                >
                  Formato {ar}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleGenerateOrAnimateVideo}
              disabled={vidLoading}
              data-testid="generate-free-video-btn"
              className="w-full py-3 rounded-xl bg-[#10B981] hover:bg-[#059669] text-white text-xs sm:text-sm font-bold cursor-pointer shadow-sm"
            >
              {vidLoading
                ? "Renderizando Video..."
                : uploadedBase64 || generatedImageUrl
                ? "Animar Imagem em Video Promocional"
                : "Gerar Video a partir do Texto"}
            </button>

            <div className="space-y-2 pt-2">
              <canvas
                ref={canvasRef}
                className={`w-full rounded-xl border border-slate-200/80 dark:border-white/[0.08] ${videoMeta ? "block" : "hidden"}`}
              />
              {recordedVideoUrl && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs font-semibold text-[#10B981]">
                    Video pronto para publicacao!
                  </span>
                  <a
                    href={recordedVideoUrl}
                    download={`g360-video-${biz.name.toLowerCase().replace(/\s+/g, "-")}.webm`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#7C3AED] dark:text-[#A78BFA] hover:underline"
                  >
                    <Download size={13} /> Baixar Video (.webm)
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
