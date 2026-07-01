/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Brain, 
  History, 
  Download, 
  Copy, 
  Trash2, 
  ChevronRight,
  Sparkles,
  BookOpen,
  Video,
  Play,
  Pause,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  X,
  Check,
  Plus,
  Edit,
  Globe,
  Tag,
  Settings,
  Filter,
  Languages,
  MessageSquareQuote,
  Layout,
  Smartphone
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Inspiration, GeneratedScript, View, VideoProject, LanguagePattern } from './types';
import { INITIAL_INSPIRATIONS, NICHES } from './constants';
import { generateScriptAI, analyzeScriptForVideo, analyzeScriptForClassification, generateSEOMetadata } from './services/geminiService';
import { generateSRT, downloadFile } from './lib/utils';
import { auth, db, signIn, signOut, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  query, 
  serverTimestamp, 
  setDoc,
  getDocFromServer
} from 'firebase/firestore';

const ADMIN_EMAIL = "paiemae269@gmail.com";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [globalInspirations, setGlobalInspirations] = useState<Inspiration[]>([]);
  const [globalLanguagePatterns, setGlobalLanguagePatterns] = useState<LanguagePattern[]>([]);
  const [globalHistory, setGlobalHistory] = useState<GeneratedScript[]>([]);
  const [view, setView] = useState<View>('generator');

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAdmin(u?.email === ADMIN_EMAIL && u?.emailVerified);
    });
    return () => unsub();
  }, []);

  // Sync Global Inspirations
  useEffect(() => {
    const q = query(collection(db, 'inspirations'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        isGlobal: true
      } as Inspiration));
      setGlobalInspirations(docs);
    }, (error) => {
      console.warn("Sem acesso às inspirações globais (Visualização restrita):", error.message);
    });
    return () => unsub();
  }, []);

  // Test Connection
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Sync Global Language Patterns
  useEffect(() => {
    const q = query(collection(db, 'language_patterns'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        isGlobal: true
      } as LanguagePattern));
      setGlobalLanguagePatterns(docs);
    }, (error) => {
      console.warn("Sem acesso aos padrões de linguagem globais:", error.message);
    });
    return () => unsub();
  }, []);

  // Sync Global History (Roteiros Globais)
  useEffect(() => {
    const q = query(collection(db, 'global_history'));
    const unsub = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        ...doc.data(),
        id: doc.id,
        isGlobal: true
      } as any));
      setGlobalHistory(docs);
    }, (error) => {
      console.warn("Sem acesso ao histórico global:", error.message);
    });
    return () => unsub();
  }, []);
  const [inspirations, setInspirations] = useState<Inspiration[]>(() => {
    const saved = localStorage.getItem('psycho_inspirations');
    // Don't merge INITIAL_INSPIRATIONS here if we want a clean start, 
    // but the user might want them. Let's keep them as default local for now.
    return saved ? JSON.parse(saved) : INITIAL_INSPIRATIONS;
  });

  const [languagePatterns, setLanguagePatterns] = useState<LanguagePattern[]>(() => {
    const saved = localStorage.getItem('psycho_language_patterns');
    return saved ? JSON.parse(saved) : [];
  });

  const allInspirations = [...globalInspirations, ...inspirations];
  const allLanguagePatterns = [...globalLanguagePatterns, ...languagePatterns];

  const [history, setHistory] = useState<GeneratedScript[]>(() => {
    const saved = localStorage.getItem('psycho_history');
    return saved ? JSON.parse(saved) : [];
  });

  const [studioProjects, setStudioProjects] = useState<VideoProject[]>(() => {
    const saved = localStorage.getItem('psycho_studio');
    return saved ? JSON.parse(saved) : [];
  });

  const [seoHistory, setSeoHistory] = useState<any[]>(() => {
    const saved = localStorage.getItem('psycho_seo');
    return saved ? JSON.parse(saved) : [];
  });

  const [loading, setLoading] = useState(false);
  const [saveToGlobalHistory, setSaveToGlobalHistory] = useState(false);
  const [currentScript, setCurrentScript] = useState<GeneratedScript | null>(null);
  
  // Niche State
  const [availableNiches, setAvailableNiches] = useState<string[]>(() => {
    const saved = localStorage.getItem('psycho_niches');
    return saved ? JSON.parse(saved) : NICHES;
  });
  const [activeNicheIndex, setActiveNicheIndex] = useState(0);
  const [isAddingNiche, setIsAddingNiche] = useState(false);
  const [newNicheName, setNewNicheName] = useState('');

  // Form State
  const [idea, setIdea] = useState('');
  const [niche, setNiche] = useState(availableNiches[0] || 'Geral');
  const [wordCount, setWordCount] = useState<number | 'manual'>(500);
  const [scriptFormat, setScriptFormat] = useState<'16:9' | '9:16'>('16:9');
  const [selectedStyle, setSelectedStyle] = useState('Curiosidade');
  const [advancedViralMode, setAdvancedViralMode] = useState(false);
  const [targetLanguage, setTargetLanguage] = useState<'pt' | 'es'>('pt');
  const [imageStyle, setImageStyle] = useState<'A' | 'B' | 'C'>(() => (localStorage.getItem('studio_image_style') as any) || 'A');

  useEffect(() => {
    localStorage.setItem('studio_image_style', imageStyle);
  }, [imageStyle]);

  const CONTENT_STYLES = ['Polêmico', 'Motivacional', 'Curiosidade', 'Dark', 'Educativo', 'Papo de Bar'];

  const nicheScriptCount = allInspirations.filter(i => i.niche === niche).length;

  // Sync User Data (Niches, History, Studio, Private Inspirations)
  useEffect(() => {
    if (!user) {
      // Restore from localStorage if logged out
      const savedNiches = localStorage.getItem('psycho_niches');
      if (savedNiches) setAvailableNiches(JSON.parse(savedNiches));
      
      const savedHistory = localStorage.getItem('psycho_history');
      if (savedHistory) setHistory(JSON.parse(savedHistory));

      const savedStudio = localStorage.getItem('psycho_studio');
      if (savedStudio) setStudioProjects(JSON.parse(savedStudio));

      const savedInspirations = localStorage.getItem('psycho_inspirations');
      if (savedInspirations) setInspirations(JSON.parse(savedInspirations));

      const savedPatterns = localStorage.getItem('psycho_language_patterns');
      if (savedPatterns) setLanguagePatterns(JSON.parse(savedPatterns));

      return;
    }

    // Niches Listener
    const nichesRef = doc(db, 'users', user.uid, 'niches', 'main');
    const unsubNiches = onSnapshot(nichesRef, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAvailableNiches(data.niches);
        if (data.activeIndex !== undefined) setActiveNicheIndex(data.activeIndex);
      } else {
        // First sync: Upload local niches
        setDoc(nichesRef, { niches: availableNiches, activeIndex: activeNicheIndex });
      }
    });

    // History Listener
    const qHistory = query(collection(db, 'users', user.uid, 'history'));
    const unsubHistory = onSnapshot(qHistory, (snap) => {
      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id } as GeneratedScript));
      setHistory(docs.sort((a,b) => b.createdAt - a.createdAt));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/history`);
    });

    // Studio Listener
    const qStudio = query(collection(db, 'users', user.uid, 'studio'));
    const unsubStudio = onSnapshot(qStudio, (snap) => {
      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id } as VideoProject));
      setStudioProjects(docs.sort((a,b) => b.updatedAt - a.updatedAt));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/studio`);
    });

    // Private Inspirations Listener
    const qInspirations = query(collection(db, 'users', user.uid, 'inspirations'));
    const unsubInspirations = onSnapshot(qInspirations, (snap) => {
      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id, isGlobal: false } as Inspiration));
      setInspirations(docs.sort((a,b) => b.createdAt - a.createdAt));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/inspirations`);
    });

    // Language Patterns Listener
    const qPatterns = query(collection(db, 'users', user.uid, 'language_patterns'));
    const unsubPatterns = onSnapshot(qPatterns, (snap) => {
      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id, isGlobal: false } as LanguagePattern));
      setLanguagePatterns(docs.sort((a,b) => b.createdAt - a.createdAt));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/language_patterns`);
    });

    return () => {
      unsubNiches();
      unsubHistory();
      unsubStudio();
      unsubInspirations();
      unsubPatterns();
    };
  }, [user]);

  // Sync SEO Listener
  useEffect(() => {
    if (!user) return;
    const qSeo = query(collection(db, 'users', user.uid, 'seo'));
    const unsubSeo = onSnapshot(qSeo, (snap) => {
      const docs = snap.docs.map(d => ({ ...d.data(), id: d.id } as any));
      setSeoHistory(docs.sort((a,b) => (b.createdAt || 0) - (a.createdAt || 0)));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${user.uid}/seo`);
    });
    return () => unsubSeo();
  }, [user]);

  // 1. Unified state for localStorage and Firestore sync
  useEffect(() => {
    localStorage.setItem('psycho_niches', JSON.stringify(availableNiches));
    localStorage.setItem('psycho_active_niche_index', JSON.stringify(activeNicheIndex));
    localStorage.setItem('psycho_history', JSON.stringify(history));
    localStorage.setItem('psycho_studio', JSON.stringify(studioProjects));
    localStorage.setItem('psycho_inspirations', JSON.stringify(inspirations));
    localStorage.setItem('psycho_language_patterns', JSON.stringify(languagePatterns));
    localStorage.setItem('psycho_seo', JSON.stringify(seoHistory));
    
    // Sync Studio Preferences
    localStorage.setItem('studio_prefs', JSON.stringify({
      assetType: localStorage.getItem('studio_asset_type'),
      imageSource: localStorage.getItem('studio_img_source'),
      imageModel: localStorage.getItem('studio_img_model'),
      pixabayKey: localStorage.getItem('pixabay_api_key'),
      pexelsKey: localStorage.getItem('pexels_api_key')
    }));
  }, [availableNiches, activeNicheIndex, history, studioProjects, inspirations, languagePatterns]);

  const switchNiche = async (index: number) => {
    setActiveNicheIndex(index);
    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'niches', 'main'), { 
          niches: availableNiches, 
          activeIndex: index 
        }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/niches/main`);
      }
    }
  };

  const deleteNiche = async (index: number) => {
    if (availableNiches.length <= 1) {
      alert("Você precisa de pelo menos um nicho.");
      return;
    }
    const updated = availableNiches.filter((_, i) => i !== index);
    const newIndex = Math.max(0, activeNicheIndex >= updated.length ? updated.length - 1 : (activeNicheIndex > index ? activeNicheIndex - 1 : activeNicheIndex));
    
    // UI Local update
    setAvailableNiches(updated);
    setActiveNicheIndex(newIndex);

    if (user) {
      try {
        await setDoc(doc(db, 'users', user.uid, 'niches', 'main'), { 
          niches: updated, 
          activeIndex: newIndex 
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/niches/main`);
      }
    }
  };

  // Just use niche state
  useEffect(() => {
    setNiche(availableNiches[activeNicheIndex] || 'Geral');
  }, [activeNicheIndex, availableNiches]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const script = await generateScriptAI(
        idea, 
        niche, 
        wordCount, 
        scriptFormat, 
        allInspirations, 
        allLanguagePatterns,
        selectedStyle,
        advancedViralMode,
        targetLanguage,
        imageStyle
      );
      
      if (user) {
        // Quando logado, o onSnapshot cuidará de atualizar o history via setHistory
        await setDoc(doc(db, 'users', user.uid, 'history', script.id), script);

        // Se marcado para salvar no global e for admin
        if (saveToGlobalHistory && isAdmin) {
          await setDoc(doc(db, 'global_history', script.id), { ...script, isGlobal: true });
        }
      } else {
        // Apenas em modo visitante atualizamos o estado local diretamente
        setHistory(prev => {
          const updated = [script, ...prev];
          localStorage.setItem('psycho_history', JSON.stringify(updated));
          return updated;
        });
      }
      
      setCurrentScript(script);
      setSaveToGlobalHistory(false); // Reset
      setView('generator');
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Erro desconhecido";
      alert(`Erro ao gerar roteiro:\n${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteInspiration = async (id: string, isGlobal?: boolean) => {
    console.log(`[OPERACIONAL] Solicitando exclusão da inspiração: ${id}`);
    
    // 1. Limpeza Imediata da UI
    if (isGlobal) {
      setGlobalInspirations(prev => prev.filter(i => i.id !== id));
    } else {
      setInspirations(prev => {
        const filtered = prev.filter(i => i.id !== id);
        localStorage.setItem('psycho_inspirations', JSON.stringify(filtered));
        return filtered;
      });
    }

    // 2. Persistência no Banco de Dados
    if (isGlobal) {
      if (!isAdmin) return; 
      try {
        await deleteDoc(doc(db, 'inspirations', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `inspirations/${id}`);
      }
    } else if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'inspirations', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/inspirations/${id}`);
      }
    }
  };

  const deleteScript = async (id: string, isGlobal?: boolean) => {
    console.log(`[OPERACIONAL] Solicitando exclusão do roteiro: ${id}`);
    
    // 1. Limpeza Imediata da UI e Cache
    if (isGlobal) {
      setGlobalHistory(prev => prev.filter(s => s.id !== id));
    } else {
      setHistory(prev => {
        const filtered = prev.filter(s => s.id !== id);
        localStorage.setItem('psycho_history', JSON.stringify(filtered));
        return filtered;
      });
    }
    
    // Fechar preview se for o roteiro aberto
    if (currentScript?.id === id) {
      setCurrentScript(null);
    }

    // 2. Persistência no Banco de Dados
    if (isGlobal) {
      if (!isAdmin) return;
      try {
        await deleteDoc(doc(db, 'global_history', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `global_history/${id}`);
      }
    } else if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'history', id));
        console.log(`[SUCESSO] Roteiro ${id} removido do servidor.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/history/${id}`);
      }
    }
  };

  const deleteStudioProject = async (id: string) => {
    console.log(`[OPERACIONAL] Solicitando exclusão do projeto studio: ${id}`);
    
    // 1. Limpeza Imediata da UI e Cache
    setStudioProjects(prev => {
      const filtered = prev.filter(p => p.id !== id);
      localStorage.setItem('psycho_studio', JSON.stringify(filtered));
      return filtered;
    });

    // 2. Persistência no Banco de Dados
    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'studio', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/studio/${id}`);
      }
    }
  };

  const deleteSeo = async (id: string) => {
    setSeoHistory(prev => {
      const filtered = prev.filter(s => s.id !== id);
      localStorage.setItem('psycho_seo', JSON.stringify(filtered));
      return filtered;
    });

    if (user) {
      try {
        await deleteDoc(doc(db, 'users', user.uid, 'seo', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/seo/${id}`);
      }
    }
  };


  const handleAddNiche = async () => {
    if (!newNicheName.trim()) return;
    if (availableNiches.includes(newNicheName.trim())) {
      alert("Este nicho já existe.");
      return;
    }
    const updated = [...availableNiches, newNicheName.trim()];
    const newIndex = updated.length - 1;
    
    // UI Local update
    setAvailableNiches(updated);
    setActiveNicheIndex(newIndex);
    setNewNicheName('');
    setIsAddingNiche(false);

    // Sync remote
    if (user) {
      try {
        const nichesRef = doc(db, 'users', user.uid, 'niches', 'main');
        await setDoc(nichesRef, { 
          niches: updated, 
          activeIndex: newIndex 
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/niches/main`);
      }
    }
  };

  const addInspiration = async (newInp: Omit<Inspiration, 'id' | 'createdAt'>, saveGlobal?: boolean) => {
    if (saveGlobal) {
      if (!isAdmin) {
        alert("Apenas administradores podem salvar na base global.");
        return;
      }
      try {
        const id = crypto.randomUUID();
        const path = `inspirations/${id}`;
        await setDoc(doc(db, path), {
          ...newInp,
          id,
          createdAt: Date.now(),
          isGlobal: true
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'inspirations');
      }
    } else if (user) {
      try {
        const id = crypto.randomUUID();
        const path = `users/${user.uid}/inspirations/${id}`;
        await setDoc(doc(db, path), {
          ...newInp,
          id,
          createdAt: Date.now(),
          isGlobal: false
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/inspirations`);
      }
    } else {
      const inp: Inspiration = {
        ...newInp,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        isGlobal: false
      };
      setInspirations(prev => [inp, ...prev]);
    }
  };

  const addLanguagePattern = async (newPat: Omit<LanguagePattern, 'id' | 'createdAt'>, saveGlobal?: boolean) => {
    if (saveGlobal) {
      if (!isAdmin) {
        alert("Apenas administradores podem salvar na base global.");
        return;
      }
      try {
        const id = crypto.randomUUID();
        const path = `language_patterns/${id}`;
        await setDoc(doc(db, path), {
          ...newPat,
          id,
          createdAt: Date.now(),
          isGlobal: true
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, 'language_patterns');
      }
    } else if (user) {
      try {
        const id = crypto.randomUUID();
        const path = `users/${user.uid}/language_patterns/${id}`;
        await setDoc(doc(db, path), {
          ...newPat,
          id,
          createdAt: Date.now(),
          isGlobal: false
        });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${user.uid}/language_patterns`);
      }
    } else {
      const pat: LanguagePattern = {
        ...newPat,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        isGlobal: false
      };
      setLanguagePatterns(prev => [pat, ...prev]);
    }
  };

  const deleteLanguagePattern = async (id: string, isGlobal?: boolean) => {
    if (isGlobal) {
      setGlobalLanguagePatterns(prev => prev.filter(p => p.id !== id));
      if (!isAdmin) return;
      try {
        await deleteDoc(doc(db, 'language_patterns', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `language_patterns/${id}`);
      }
    } else {
      setLanguagePatterns(prev => {
        const filtered = prev.filter(p => p.id !== id);
        localStorage.setItem('psycho_language_patterns', JSON.stringify(filtered));
        return filtered;
      });
      if (user) {
        try {
          await deleteDoc(doc(db, 'users', user.uid, 'language_patterns', id));
        } catch (error) {
          handleFirestoreError(error, OperationType.DELETE, `users/${user.uid}/language_patterns/${id}`);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Sidebar */}
      <aside className="fixed left-0 top-0 h-full w-64 glass border-r border-slate-700/30 p-4 z-50 hidden lg:flex flex-col gap-4">
        <div className="p-4 glass rounded-2xl flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/10">
            Ψ
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight text-white uppercase tracking-tight">ViralEngine v3.1</h1>
            <p className="text-[10px] text-slate-400">Retenção & Conexão Humana</p>
            <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1 rounded font-bold uppercase tracking-widest">Otimizado ✅</span>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          <NavItem active={view === 'generator'} onClick={() => setView('generator')} icon={<Sparkles size={18} />} label="Criador de Roteiros" />
          <NavItem active={view === 'studio'} onClick={() => setView('studio')} icon={<Video size={18} />} label="Estúdio de Vídeo v2.1" />
          <NavItem active={view === 'seo'} onClick={() => setView('seo')} icon={<Tag size={18} />} label="SEO Studio v2.1" />
          <NavItem active={view === 'history'} onClick={() => setView('history')} icon={<History size={18} />} label="Histórico de Projetos" count={history.length} />
          <NavItem active={view === 'training'} onClick={() => setView('training')} icon={<BookOpen size={18} />} label="Base de Treino v2.1" />
          <NavItem active={view === 'language_training'} onClick={() => setView('language_training')} icon={<Languages size={18} />} label="Linguagem v2.1" />
        </nav>

        <div className="mt-4 p-4 border-t border-slate-700/30">
          {!user ? (
            <div className="flex flex-col gap-3">
              <p className="text-[9px] text-slate-500 text-center italic uppercase tracking-widest leading-relaxed">
                Modo Visitante: Dados Locais.<br/>Faça Login para Sincronizar Tudo.
              </p>
              <button 
                onClick={signIn}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] font-bold text-white uppercase flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-600/20"
              >
                <Globe size={14} /> Sincronizar Cloud v2.1
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2 px-2">
                <div className="w-6 h-6 bg-indigo-500 rounded-full flex items-center justify-center text-[10px] font-bold">
                  {user.email?.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 overflow-hidden">
                  <p className="text-[10px] font-bold text-slate-200 truncate">{user.email}</p>
                  <p className="text-[8px] text-indigo-400 uppercase font-bold tracking-widest">
                    {isAdmin ? "Administrador" : "Visitante"}
                  </p>
                </div>
              </div>
              <button 
                onClick={signOut}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[9px] font-bold text-slate-400 uppercase"
              >
                Sair
              </button>
            </div>
          )}
        </div>

        <div className="mt-auto glass p-4 rounded-2xl">
          <h3 className="text-[10px] uppercase tracking-wider text-slate-500 font-bold mb-3">Inspirado por:</h3>
          <div className="flex flex-col gap-2">
            <div className="text-[11px] p-2 bg-slate-800/50 rounded-lg border border-slate-700 text-slate-400 truncate">"O Poder da Persuasão"</div>
            <div className="text-[11px] p-2 bg-slate-800/50 rounded-lg border border-slate-700 text-slate-400 truncate">"Efeito Espectador"</div>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="lg:ml-64 min-h-screen p-4 lg:p-6 pb-24 lg:pb-6 flex flex-col">
        <AnimatePresence mode="wait">
          {view === 'generator' && (
            <motion.div 
              key="generator"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col lg:flex-row gap-4 h-full"
            >
              {!currentScript ? (
                <div className="flex-1 flex flex-col lg:flex-row gap-4 w-full lg:h-[calc(100vh-3rem)]">
                  <section className="w-full lg:w-1/3 flex flex-col gap-4 overflow-y-auto lg:scrollbar-hide">
                    <div className="glass p-5 rounded-2xl flex flex-col gap-4">
                      <h2 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
                        <Sparkles size={16} />
                        Configuração do Roteiro
                      </h2>
                      
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-[10px] text-slate-400 block uppercase tracking-wider font-bold">Nicho Ativo</label>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-bold text-indigo-400/70 uppercase">
                              {nicheScriptCount} treinos sincronizados
                            </span>
                            <button 
                              onClick={() => setIsAddingNiche(!isAddingNiche)}
                              className="text-indigo-400 hover:text-white p-1 rounded-md bg-indigo-500/10 transition-colors"
                              title="Gerenciar Nichos"
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                        
                        {isAddingNiche ? (
                          <div className="flex gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                            <input 
                              autoFocus
                              value={newNicheName}
                              onChange={(e) => setNewNicheName(e.target.value)}
                              onKeyDown={(e) => { if(e.key === 'Enter') handleAddNiche(); if(e.key === 'Escape') setIsAddingNiche(false); }}
                              className="flex-1 p-2.5 bg-slate-950 border border-indigo-500/50 rounded-lg text-sm outline-none focus:ring-1 focus:ring-indigo-500/50"
                              placeholder="Novo nicho..."
                            />
                            <button 
                              onClick={handleAddNiche} 
                              className="px-3 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[10px] font-bold text-white transition-all shadow-lg shadow-indigo-600/20"
                            >
                              ADD
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <div className="relative group/niche flex-1">
                              <select 
                                value={activeNicheIndex}
                                onChange={(e) => switchNiche(Number(e.target.value))}
                                className="w-full appearance-none p-2.5 bg-slate-950/50 rounded-lg border border-slate-700/50 text-sm focus:border-indigo-500/50 outline-none cursor-pointer hover:bg-slate-900/50 transition-all font-medium text-slate-200"
                              >
                                {availableNiches.map((n, idx) => (
                                  <option key={idx} value={idx} className="bg-slate-950">{n}</option>
                                ))}
                              </select>
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                                 <ChevronRight className="rotate-90" size={12} />
                              </div>
                            </div>
                            {availableNiches.length > 1 && (
                              <ConfirmButton 
                                onConfirm={() => deleteNiche(activeNicheIndex)}
                                icon={Trash2}
                                className="p-2.5 text-rose-500 bg-rose-500/10 rounded-lg border border-rose-500/20 flex items-center justify-center min-w-[44px] min-h-[44px] shadow-lg"
                                label=""
                                confirmText="Excluir nicho?"
                              />
                            )}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 mb-1 block uppercase tracking-wider font-bold">Sua Ideia ou Tema Central</label>
                        <textarea 
                          value={idea}
                          onChange={(e) => setIdea(e.target.value)}
                          placeholder="Ex: Como a psicologia reversa funciona no ambiente de trabalho..."
                          className="w-full h-32 p-3 bg-slate-950 rounded-lg border border-slate-700 text-sm focus:border-indigo-500/50 outline-none resize-none transition-all placeholder:text-slate-600"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 mb-2 block uppercase tracking-wider font-bold">Formato do Vídeo</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: '16:9', label: 'Longo (16:9)', icon: <Layout size={14} /> },
                            { id: '9:16', label: 'Curto (9:16)', icon: <Smartphone size={14} /> }
                          ].map((f) => (
                            <button
                              key={f.id}
                              onClick={() => {
                                setScriptFormat(f.id as any);
                                if (f.id === '9:16' && wordCount === 500) setWordCount(150);
                                if (f.id === '16:9' && wordCount === 150) setWordCount(500);
                              }}
                              className={`py-3 flex items-center justify-center gap-2 text-[11px] rounded-lg border font-bold transition-all ${scriptFormat === f.id ? 'bg-indigo-900/50 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                            >
                              {f.icon}
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 mb-2 block uppercase tracking-wider font-bold">Idioma do Roteiro</label>
                        <div className="grid grid-cols-2 gap-2">
                          {[
                            { id: 'pt', label: 'Português', icon: <Languages size={14} /> },
                            { id: 'es', label: 'Espanhol', icon: <Languages size={14} /> }
                          ].map((f) => (
                            <button
                              key={f.id}
                              onClick={() => setTargetLanguage(f.id as any)}
                              className={`py-3 flex items-center justify-center gap-2 text-[11px] rounded-lg border font-bold transition-all ${targetLanguage === f.id ? 'bg-indigo-900/50 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                            >
                              {f.icon}
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 mb-2 block uppercase tracking-wider font-bold">Extensão do Roteiro</label>
                        <div className="grid grid-cols-4 gap-2">
                          {[500, 1000, 2500, 'manual'].map((v) => {
                            const isActive = v === 'manual' 
                              ? (wordCount === 'manual' || (typeof wordCount === 'number' && ![500, 1000, 2500].includes(wordCount)))
                              : wordCount === v;
                            
                            return (
                              <button
                                key={v}
                                onClick={() => setWordCount(v as any)}
                                className={`py-3 sm:py-2 text-[11px] rounded-lg border font-bold transition-all ${isActive ? 'bg-indigo-900/50 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                              >
                                {v === 'manual' ? 'Manual' : `${v} Pal.`}
                              </button>
                            );
                          })}
                        </div>
                        {(wordCount === 'manual' || (typeof wordCount === 'number' && ![500, 1000, 2500].includes(wordCount))) && (
                          <div className="mt-3 flex flex-col gap-2 p-3 bg-slate-900/50 border border-slate-800 rounded-xl animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] text-slate-500 font-bold uppercase whitespace-nowrap">Qtd. de Palavras:</span>
                              <input 
                                type="number" 
                                placeholder="Ex: 2500"
                                value={typeof wordCount === 'number' ? wordCount : ''}
                                onChange={(e) => {
                                  const val = parseInt(e.target.value);
                                  setWordCount(isNaN(val) ? 'manual' : val);
                                }}
                                className="w-full bg-transparent text-white text-sm font-bold outline-none border-b border-indigo-500/30 focus:border-indigo-500 pb-1"
                                autoFocus
                              />
                            </div>
                            <p className="text-[9px] text-indigo-400/60 italic leading-tight">
                              Dica: 2500 palavras resultam em aproximadamente 15.000 caracteres.
                            </p>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-[10px] text-slate-400 mb-2 block uppercase tracking-wider font-bold">Estilo de Conteúdo</label>
                        <div className="grid grid-cols-3 gap-2">
                          {CONTENT_STYLES.map((s) => (
                            <button
                              key={s}
                              onClick={() => setSelectedStyle(s)}
                              className={`py-2 px-1 text-[9px] rounded-lg border font-bold transition-all ${selectedStyle === s ? 'bg-indigo-900/50 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-3">
                        <label className="text-[10px] text-indigo-400 block uppercase tracking-wider font-bold">
                          Estilo de Consistência das Imagens
                        </label>
                        <p className="text-[9px] text-slate-500 uppercase font-semibold leading-tight mb-1">
                          Selecione o estilo visual travado para todas as cenas:
                        </p>
                        <div className="grid grid-cols-1 gap-2">
                          {[
                            {
                              id: 'A',
                              title: 'Opção A: Cartoon 2D Vetorial',
                              desc: 'Formas geométricas limpas, cores vibrantes, perfeito para canais de curiosidades rápidas.'
                            },
                            {
                              id: 'B',
                              title: 'Opção B: Cartoon 3D Volumétrico (Pixar)',
                              desc: 'Estilo Disney Pixar, relevo de massinha, render amigável, ótima retenção infantil/jovem.'
                            },
                            {
                              id: 'C',
                              title: 'Opção C: Ilustração Infantil Flat',
                              desc: 'Texturas sutis de giz/acrílico, tons pastéis, ideal para fábulas e storytelling emotivo.'
                            }
                          ].map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() => setImageStyle(opt.id as any)}
                              className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${imageStyle === opt.id ? 'bg-indigo-950/40 border-indigo-500/80 text-white shadow-lg' : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                            >
                              <div className="flex items-center justify-between">
                                <span className={`text-[10px] font-bold ${imageStyle === opt.id ? 'text-indigo-400' : 'text-slate-300'}`}>
                                  {opt.title}
                                </span>
                                <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${imageStyle === opt.id ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-600'}`}>
                                  {imageStyle === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                                </div>
                              </div>
                              <span className="text-[8.5px] leading-relaxed text-slate-500 font-medium">
                                {opt.desc}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-rose-500/5 rounded-xl border border-rose-500/10">
                        <div className="flex items-center gap-3">
                          <Brain className={`w-4 h-4 ${advancedViralMode ? 'text-rose-500 animate-pulse' : 'text-slate-600'}`} />
                          <div>
                            <p className="text-[10px] font-bold text-slate-300 uppercase">Modo Agressivo</p>
                            <p className="text-[8px] text-slate-500 uppercase font-medium">Priorizar Viralização Extrema</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setAdvancedViralMode(!advancedViralMode)}
                          className={`w-10 h-5 rounded-full transition-all relative ${advancedViralMode ? 'bg-rose-600' : 'bg-slate-700'}`}
                        >
                          <div className={`absolute top-1 w-3 h-3 rounded-full bg-white transition-all ${advancedViralMode ? 'left-6' : 'left-1'}`} />
                        </button>
                      </div>

                      {isAdmin && (
                        <div className="flex items-center gap-3 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
                          <input 
                            type="checkbox" 
                            id="global_history_save" 
                            checked={saveToGlobalHistory} 
                            onChange={(e) => setSaveToGlobalHistory(e.target.checked)}
                            className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                          />
                          <label htmlFor="global_history_save" className="text-[11px] font-bold text-slate-300 cursor-pointer uppercase">
                            Disponibilizar Globalmente (Mobile Sync)
                          </label>
                        </div>
                      )}

                      <button 
                        onClick={handleGenerate}
                        disabled={loading}
                        className="w-full py-4 mt-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-900/20 flex items-center justify-center gap-2 group disabled:opacity-50"
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Sparkles size={16} className="group-hover:rotate-12 transition-transform" />
                            Gerar Roteiro Otimizado
                          </>
                        )}
                      </button>
                    </div>

                    <div className="glass p-5 rounded-2xl flex flex-col gap-4">
                      <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Autoridade & Conexão</h3>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Sistema ajustado para <span className="text-indigo-400 font-bold">Retenção v3.1</span>. Focado em conexão humana real e loops de curiosidade orgânicos.
                      </p>
                    </div>
                  </section>

                  <section className="hidden lg:flex flex-1 glass rounded-2xl flex-col items-center justify-center border-dashed border-slate-700/50 bg-[#020617]/40">
                    <Brain className="w-16 h-16 text-slate-800 mb-4" />
                    <p className="text-slate-500 text-sm font-medium">Configure acima para iniciar a geração</p>
                  </section>
                </div>
              ) : (
                <ScriptView script={currentScript} onBack={() => setCurrentScript(null)} onDelete={deleteScript} />
              )}
            </motion.div>
          )}

          {view === 'studio' && (
            <motion.div 
              key="studio"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              <StudioTab 
                projects={studioProjects}
                imageStyle={imageStyle}
                setImageStyle={setImageStyle}
                onSave={async (p) => {
                  if (user) {
                    await setDoc(doc(db, 'users', user.uid, 'studio', p.id), p);
                  } else {
                    const newPs = [p, ...studioProjects];
                    setStudioProjects(newPs);
                    localStorage.setItem('psycho_studio', JSON.stringify(newPs));
                  }
                }}
                onUpdate={async (up) => {
                  if (user) {
                    await setDoc(doc(db, 'users', user.uid, 'studio', up.id), up);
                  } else {
                    const newPs = studioProjects.map(p => p.id === up.id ? up : p);
                    setStudioProjects(newPs);
                    localStorage.setItem('psycho_studio', JSON.stringify(newPs));
                  }
                }}
                onDelete={deleteStudioProject}
              />
            </motion.div>
          )}

          {view === 'training' && (
            <motion.div 
              key="training"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              <TrainingTab 
                localInspirations={inspirations}
                globalInspirations={globalInspirations} 
                onAdd={addInspiration} 
                onDelete={deleteInspiration} 
                availableNiches={availableNiches}
                isAdmin={isAdmin}
                currentNiche={niche}
              />
            </motion.div>
          )}

          {view === 'history' && (
            <motion.div 
              key="history"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              <HistoryTab 
                history={history} 
                globalHistory={globalHistory}
                onView={(s) => { setCurrentScript(s); setView('generator'); }} 
                onDelete={deleteScript} 
                isAdmin={isAdmin}
              />
            </motion.div>
          )}

          {view === 'language_training' && (
            <motion.div 
              key="language_training"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              <LanguageTrainingTab 
                localPatterns={languagePatterns}
                globalPatterns={globalLanguagePatterns} 
                onAdd={addLanguagePattern} 
                onDelete={deleteLanguagePattern} 
                availableNiches={availableNiches}
                isAdmin={isAdmin}
                currentNiche={niche}
              />
            </motion.div>
          )}

          {view === 'seo' && (
            <motion.div 
              key="seo"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1"
            >
              <SEOTab 
                history={seoHistory} 
                onDelete={deleteSeo} 
                user={user} 
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/95 backdrop-blur-xl border-t border-slate-700/30 flex lg:hidden items-center justify-around px-2 z-50 pb-safe">
        <MobileNavItem active={view === 'generator'} onClick={() => setView('generator')} icon={<Sparkles size={24} />} label="Gerar" />
        <MobileNavItem active={view === 'studio'} onClick={() => setView('studio')} icon={<Video size={24} />} label="Vídeo" />
        <MobileNavItem active={view === 'seo'} onClick={() => setView('seo')} icon={<Tag size={24} />} label="SEO" />
        <MobileNavItem active={view === 'history'} onClick={() => setView('history')} icon={<History size={24} />} label="Histórico" />
        <MobileNavItem active={view === 'training'} onClick={() => setView('training')} icon={<BookOpen size={24} />} label="Treino" />
        <MobileNavItem active={view === 'language_training'} onClick={() => setView('language_training')} icon={<Languages size={24} />} label="Linguagem" />
      </nav>
    </div>
  );
}

function ConfirmButton({ 
  onConfirm, 
  icon: Icon, 
  label, 
  className, 
  confirmText = "Tem certeza?",
  confirmIcon: ConfirmIcon = CheckCircle2
}: { 
  onConfirm: () => void, 
  icon: any, 
  label?: string, 
  className?: string, 
  confirmText?: string,
  confirmIcon?: any
}) {
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (isConfirming) {
      const timer = setTimeout(() => setIsConfirming(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isConfirming]);

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (isConfirming) {
          onConfirm();
          setIsConfirming(false);
        } else {
          setIsConfirming(true);
        }
      }}
      className={`${className} ${isConfirming ? 'bg-rose-500 text-white border-rose-600 scale-105' : ''} transition-all duration-200 relative group`}
      title={isConfirming ? confirmText : label}
    >
      <AnimatePresence mode="wait">
        {isConfirming ? (
          <motion.div
            key="confirming"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1"
          >
            <ConfirmIcon size={18} />
            {label && <span className="text-[10px] font-bold uppercase">Confirmar?</span>}
          </motion.div>
        ) : (
          <motion.div
            key="normal"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1"
          >
            <Icon size={18} />
            {label && <span className="text-[10px] font-bold uppercase">{label}</span>}
          </motion.div>
        )}
      </AnimatePresence>
      {isConfirming && (
        <motion.div 
          className="absolute -bottom-1 left-1 right-1 h-0.5 bg-white/40 rounded-full overflow-hidden"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 3, ease: 'linear' }}
        />
      )}
    </button>
  );
}

function MobileNavItem({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) {
  return (
    <button 
      onClick={onClick}
      onPointerDown={(e) => e.currentTarget.style.transform = 'scale(0.95)'}
      onPointerUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
      className={`flex flex-col items-center justify-center gap-1 flex-1 h-full py-2 transition-all active:scale-95 ${active ? 'text-indigo-400' : 'text-slate-500'}`}
    >
      <div className={`p-2 rounded-xl transition-all ${active ? 'bg-indigo-500/10' : ''}`}>
        {icon}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-[0.1em]">{label}</span>
    </button>
  );
}

function NavItem({ active, onClick, icon, label, count }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string, count?: number }) {
  return (
    <button 
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${active ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
    >
      {icon}
      <span className="flex-1 text-left">{label}</span>
      {count !== undefined && (
        <span className="ml-auto text-[10px] bg-slate-700 px-2 py-0.5 rounded-full text-slate-300">{count}</span>
      )}
    </button>
  );
}

function ScriptView({ script, onBack, onDelete }: { script: GeneratedScript, onBack: () => void, onDelete: (id: string, isGlobal?: boolean) => void }) {
  const srtContent = generateSRT(script.scenes);

  return (
    <section className="flex-1 glass rounded-2xl flex flex-col overflow-hidden h-full lg:h-[calc(100vh-3rem)]">
      <header className="p-4 border-b border-slate-700/50 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-slate-800/20">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
            <ChevronRight className="rotate-180" size={18} />
          </button>
          <div>
            <h2 className="text-sm font-bold text-white line-clamp-1">{script.title}</h2>
            <p className="text-[10px] text-slate-500 uppercase font-bold tracking-tighter">
              {script.niche} • {script.wordCount === 'manual' ? 'Custom' : script.wordCount} Palavras • {script.fullText.length.toLocaleString()} Caracteres • {script.format || '16:9'} • {script.contentType}
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <ConfirmButton 
            onConfirm={() => {
              onDelete(script.id, script.isGlobal);
              onBack();
            }}
            icon={Trash2}
            label="Excluir"
            className="flex-1 md:flex-none px-4 py-2.5 bg-rose-500/10 text-rose-500 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 border border-rose-500/30 shadow-md"
            confirmText="Certeza?"
          />
          <button 
            onClick={() => copyToClipboard(script.fullText)}
            className="flex-1 md:flex-none px-4 py-2.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-[10px] font-bold text-slate-200 uppercase"
          >
            Copiar Tudo
          </button>
          <button 
            onClick={() => downloadFile(srtContent, `roteiro-${script.id}.srt`, 'text/plain')}
            className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[10px] font-bold text-white uppercase"
          >
            Legenda .SRT
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col gap-6 scrollbar-hide">
        {/* Viral Intelligence Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Big Score Card */}
          <div className="p-6 rounded-3xl bg-indigo-500/5 border border-indigo-500/20 flex flex-col items-center justify-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4">
              <Sparkles className="text-indigo-400 opacity-20 group-hover:opacity-100 transition-opacity" size={24} />
            </div>
            <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-2">Score Viral v3.1</span>
            <div className="relative">
               <svg className="w-32 h-32 transform -rotate-90">
                 <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-slate-800" />
                 <circle cx="64" cy="64" r="58" stroke="currentColor" strokeWidth="8" fill="transparent" className="text-indigo-500" strokeDasharray="364.4" strokeDashoffset={364.4 - (364.4 * (script.viralScore || 0)) / 100} strokeLinecap="round" />
               </svg>
               <div className="absolute inset-0 flex flex-col items-center justify-center">
                 <span className="text-4xl font-black text-white leading-none">{script.viralScore || 0}</span>
                 <span className="text-[10px] font-bold text-indigo-400">PONTOS</span>
               </div>
            </div>
            <div className={`mt-4 px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-tighter ${
              script.viralClassification === 'Alto' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
              script.viralClassification === 'Médio' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
              'bg-rose-500/20 text-rose-400 border border-rose-500/40'
            }`}>
              {script.viralClassification || 'Baixo'} Potencial Viral
            </div>
          </div>

          {/* Analysis Breakdown */}
          <div className="col-span-1 md:col-span-2 p-6 rounded-3xl bg-slate-900/50 border border-slate-800 flex flex-col gap-4">
            <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Brain size={14} className="text-indigo-400" /> Detalhamento de Atributos
            </h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
               {Object.entries(script.viralAnalysis || {}).map(([key, value]) => {
                 if (key === 'justification') return null;
                 const colors = {
                    curiosity: 'text-indigo-400',
                    emotion: 'text-rose-400',
                    conflict: 'text-amber-400',
                    surprise: 'text-emerald-400',
                    trend: 'text-sky-400'
                 };
                 const labels = {
                    curiosity: 'Curiosidade',
                    emotion: 'Emoção',
                    conflict: 'Conflito',
                    surprise: 'Surpresa',
                    trend: 'Tendência'
                 };
                 return (
                   <div key={key} className="flex flex-col gap-1">
                     <div className="flex justify-between text-[9px] font-bold uppercase tracking-tighter">
                       <span className="text-slate-500">{labels[key as keyof typeof labels]}</span>
                       <span className={colors[key as keyof typeof colors]}>{value}/10</span>
                     </div>
                     <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                       <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(value as number) * 10}%` }}
                        className={`h-full bg-current ${colors[key as keyof typeof colors]}`}
                       />
                     </div>
                   </div>
                 );
               })}
            </div>
            <p className="text-[11px] text-slate-500 italic mt-auto border-t border-slate-800 pt-3">
               "{script.viralAnalysis?.justification}"
            </p>
          </div>
        </div>

        {/* Decision & Technical Info */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className={`p-6 rounded-3xl border ${script.decision?.worthProducing ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-xl ${script.decision?.worthProducing ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {script.decision?.worthProducing ? <CheckCircle2 size={20} /> : <X size={20} />}
                </div>
                <div>
                  <h3 className="text-xs font-bold text-white uppercase tracking-tight">Vale Produzir? {script.decision?.worthProducing ? 'Sim' : 'Não'}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none mt-1">Análise de ROI Narrativo</p>
                </div>
              </div>
              <p className="text-[12px] text-slate-300 mb-4 leading-relaxed line-clamp-3">
                <span className="text-slate-500 font-bold uppercase text-[10px] block mb-1">Motivo:</span>
                {script.decision?.reason}
              </p>
              <div className="p-4 bg-black/40 rounded-2xl border border-slate-800">
                <span className="text-indigo-400 font-bold uppercase text-[10px] block mb-1">Como Melhorar:</span>
                <p className="text-[11px] text-slate-400 italic">"{script.decision?.improvements}"</p>
              </div>
           </div>

           <div className="p-6 rounded-3xl bg-slate-900/50 border border-slate-800 flex flex-col gap-4">
              <h3 className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Análise Técnica do Vídeo</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400 shrink-0"><Check size={14} /></div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Sugestão de Corte</span>
                    <p className="text-[11px] text-slate-300 leading-tight">{script.idealCut}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0"><Smartphone size={14} /></div>
                  <div>
                    <span className="text-[9px] font-bold text-slate-500 uppercase block">Pico Emocional</span>
                    <p className="text-[11px] text-slate-300 leading-tight">{script.emotionalPeak}</p>
                  </div>
                </div>
              </div>
           </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-4 bg-indigo-900/10 border border-indigo-500/20 rounded-xl relative group flex flex-col">
            <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-3 tracking-widest">Roteiro Completo (PT-BR)</h4>
            <div className="text-[13px] sm:text-[14px] text-slate-300 italic leading-relaxed whitespace-pre-wrap flex-1 min-h-[12rem] max-h-96 overflow-y-auto scrollbar-hide p-4 bg-black/20 rounded-2xl">
              {script.fullText}
            </div>
            <button 
              onClick={() => copyToClipboard(script.fullText)}
              className="w-full mt-4 py-3 bg-slate-800 rounded-xl text-[10px] font-bold border border-slate-700 hover:bg-slate-700 transition-colors uppercase text-slate-300 shadow-lg"
            >
              Copiar Roteiro Completo
            </button>
          </div>

          <div className="flex flex-col gap-6">
             <div className="p-6 glass border-indigo-500/10 rounded-3xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Sugestões de Thumbnail</h3>
                </div>
                <div className="space-y-3">
                  {script.thumbnailSuggestions?.map((s, idx) => (
                    <div key={idx} className="p-3 bg-slate-950 rounded-xl border border-slate-800/50 text-[11px] leading-relaxed text-slate-400 flex gap-3 group">
                       <span className="text-indigo-500 font-bold">#{idx+1}</span>
                       <p className="group-hover:text-slate-200 transition-colors">{s}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 border-t border-slate-800 pt-4">
                   <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase">DALL-E 3 Master Prompt</span>
                      <button onClick={() => copyToClipboard(script.thumbnailPrompt)} className="text-[9px] font-bold text-indigo-400">COPIAR</button>
                   </div>
                   <p className="text-[10px] text-slate-500 italic p-3 bg-black/40 rounded-xl border border-slate-800 group-hover:text-slate-400 transition-colors">"{script.thumbnailPrompt}"</p>
                </div>
              </div>
          </div>
        </div>

        <div className="flex flex-col gap-4 mb-24">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[11px] font-bold text-indigo-400 uppercase tracking-widest">Sequência de Cenas</h3>
            <button 
              onClick={() => copyToClipboard(script.scenes.map(s => s.imagePrompt).join('\n'))}
              className="text-[10px] text-slate-500 hover:text-white font-bold"
            >
              COPIAR TODOS OS PROMPTS
            </button>
          </div>
          
          <div className="space-y-4">
            {script.scenes.map((scene, i) => (
              <div key={i} className="flex flex-col sm:flex-row gap-4 p-4 bg-slate-950/50 rounded-xl border border-slate-800 group hover:border-slate-700 transition-all">
                <div className="w-12 h-12 bg-indigo-500/10 border border-indigo-500/30 rounded flex items-center justify-center flex-shrink-0 text-indigo-400 text-xs font-bold font-mono">
                  {scene.startTime.split(',')[0].split(':')[1]}:{scene.startTime.split(',')[0].split(':')[2]}
                </div>
                <div className="flex-1 overflow-hidden">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="text-[11px] font-bold text-indigo-400 uppercase tracking-tighter">Cena {i + 1}</h4>
                    <button 
                      onClick={() => copyToClipboard(scene.imagePrompt)}
                      className="text-[10px] bg-slate-800 px-2 py-1 rounded border border-slate-700 hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      Copiar Prompt
                    </button>
                  </div>
                  <p className="text-[12px] leading-relaxed mb-3 text-slate-300 italic">"{scene.text}"</p>
                  <div className="text-[10px] text-slate-500 bg-black/40 p-2.5 rounded border border-slate-800/50 font-mono break-words">
                    <span className="text-indigo-500/80 mr-1 font-bold">Visual Prompt:</span> 
                    {scene.imagePrompt}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function TrainingTab({ 
  localInspirations, 
  globalInspirations, 
  onAdd, 
  onDelete, 
  availableNiches,
  isAdmin,
  currentNiche
}: { 
  localInspirations: Inspiration[], 
  globalInspirations: Inspiration[],
  onAdd: (inp: any, global?: boolean) => void, 
  onDelete: (id: string, global?: boolean) => void, 
  availableNiches: string[],
  isAdmin: boolean,
  currentNiche: string
}) {
  const [newContent, setNewContent] = useState('');
  const [newClassification, setNewClassification] = useState('');
  const [selectedNiche, setSelectedNiche] = useState(currentNiche || availableNiches[0] || 'Geral');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filterNiche, setFilterNiche] = useState(currentNiche || 'Todos');
  const [saveToGlobal, setSaveToGlobal] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  // Sync selectedNiche and filterNiche with currentNiche when tab opens or niche changes
  useEffect(() => {
    if (currentNiche) {
      setSelectedNiche(currentNiche);
      setFilterNiche(currentNiche);
    }
  }, [currentNiche]);

  const handleAutoClassify = async () => {
    if (!newContent.trim()) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeScriptForClassification(newContent);
      setNewClassification(result.style);
      if (availableNiches.includes(result.niche)) {
        setSelectedNiche(result.niche);
      }
    } catch (e) {
      alert("Erro ao analisar roteiro.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if(!newContent || !newClassification) return;
    onAdd({ niche: selectedNiche, classification: newClassification, content: newContent }, saveToGlobal);
    
    // UI Feedback
    setNewClassification('');
    setNewContent('');
    setSaveToGlobal(false);
    setFilterNiche(selectedNiche); // Keep focused on the niche just added
    
    setJustAddedId('new');
    setTimeout(() => setJustAddedId(null), 3000);
  };

  const allInspirations = [
    ...globalInspirations.map(i => ({ ...i, isGlobal: true })),
    ...localInspirations.map(i => ({ ...i, isGlobal: false }))
  ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const filteredInspirations = filterNiche === 'Todos' 
    ? allInspirations 
    : allInspirations.filter(i => i.niche === filterNiche);

  return (
    <div className="flex flex-col gap-6 h-full lg:h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Base de Inteligência v2.1</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-xs text-slate-400">Sincronizado Cloud v2.1. {isAdmin ? "Acesso ADMINISTRADOR." : "Modo VISITANTE."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50">
          <Filter size={14} className="ml-2 text-slate-500" />
          <select 
            value={filterNiche}
            onChange={(e) => setFilterNiche(e.target.value)}
            className="bg-transparent border-none text-[11px] font-bold uppercase tracking-wider text-slate-300 outline-none cursor-pointer pr-3"
          >
            <option value="Todos" className="bg-slate-900">Todos os Nichos</option>
            {availableNiches.map(n => <option key={n} value={n} className="bg-slate-900">{n}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        <section className="w-full lg:w-96 glass p-6 rounded-2xl flex flex-col gap-5 h-fit border-indigo-500/10">
          <div className="flex items-center justify-between">
             <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
               <BookOpen size={16} />
               Novo Treinamento
             </h3>
             <button 
              onClick={handleAutoClassify}
              disabled={isAnalyzing || !newContent}
              className="text-[9px] font-bold text-indigo-400 hover:text-white flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 disabled:opacity-50 transition-all uppercase"
             >
               {isAnalyzing ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
               Auto-Análise
             </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-slate-500 mb-1.5 block uppercase font-bold tracking-widest">Nicho do Roteiro</label>
              <select 
                value={selectedNiche}
                onChange={(e) => setSelectedNiche(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500/50 transition-all font-medium appearance-none"
              >
                {availableNiches.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 mb-1.5 block uppercase font-bold tracking-widest">Estilo / Tom (Manual)</label>
              <div className="relative">
                <input 
                  placeholder="Ex: Storytelling Emocional, Viral, Narrativo..." 
                  value={newClassification}
                  onChange={(e) => setNewClassification(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500/50 transition-all font-medium"
                />
                <Tag size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 mb-1.5 block uppercase font-bold tracking-widest">Conteúdo para Treino</label>
              <textarea 
                placeholder="Cole o roteiro de referência aqui para a IA aprender a estrutura e tom..." 
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full h-48 p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white resize-none outline-none focus:border-indigo-500/50 transition-all font-medium"
              />
            </div>

            {isAdmin && (
              <div className="flex items-center gap-3 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
                <input 
                  type="checkbox" 
                  id="global_save" 
                  checked={saveToGlobal} 
                  onChange={(e) => setSaveToGlobal(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="global_save" className="text-[11px] font-bold text-slate-300 cursor-pointer">
                  SALVAR NA BASE GLOBAL (ADMIN)
                </label>
              </div>
            )}

            <button 
              onClick={handleSave}
              className="w-full py-4 bg-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all text-white shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              Salvar na Base de Estilo
            </button>
          </div>
        </section>

        <section className="flex-1 overflow-y-auto lg:scrollbar-hide flex flex-col gap-4 pb-24 lg:pb-0 pr-2">
          {filteredInspirations.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
              <BookOpen size={32} className="text-slate-800 mb-2" />
              <p className="text-slate-600 text-sm font-medium">Nenhum roteiro neste filtro</p>
            </div>
          ) : (
            filteredInspirations.map((inp, index) => (
              <div key={inp.id} className={`p-5 glass rounded-2xl border group hover:border-indigo-500/40 transition-all ${inp.isGlobal ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-slate-900/10 border-slate-800/50'} ${(index === 0 && justAddedId === 'new') ? 'ring-2 ring-indigo-500/50 border-indigo-500 animate-pulse' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                       <Brain size={12} className="text-indigo-400" />
                       <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{inp.niche}</span>
                    </div>
                    {inp.isGlobal && (
                      <div className="flex items-center gap-2 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                         <Globe size={11} className="text-emerald-400" />
                         <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Global</span>
                      </div>
                    )}
                    {(index === 0 && justAddedId === 'new') && (
                      <div className="bg-emerald-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase animate-bounce flex items-center gap-2">
                        <Sparkles size={10} />
                        Recém Treinado
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                       <Tag size={12} className="text-slate-400" />
                       <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">{inp.classification}</h4>
                    </div>
                  </div>
                  {(isAdmin || !inp.isGlobal) && (
                    <ConfirmButton 
                      onConfirm={() => onDelete(inp.id, inp.isGlobal)}
                      icon={Trash2}
                      className="relative z-20 p-3 text-rose-500 bg-rose-500/10 rounded-xl border border-rose-500/20 flex items-center justify-center min-w-[44px] min-h-[44px] active:scale-95 touch-manipulation shadow-lg"
                      confirmText="Excluir da base?"
                    />
                  )}
                </div>
                <p className="text-[13px] text-slate-400 leading-relaxed italic line-clamp-3 pl-4 border-l-2 border-slate-800 group-hover:border-indigo-500/40 transition-colors">"{inp.content}"</p>
                <div className="mt-4 flex justify-end">
                   <span className="text-[9px] text-slate-600 font-mono italic">Adicionado em {new Date(inp.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

function HistoryTab({ history, globalHistory, onView, onDelete, isAdmin }: { history: GeneratedScript[], globalHistory: GeneratedScript[], onView: (s: GeneratedScript) => void, onDelete: (id: string, isGlobal?: boolean) => void, isAdmin: boolean }) {
  const combinedHistory = [
    ...globalHistory.map(s => ({ ...s, isGlobal: true })),
    ...history.map(s => ({ ...s, isGlobal: false }))
  ].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <div className="flex flex-col gap-6 h-full lg:h-[calc(100vh-3rem)]">
      <div>
        <h2 className="text-xl font-bold text-white">Histórico de Projetos</h2>
        <p className="text-xs text-slate-400">Gerencie e visualize seus roteiros gerados {isAdmin ? "e da base global" : ""}.</p>
      </div>

      <div className="flex-1 overflow-y-auto lg:scrollbar-hide pb-24 lg:pb-0">
        {combinedHistory.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-3xl">
            <History size={32} className="text-slate-800 mb-2" />
            <p className="text-slate-600 text-sm">Nenhum projeto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {combinedHistory.map(script => (
              <div key={script.id} className={`p-5 glass rounded-2xl border transition-all group cursor-pointer flex flex-col min-h-[12rem] ${script.isGlobal ? 'bg-indigo-500/5 border-indigo-500/20 shadow-indigo-500/5' : 'bg-slate-900/10 border-slate-800/50'}`} onClick={() => onView(script)}>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Roteiro #{script.id.slice(0, 6)}</span>
                        {script.isGlobal && (
                            <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-widest">Global</span>
                        )}
                        {script.viralScore !== undefined && (
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-widest ${
                                script.viralScore >= 80 ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                                script.viralScore >= 50 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                                'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                            }`}>
                                Score: {script.viralScore}
                            </span>
                        )}
                    </div>
                    <h3 className="text-sm font-bold text-white line-clamp-2 uppercase leading-tight tracking-tight">{script.title}</h3>
                  </div>
                  {(isAdmin || !script.isGlobal) && (
                    <ConfirmButton 
                        onConfirm={() => onDelete(script.id, script.isGlobal)}
                        icon={Trash2}
                        className="relative z-20 p-3 text-rose-500 bg-rose-500/10 rounded-xl border border-rose-500/20 ml-2 flex items-center justify-center min-w-[44px] min-h-[44px] active:scale-95 touch-manipulation shadow-lg"
                        confirmText="Excluir?"
                    />
                  )}
                </div>
                <p className="text-xs text-slate-500 line-clamp-3 italic mb-4 leading-relaxed">"{script.fullText}"</p>
                <div className="mt-auto pt-3 border-t border-slate-800/20 flex justify-between items-center">
                  <span className="text-[10px] font-bold text-indigo-400 uppercase">{script.format || '16:9'} • {script.wordCount === 'manual' ? 'Custom' : script.wordCount} Palavras</span>
                  <span className="text-[10px] text-slate-600 font-medium">{new Date(script.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text);
}

function StudioTab({ 
  projects, 
  onSave, 
  onUpdate, 
  onDelete,
  imageStyle,
  setImageStyle
}: { 
  projects: VideoProject[], 
  onSave: (p: VideoProject) => void, 
  onUpdate: (p: VideoProject) => void, 
  onDelete: (id: string) => void,
  imageStyle: 'A' | 'B' | 'C',
  setImageStyle: (style: 'A' | 'B' | 'C') => void
}) {
  const [scriptInput, setScriptInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeProject, setActiveProject] = useState<VideoProject | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentSceneIndex, setCurrentSceneIndex] = useState(0);
  const [isGeneratingImages, setIsGeneratingImages] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<number | null>(null);
  const [imageSource, setImageSource] = useState<'ai' | 'deepai' | 'pexels' | 'pixabay' | 'hybrid'>(() => (localStorage.getItem('studio_img_source') as any) || 'ai');
  const [imageModel, setImageModel] = useState<'flux' | 'turbo' | 'sana'>(() => (localStorage.getItem('studio_img_model') as any) || 'flux');
  const [assetType, setAssetType] = useState<'image' | 'video'>(() => (localStorage.getItem('studio_asset_type') as any) || 'image');
  const [videoFormat, setVideoFormat] = useState<'16:9' | '9:16'>(() => (localStorage.getItem('studio_video_format') as any) || '16:9');
  const [pixabayKey, setPixabayKey] = useState(() => localStorage.getItem('pixabay_api_key') || import.meta.env.VITE_PIXABAY_API_KEY || '');
  const [pexelsKey, setPexelsKey] = useState(() => localStorage.getItem('pexels_api_key') || import.meta.env.VITE_PEXELS_API_KEY || '');
  const [deepaiKey, setDeepaiKey] = useState(() => localStorage.getItem('deepai_api_key') || import.meta.env.VITE_DEEPAI_API_KEY || '');
  const [smartSearch, setSmartSearch] = useState<boolean>(() => {
    const saved = localStorage.getItem('studio_smart_search');
    return saved === null ? true : saved === 'true';
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('studio_smart_search', smartSearch ? 'true' : 'false');
  }, [smartSearch]);

  useEffect(() => {
    localStorage.setItem('studio_img_source', imageSource);
    localStorage.setItem('studio_asset_type', assetType);
    localStorage.setItem('studio_video_format', videoFormat);
  }, [imageSource, assetType, videoFormat]);

  useEffect(() => {
    localStorage.setItem('studio_img_model', imageModel);
  }, [imageModel]);

  useEffect(() => {
    localStorage.setItem('pixabay_api_key', pixabayKey);
    localStorage.setItem('pexels_api_key', pexelsKey);
    localStorage.setItem('deepai_api_key', deepaiKey);
  }, [pixabayKey, pexelsKey, deepaiKey]);

  const fetchPixabayAsset = async (query: string, type: 'image' | 'video'): Promise<string | null> => {
    if (imageSource !== 'ai' && imageSource !== 'hybrid' && imageSource !== 'pixabay') return null;
    if (!pixabayKey && imageSource !== 'ai') return null;

    const performSearch = async (q: string) => {
      try {
        const resp = await fetch(`/api/pixabay?q=${encodeURIComponent(q)}&type=${type}&key=${encodeURIComponent(pixabayKey)}&format=${videoFormat}`);
        const data = await resp.json();
        const hits = data.hits || [];
        if (hits.length === 0) return null;
        
        // Pick a random one from the first 5 results for variety
        const maxResults = Math.min(hits.length, 5);
        const randomIndex = Math.floor(Math.random() * maxResults);
        const selected = hits[randomIndex];

        if (type === 'video') {
          return selected.videos?.medium?.url || selected.videos?.small?.url || null;
        }
        return selected.webformatURL || null;
      } catch (e) {
        return null;
      }
    };

    let result = await performSearch(query);
    if (!result && query.split(' ').length > 2) {
      // Try with even fewer words if failed
      result = await performSearch(query.split(' ').slice(0, 2).join(' '));
    }
    return result;
  };

  const fetchPexelsAsset = async (query: string, type: 'image' | 'video'): Promise<string | null> => {
    if (imageSource !== 'ai' && imageSource !== 'hybrid' && imageSource !== 'pexels') return null;
    if (!pexelsKey && imageSource !== 'ai') return null;

    const performSearch = async (q: string) => {
      try {
        const resp = await fetch(`/api/pexels?q=${encodeURIComponent(q)}&type=${type}&key=${encodeURIComponent(pexelsKey)}&format=${videoFormat}`);
        const data = await resp.json();
        
        if (type === 'video') {
          const videos = data.videos || [];
          if (videos.length === 0) return null;
          
          // Variety: Pick from first 5
          const maxResults = Math.min(videos.length, 5);
          const randomIndex = Math.floor(Math.random() * maxResults);
          const video = videos[randomIndex];
          
          const hdFile = video.video_files?.find((f: any) => f.quality === 'hd');
          return hdFile?.link || video.video_files?.[0]?.link || null;
        } else {
          const photos = data.photos || [];
          if (photos.length === 0) return null;
          const maxResults = Math.min(photos.length, 5);
          const randomIndex = Math.floor(Math.random() * maxResults);
          return photos[randomIndex]?.src?.large2x || null;
        }
      } catch (e) {
        return null;
      }
    };

    let result = await performSearch(query);
    if (!result && query.split(' ').length > 2) {
      result = await performSearch(query.split(' ').slice(0, 2).join(' '));
    }
    return result;
  };

  const fetchHybridAsset = async (query: string, type: 'image' | 'video'): Promise<string | null> => {
     // Try both simultaneously
     try {
       const results = await Promise.all([
         fetchPexelsAsset(query, type),
         fetchPixabayAsset(query, type)
       ]);
       
       // results[0] = pexels, results[1] = pixabay
       if (type === 'video') return results[0] || results[1];
       return results[1] || results[0];
     } catch (e) {
       return null;
     }
  };

  const fetchDeepAIAsset = async (query: string, type: 'image' | 'video'): Promise<string | null> => {
    if (imageSource !== 'deepai') return null;
    if (!deepaiKey) return null;

    try {
      const resp = await fetch("/api/deepai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: query,
          type: type,
          key: deepaiKey
        })
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.output_url || null;
    } catch (e) {
      console.error("DeepAI fetch error:", e);
      return null;
    }
  };

  const fetchSmartSearchAsset = async (sceneText: string, visualQuery: string, type: 'image' | 'video'): Promise<string | null> => {
    try {
      const resp = await fetch("/api/smart-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: sceneText,
          visualQuery: visualQuery,
          type: type,
          format: videoFormat,
          source: imageSource,
          pexelsKey: pexelsKey,
          pixabayKey: pixabayKey,
          deepaiKey: deepaiKey,
          imageStyle: imageStyle
        })
      });
      if (!resp.ok) {
        throw new Error("API call failed");
      }
      const data = await resp.json();
      return data.assetUrl || null;
    } catch (e) {
      console.error("Smart search failed, calling fallback...", e);
      if (imageSource === 'deepai') {
        return fetchDeepAIAsset(visualQuery, type);
      } else if (imageSource === 'hybrid') {
        return fetchHybridAsset(visualQuery, type);
      } else if (imageSource === 'pixabay') {
        return fetchPixabayAsset(visualQuery, type);
      } else if (imageSource === 'pexels') {
        return fetchPexelsAsset(visualQuery, type);
      }
      return null;
    }
  };

  // Clear active project if it was deleted from the items list
  useEffect(() => {
    if (activeProject && !projects.find(p => p.id === activeProject.id)) {
      setActiveProject(null);
      setIsPlaying(false);
    }
  }, [projects, activeProject]);

  const handleAnalyze = async () => {
    if (!scriptInput.trim()) return;
    setLoading(true);
    try {
      const project = await analyzeScriptForVideo(scriptInput);
      onSave(project);
      setActiveProject(project);
    } catch (e) {
      alert("Erro ao analisar roteiro para vídeo.");
    } finally {
      setLoading(false);
    }
  };

  const getStyledPrompt = (visualQuery: string): string => {
    if (imageStyle === 'A') {
      return `${visualQuery}, flat 2D vector cartoon illustration, clean bold outlines, vibrant flat colors, minimalist solid background, highly cohesive style, cheerful adventure mood. No text, no letters, no photorealism.`;
    } else if (imageStyle === 'B') {
      return `${visualQuery}, 3D render in Disney Pixar style, cute character design, soft volumetric studio lighting, rich smooth textures, clay material, vibrant saturated colors, detailed beautiful background, highly consistent style. No text, no photorealism.`;
    } else if (imageStyle === 'C') {
      return `${visualQuery}, clean 2D vector illustration style, pastel colors, soft textured shading, charming narrative picture book aesthetic, cozy whimsical lighting, cute character design. No text, no photorealism.`;
    }
    return visualQuery;
  };

  const generateSingleAsset = async (index: number) => {
    if (!activeProject) return;
    
    const updatedScenes = [...activeProject.scenes];
    updatedScenes[index] = { ...updatedScenes[index], isGenerating: true };
    setActiveProject({ ...activeProject, scenes: updatedScenes });

    try {
      let assetUrl = '';
      let currentAssetType = assetType;
      
      if (imageSource !== 'ai') {
        if (smartSearch) {
          assetUrl = await fetchSmartSearchAsset(updatedScenes[index].text, updatedScenes[index].visualQuery, assetType) || '';
        } else {
          if (imageSource === 'deepai') {
            assetUrl = await fetchDeepAIAsset(getStyledPrompt(updatedScenes[index].visualQuery), assetType) || '';
          } else if (imageSource === 'hybrid') {
            assetUrl = await fetchHybridAsset(updatedScenes[index].visualQuery, assetType) || '';
          } else if (imageSource === 'pixabay') {
            assetUrl = await fetchPixabayAsset(updatedScenes[index].visualQuery, assetType) || '';
          } else if (imageSource === 'pexels') {
            assetUrl = await fetchPexelsAsset(updatedScenes[index].visualQuery, assetType) || '';
          }
        }
      }
      
      if (!assetUrl || imageSource === 'ai') {
        const styledPrompt = getStyledPrompt(updatedScenes[index].visualQuery);
        const promptString = assetType === 'video' ? `cinematic video still, high detail: ${styledPrompt}` : styledPrompt;
        const prompt = encodeURIComponent(promptString);
        const w = videoFormat === '16:9' ? 1024 : 576;
        const h = videoFormat === '16:9' ? 576 : 1024;
        assetUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=${imageModel}&width=${w}&height=${h}&seed=${Math.floor(Math.random() * 1000000)}`;
        currentAssetType = 'image';
      }
      
      if (imageSource === 'ai') await new Promise(r => setTimeout(r, 2000));
      else await new Promise(r => setTimeout(r, 800)); // Still add a small delay for API safety

      updatedScenes[index] = { 
        ...updatedScenes[index], 
        assetUrl, 
        assetType: currentAssetType,
        isGenerating: false 
      };
      
      const newProj = { ...activeProject, scenes: updatedScenes, updatedAt: Date.now() };
      setActiveProject(newProj);
      onUpdate(newProj);
    } catch (error) {
      updatedScenes[index] = { ...updatedScenes[index], isGenerating: false };
      setActiveProject({ ...activeProject, scenes: updatedScenes });
      alert("Erro ao obter mídia.");
    }
  };

  const generateAllAssets = async (force: boolean = false) => {
    if (!activeProject) return;
    setIsGeneratingImages(true);
    
    const updatedScenes = [...activeProject.scenes];
    
    for (let i = 0; i < updatedScenes.length; i++) {
      if (!force && updatedScenes[i].assetUrl) continue; 
      
      updatedScenes[i] = { ...updatedScenes[i], isGenerating: true };
      setActiveProject({ ...activeProject, scenes: [...updatedScenes] });
      
      let assetUrl = '';
      let currentAssetType = assetType;

      if (imageSource !== 'ai') {
        if (smartSearch) {
          assetUrl = await fetchSmartSearchAsset(updatedScenes[i].text, updatedScenes[i].visualQuery, assetType) || '';
        } else {
          if (imageSource === 'deepai') {
            assetUrl = await fetchDeepAIAsset(getStyledPrompt(updatedScenes[i].visualQuery), assetType) || '';
          } else if (imageSource === 'hybrid') {
            assetUrl = await fetchHybridAsset(updatedScenes[i].visualQuery, assetType) || '';
          } else if (imageSource === 'pixabay') {
            assetUrl = await fetchPixabayAsset(updatedScenes[i].visualQuery, assetType) || '';
          } else if (imageSource === 'pexels') {
            assetUrl = await fetchPexelsAsset(updatedScenes[i].visualQuery, assetType) || '';
          }
        }
      }
      
      if (!assetUrl || imageSource === 'ai') {
        const styledPrompt = getStyledPrompt(updatedScenes[i].visualQuery);
        const promptString = assetType === 'video' ? `cinematic video still, high detail: ${styledPrompt}` : styledPrompt;
        const prompt = encodeURIComponent(styledPrompt);
        const w = videoFormat === '16:9' ? 1024 : 576;
        const h = videoFormat === '16:9' ? 576 : 1024;
        assetUrl = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=${imageModel}&width=${w}&height=${h}&seed=${Math.floor(Math.random() * 1000000)}`;
        currentAssetType = 'image';
      }
      
      if (imageSource === 'ai') await new Promise(r => setTimeout(r, 2500));
      else await new Promise(r => setTimeout(r, 1000));

      updatedScenes[i] = { 
        ...updatedScenes[i], 
        assetUrl, 
        assetType: currentAssetType,
        isGenerating: false 
      };
      setActiveProject({ ...activeProject, scenes: [...updatedScenes] });
    }
    
    setIsGeneratingImages(false);
    onUpdate({ ...activeProject, scenes: updatedScenes, updatedAt: Date.now() });
  };

  const downloadAssetPack = async () => {
    if (!activeProject) return;
    
    const readyScenes = activeProject.scenes.filter(s => s.assetUrl);
    if (readyScenes.length === 0) {
      alert("Nenhuma mídia gerada para download.");
      return;
    }

    setDownloadProgress(0);
    const zip = new JSZip();
    const folder = zip.folder(`projeto-${activeProject.id.slice(0, 8)}`);
    
    try {
      const summary = `PROJETO: ${activeProject.id}\nROTEIRO:\n${activeProject.originalScript}`;
      const srt = generateSRTForProject(activeProject);
      folder?.file("roteiro.txt", summary);
      folder?.file("legenda.srt", srt);

      for (let i = 0; i < readyScenes.length; i++) {
        const scene = readyScenes[i];
          if (scene.assetUrl) {
          try {
            const response = await fetch(`/api/proxy?url=${encodeURIComponent(scene.assetUrl)}`);
            const contentType = response.headers.get('content-type');
            const ext = scene.assetType === 'video' ? 'mp4' : 'jpg';
            
            if (!response.ok || (contentType && contentType.includes('application/json'))) {
              await new Promise(r => setTimeout(r, 2000));
              const retryResponse = await fetch(`/api/proxy?url=${encodeURIComponent(scene.assetUrl)}`);
              const blob = await retryResponse.blob();
              folder?.file(`cena-${(i + 1).toString().padStart(2, '0')}.${ext}`, blob);
            } else {
              const blob = await response.blob();
              folder?.file(`cena-${(i + 1).toString().padStart(2, '0')}.${ext}`, blob);
            }
          } catch (e) {
            console.error(`Error downloading asset ${i+1}:`, e);
          }
          setDownloadProgress(Math.round(((i + 1) / readyScenes.length) * 100));
        }
      }
      
      const content = await zip.generateAsync({ type: "blob" });
      saveAs(content, `pacote-mídia-${activeProject.id.slice(0, 8)}.zip`);
    } catch (error) {
      alert("Erro ao criar pacote de download.");
    } finally {
      setTimeout(() => setDownloadProgress(null), 1000);
    }
  };

  // Preview logic
  useEffect(() => {
    if (isPlaying && activeProject) {
      const currentScene = activeProject.scenes[currentSceneIndex];
      
      const utterance = new SpeechSynthesisUtterance(currentScene.text);
      utterance.lang = 'pt-BR';
      utterance.rate = 1.1;
      
      utterance.onend = () => {
        if (currentSceneIndex < activeProject.scenes.length - 1) {
          setCurrentSceneIndex(prev => prev + 1);
        } else {
          setIsPlaying(false);
          setCurrentSceneIndex(0);
        }
      };

      window.speechSynthesis.speak(utterance);
    } else {
      window.speechSynthesis.cancel();
    }
    return () => window.speechSynthesis.cancel();
  }, [isPlaying, currentSceneIndex, activeProject]);

  const formatSRTTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600).toString().padStart(2, '0');
    const mins = Math.floor((seconds % 3600) / 60).toString().padStart(2, '0');
    const secs = Math.floor(seconds % 60).toString().padStart(2, '0');
    const ms = Math.round((seconds % 1) * 1000).toString().padStart(3, '0');
    return `${hrs}:${mins}:${secs},${ms}`;
  };

  const generateSRTForProject = (proj: VideoProject) => {
    let srt = '';
    let currentTime = 0;
    proj.scenes.forEach((scene, i) => {
      const startTime = formatSRTTime(currentTime);
      currentTime += scene.duration;
      const endTime = formatSRTTime(currentTime);
      srt += `${i + 1}\n${startTime} --> ${endTime}\n${scene.text}\n\n`;
    });
    return srt;
  };

  const exportToDesktop = async () => {
    if (!activeProject) return;
    await downloadAssetPack();
  };

  return (
    <div className="flex flex-col gap-6 h-full lg:h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Video className="text-indigo-400" />
            Estúdio de Vídeo Assembler
          </h2>
          <p className="text-xs text-slate-400">Transforme roteiros prontos em mídias, imagens IA e narração sincronizada.</p>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {!activeProject ? (
          <div className="w-full lg:w-1/3 flex flex-col gap-4 overflow-y-auto lg:overflow-visible pb-24 lg:pb-0">
            <section className="glass p-5 rounded-2xl flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Montar Novo Vídeo</h3>
                <button 
                  onClick={() => setShowSettings(true)}
                  className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-indigo-400 transition-colors"
                  title="Configurações Studio"
                >
                  <Settings size={16} />
                </button>
              </div>
              <textarea 
                placeholder="Cole o roteiro completo aqui..." 
                value={scriptInput}
                onChange={(e) => setScriptInput(e.target.value)}
                className="w-full h-40 lg:h-64 p-3 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white resize-none outline-none focus:border-indigo-500/50 transition-all font-medium"
              />
              <button 
                onClick={handleAnalyze}
                disabled={loading || !scriptInput}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-bold text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
              >
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Analisar e Mapear Cenas"}
              </button>
            </section>

            <section className="flex-1 overflow-y-auto lg:scrollbar-hide flex flex-col gap-3">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-2">Projetos Recentes</h3>
              {projects.length === 0 ? (
                <div className="p-8 border border-dashed border-slate-800 rounded-2xl text-center text-slate-600 text-xs">Sem projetos salvos</div>
              ) : (
                projects.map(p => (
                  <div key={p.id} className="p-3 glass border border-slate-800/50 rounded-xl hover:border-indigo-500/30 cursor-pointer group flex justify-between items-center" onClick={() => setActiveProject(p)}>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs font-bold text-slate-200 truncate uppercase tracking-tighter">{p.originalScript.slice(0, 40)}...</h4>
                      <p className="text-[9px] text-slate-500 mt-1 uppercase font-bold">{p.scenes.length} CENAS • {new Date(p.createdAt).toLocaleDateString()}</p>
                    </div>
                    <ConfirmButton 
                      onConfirm={() => onDelete(p.id)}
                      icon={Trash2}
                      className="relative z-20 p-3 text-rose-500 bg-rose-500/10 rounded-xl border border-rose-500/20 ml-2 min-w-[44px] min-h-[44px] flex items-center justify-center active:scale-90 touch-manipulation shadow-lg"
                      confirmText="Excluir?"
                    />
                  </div>
                ))
              )}
            </section>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row gap-6 h-full overflow-hidden pb-24 lg:pb-0">
            <section className="flex-1 flex flex-col gap-4 overflow-hidden">
              <header className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                <button 
                  onClick={() => { setActiveProject(null); setIsPlaying(false); }} 
                  className="text-[10px] font-bold text-slate-400 hover:text-white uppercase flex items-center gap-2 bg-slate-800/50 px-4 py-2.5 rounded-lg lg:bg-transparent lg:p-0 w-full md:w-auto justify-center md:justify-start"
                >
                  <ChevronRight className="rotate-180" size={14}/> Voltar aos Projetos
                </button>
                <div className="flex flex-wrap gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => generateAllAssets(false)}
                      disabled={isGeneratingImages}
                      className="flex-1 md:flex-none px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-[9px] font-bold text-white uppercase flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isGeneratingImages ? <Sparkles size={12} className="animate-pulse" /> : <Sparkles size={12}/>}
                      <span>{isGeneratingImages ? "Gerando..." : assetType === 'video' ? "Gerar Mídias" : "Gerar Imagens IA"}</span>
                    </button>
                    <button 
                      onClick={() => generateAllAssets(true)}
                      disabled={isGeneratingImages}
                      className="flex-1 md:flex-none px-3 py-2.5 bg-slate-800 hover:bg-indigo-700 border border-slate-700 rounded-lg text-[9px] font-bold text-slate-300 hover:text-white uppercase flex items-center justify-center gap-2 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw size={12} className={isGeneratingImages ? "animate-spin" : ""}/>
                      REFER TUDO
                    </button>
                  <button 
                    onClick={downloadAssetPack}
                    disabled={downloadProgress !== null}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[9px] font-bold text-slate-300 uppercase flex items-center justify-center gap-2"
                  >
                    {downloadProgress !== null ? (
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
                        {downloadProgress}%
                      </span>
                    ) : (
                      <>
                        <Download size={14}/>
                        ZIP PACK
                      </>
                    )}
                  </button>
                  <button 
                    onClick={() => downloadFile(generateSRTForProject(activeProject), `legenda-${activeProject.id}.srt`, 'text/plain')}
                    className="flex-1 md:flex-none px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-[9px] font-bold text-slate-300 uppercase"
                  >
                    Legendas
                  </button>
                  <ConfirmButton 
                    onConfirm={() => {
                      onDelete(activeProject.id);
                      setActiveProject(null);
                    }}
                    icon={Trash2}
                    label="Excluir"
                    className="flex-1 md:flex-none px-4 py-2.5 bg-rose-500/10 text-rose-500 rounded-lg text-[10px] font-bold uppercase flex items-center justify-center gap-2 border border-rose-500/30 shadow-md"
                    confirmText="Certeza?"
                  />
                  <button 
                    onClick={() => setShowSettings(true)}
                    className="p-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-slate-300 transition-colors"
                    title="Configurações Studio"
                  >
                    <Settings size={16} />
                  </button>
                </div>
              </header>

              <div className="flex-1 overflow-y-auto lg:scrollbar-hide space-y-3 pr-2">
                {activeProject.scenes.map((scene, i) => (
                  <div key={i} className={`p-4 rounded-xl border transition-all ${currentSceneIndex === i && isPlaying ? 'bg-indigo-900/20 border-indigo-500' : 'bg-slate-950/50 border-slate-800'}`}>
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-tighter">Cena {i + 1}</span>
                      <div className="flex gap-2">
                        {scene.assetUrl && (
                          <div className="flex gap-1">
                            <span className="text-[8px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold uppercase">{scene.assetType === 'video' ? 'Vídeo Pronto' : 'Imagem Pronta'}</span>
                            <button 
                              onClick={() => generateSingleAsset(i)}
                              disabled={scene.isGenerating}
                              className="text-[8px] bg-slate-800 text-slate-400 hover:text-white px-1.5 py-0.5 rounded font-bold uppercase flex items-center gap-1"
                            >
                              <RefreshCw size={8} className={scene.isGenerating ? "animate-spin" : ""} />
                              Refazer
                            </button>
                          </div>
                        )}
                        {scene.isGenerating && (
                          <span className="text-[8px] bg-indigo-500/20 text-indigo-400 px-1.5 py-0.5 rounded font-bold uppercase animate-pulse">Buscando...</span>
                        )}
                        <a href={`https://www.pexels.com/${assetType === 'video' ? 'video/' : ''}search/${encodeURIComponent(scene.visualQuery)}?orientation=${videoFormat === '16:9' ? 'landscape' : 'portrait'}`} target="_blank" rel="noreferrer" className="text-[9px] bg-slate-800 px-2 py-1 rounded hover:bg-emerald-600 transition-colors font-bold text-white uppercase">Pexels</a>
                        <a href={`https://pixabay.com/${assetType === 'video' ? 'videos/' : 'images/'}search/${encodeURIComponent(scene.visualQuery)}?orientation=${videoFormat === '16:9' ? 'horizontal' : 'vertical'}`} target="_blank" rel="noreferrer" className="text-[9px] bg-slate-800 px-2 py-1 rounded hover:bg-sky-600 transition-colors font-bold text-white uppercase">Pixabay</a>
                      </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className={`relative group/img w-full sm:w-32 ${videoFormat === '16:9' ? 'aspect-video' : 'aspect-[9/16]'} rounded-lg overflow-hidden border border-slate-800 bg-black flex-shrink-0`}>
                        {scene.assetUrl ? (
                          <>
                            {scene.assetType === 'video' ? (
                              <video src={scene.assetUrl} className="w-full h-full object-cover" muted loop onMouseEnter={(e) => e.currentTarget.play()} onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }} />
                            ) : (
                              <img src={scene.assetUrl} alt={`Cena ${i+1}`} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                            )}
                            <div className="absolute inset-0 bg-black/60 opacity-100 lg:opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-3">
                              <button onClick={() => window.open(scene.assetUrl, '_blank')} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white backdrop-blur-md border border-white/10"><ExternalLink size={14}/></button>
                              <button onClick={() => generateSingleAsset(i)} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg text-white backdrop-blur-md border border-white/10"><RefreshCw size={14}/></button>
                            </div>
                          </>
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-slate-900/50">
                             {scene.isGenerating ? <div className="w-5 h-5 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" /> : <Video size={18} className="text-slate-700" />}
                          </div>
                        )}
                      </div>
                      <div className="flex-1">
                        <p className="text-[13px] text-slate-300 italic mb-2 leading-relaxed">"{scene.text}"</p>
                        <div className="text-[9px] text-slate-500 font-mono flex items-center justify-between bg-black/40 p-2 rounded border border-slate-800/30">
                          <span className="truncate max-w-[150px] sm:max-w-[200px]">Prompt: {scene.visualQuery}</span>
                          <span className="flex-shrink-0 font-bold">~{scene.duration}s</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="w-full lg:w-96 flex flex-col gap-4">
              <div className={`w-full ${videoFormat === '16:9' ? 'aspect-video' : 'aspect-[9/16] h-[600px] mx-auto'} glass rounded-2xl border border-slate-700/50 overflow-hidden relative group bg-black shadow-2xl`}>
                {activeProject.scenes[currentSceneIndex]?.assetUrl ? (
                   activeProject.scenes[currentSceneIndex].assetType === 'video' ? (
                     <video 
                       key={currentSceneIndex}
                       src={activeProject.scenes[currentSceneIndex].assetUrl}
                       className="w-full h-full object-cover transition-opacity duration-500"
                       autoPlay
                       muted
                       loop
                     />
                   ) : (
                    <img 
                      key={currentSceneIndex}
                      src={activeProject.scenes[currentSceneIndex].assetUrl}
                      alt="preview"
                      className="w-full h-full object-cover transition-opacity duration-500"
                      referrerPolicy="no-referrer"
                    />
                   )
                ) : (
                  <img 
                    key={currentSceneIndex}
                    src={`https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&q=80&w=800&q=80&sig=${activeProject.scenes[currentSceneIndex].visualQuery.replace(/\s/g, '')}`}
                    alt="preview"
                    className="w-full h-full object-cover opacity-40 mix-blend-screen transition-opacity duration-1000"
                    onError={(e) => { e.currentTarget.src = "https://images.unsplash.com/photo-1620121692029-d088224ddc74?auto=format&fit=crop&q=80&w=800"; }}
                  />
                )}
                
                <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-gradient-to-t from-slate-950 via-transparent to-transparent">
                  <motion.p 
                    key={currentSceneIndex}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-sm sm:text-base font-bold text-white italic drop-shadow-lg leading-relaxed px-4 text-center"
                  >
                    {activeProject.scenes[currentSceneIndex].text}
                  </motion.p>
                </div>

                <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 transition-all duration-300" style={{ width: `${((currentSceneIndex + 1) / activeProject.scenes.length) * 100}%` }} />
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`w-full py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg transition-all ${isPlaying ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-900/20' : 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-900/20'}`}
                >
                  {isPlaying ? <Pause size={20}/> : <Play size={20}/>}
                  {isPlaying ? "PAUSAR PREVIEW" : "ASSISTIR VÍDEO COMPLETO"}
                </button>
                <div className="p-4 glass rounded-xl">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Workspace v1.8 ✅ - Studio Advanced</h4>
                  <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">
                    Sincronização total. Suporte para Pixabay e exportação detalhada. Treinamento de nicho aprimorado para v1.8.
                  </p>
                  <div className="flex gap-2">
                    <button 
                      onClick={exportToDesktop}
                      className="flex-1 py-2 bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 rounded-lg text-[10px] font-bold hover:bg-indigo-500 hover:text-white transition-all uppercase"
                    >
                      Exportar p/ Desktop
                    </button>
                    <button 
                      onClick={() => setShowSettings(true)}
                      className="flex-1 py-2 bg-slate-800 border border-slate-700 text-slate-400 rounded-lg text-[10px] font-bold hover:bg-slate-700 transition-all uppercase"
                    >
                      Configurações
                    </button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>

      <AnimatePresence>
        {showSettings && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-2xl"
            >
              <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-2">
                      <div className="p-2 bg-indigo-500/20 rounded-lg text-indigo-400">
                          <Settings size={20}/>
                      </div>
                      <h3 className="text-lg font-bold text-white">Studio v1.8 Advanced</h3>
                  </div>
                  <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 transition-colors group">
                      <X size={20} className="group-hover:rotate-90 transition-transform"/>
                  </button>
              </div>

              <div className="space-y-6 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-3">Fonte de Mídia</label>
                    <div className="flex flex-col gap-2">
                      {['ai', 'deepai'].map(src => (
                        <button 
                          key={src}
                          onClick={() => setImageSource(src as any)}
                          className={`py-2 px-3 rounded-xl border font-bold text-[10px] uppercase transition-all text-left flex items-center justify-between ${imageSource === src ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                        >
                          {src === 'ai' ? 'Inteligência Artificial (Grátis)' : 'DeepAI (Premium)'}
                          {imageSource === src && <Check size={12}/>}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-3">Tipo de Mídia / Formato</label>
                    <div className="flex flex-col gap-2">
                      {['image', 'video'].map(type => (
                        <button 
                          key={type}
                          onClick={() => setAssetType(type as any)}
                          className={`py-2 px-3 rounded-xl border font-bold text-[10px] uppercase transition-all text-left flex items-center justify-between ${assetType === type ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                        >
                          {type === 'image' ? 'Fotos/Imagens' : 'Vídeos/Footage'}
                          {assetType === type && <Check size={12}/>}
                        </button>
                      ))}
                    </div>
                    {imageSource === 'ai' && assetType === 'video' && (
                      <p className="text-[9px] text-amber-500 mt-2 font-bold uppercase animate-pulse leading-tight">AI Gerará Fotos (Padrão)</p>
                    )}
                    {imageSource === 'deepai' && assetType === 'video' && (
                      <p className="text-[9px] text-emerald-500 mt-2 font-bold uppercase leading-tight">DeepAI gerará vídeos reais com IA!</p>
                    )}
                  </div>
                </div>

                <div className="p-4 bg-slate-950/50 rounded-2xl border border-slate-800">
                  <label className="text-[10px] font-bold text-indigo-400 uppercase block mb-4 flex items-center gap-2">
                    <Video size={12} />
                    Proporção do Vídeo (Aspect Ratio)
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    {['16:9', '9:16'].map(format => (
                      <button 
                        key={format}
                        onClick={() => setVideoFormat(format as any)}
                        className={`py-3 px-4 rounded-xl border font-bold text-[11px] uppercase transition-all flex flex-col items-center justify-center gap-2 ${videoFormat === format ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20 scale-[1.02]' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'}`}
                      >
                        <div className={`border-2 ${videoFormat === format ? 'border-white' : 'border-slate-600'} rounded shadow-inner ${format === '16:9' ? 'w-10 h-6' : 'w-6 h-10'}`} />
                        <span className="text-center">
                          {format === '16:9' ? '16:9 (Horizontal)' : '9:16 (Vertical)'}
                        </span>
                        {videoFormat === format && <Check size={12} className="mt-1"/>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="p-4 bg-slate-950/40 rounded-2xl border border-slate-800/80 space-y-3">
                  <label className="text-[10px] text-indigo-400 block uppercase tracking-wider font-bold">
                    Estilo de Consistência das Imagens
                  </label>
                  <p className="text-[9px] text-slate-500 uppercase font-semibold leading-tight mb-1">
                    Defina o estilo visual para a geração de imagens:
                  </p>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      {
                        id: 'A',
                        title: 'Opção A: Cartoon 2D Vetorial',
                        desc: 'Formas geométricas limas, cores vibrantes, perfeito para canais de curiosidades rápidas.'
                      },
                      {
                        id: 'B',
                        title: 'Opção B: Cartoon 3D Volumétrico (Pixar)',
                        desc: 'Estilo Disney Pixar, relevo de massinha, render amigável, ótima retenção infantil/jovem.'
                      },
                      {
                        id: 'C',
                        title: 'Opção C: Ilustração Infantil Flat',
                        desc: 'Texturas sutis de giz/acrílico, tons pastéis, ideal para fábulas e storytelling emotivo.'
                      }
                    ].map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => setImageStyle(opt.id as any)}
                        className={`p-2.5 rounded-xl border text-left transition-all flex flex-col gap-1 cursor-pointer ${imageStyle === opt.id ? 'bg-indigo-950/40 border-indigo-500/80 text-white shadow-lg' : 'bg-slate-900/40 border-slate-800 text-slate-400 hover:border-slate-700'}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold ${imageStyle === opt.id ? 'text-indigo-400' : 'text-slate-300'}`}>
                            {opt.title}
                          </span>
                          <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${imageStyle === opt.id ? 'border-indigo-400 bg-indigo-500/20' : 'border-slate-600'}`}>
                            {imageStyle === opt.id && <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />}
                          </div>
                        </div>
                        <span className="text-[8.5px] leading-relaxed text-slate-500 font-medium">
                          {opt.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {imageSource === 'ai' && (
                  <div>
                     <label className="text-[10px] font-bold text-slate-500 uppercase block mb-3">Modelo AI (Pollinations)</label>
                     <div className="grid grid-cols-3 gap-2">
                       {['flux', 'turbo', 'sana'].map(m => (
                          <button 
                           key={m}
                           onClick={() => setImageModel(m as any)}
                           className={`py-2 rounded-lg border font-bold text-[10px] uppercase transition-all ${imageModel === m ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                          >
                            {m}
                          </button>
                       ))}
                     </div>
                  </div>
                )}

                {imageSource !== 'ai' && (
                  <div className="p-4 bg-slate-950/40 rounded-xl border border-slate-800 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-1">Busca Inteligente (Gemini AI)</h4>
                      <p className="text-[10px] text-slate-500 max-w-[200px] sm:max-w-xs">Analisa o contexto do roteiro para gerar termos de busca enriquecidos e otimizados.</p>
                    </div>
                    <button 
                      onClick={() => setSmartSearch(!smartSearch)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${smartSearch ? 'bg-indigo-600' : 'bg-slate-700'}`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${smartSearch ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                  </div>
                )}

                {imageSource === 'deepai' && (
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase block">Chave da API do DeepAI</label>
                    <input 
                      type="password"
                      value={deepaiKey}
                      onChange={(e) => setDeepaiKey(e.target.value)}
                      placeholder="Insira sua chave DeepAI..."
                      className="w-full bg-slate-950 border border-slate-800 p-3 rounded-xl text-sm text-white outline-none focus:border-indigo-500"
                    />
                    <p className="text-[9px] text-slate-500 font-medium">Insira sua chave da API do deepai.org para gerar imagens ou vídeos realistas automaticamente.</p>
                  </div>
                )}

                <button 
                  onClick={() => setShowSettings(false)}
                  className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-sm font-bold text-white shadow-lg shadow-indigo-600/20"
                >
                  Salvar Configurações
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SEOTab({ history, onDelete, user }: { history: any[], onDelete: (id: string) => void, user: User | null }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [generatingThumb, setGeneratingThumb] = useState(false);
  const [thumbUrl, setThumbUrl] = useState('');
  const [customThumbPrompt, setCustomThumbPrompt] = useState('');
  const [showHistory, setShowHistory] = useState(false);

  const handleGenerateSEO = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const data = await generateSEOMetadata(content);
      const seoItem = {
        ...data,
        id: crypto.randomUUID(),
        content,
        createdAt: Date.now()
      };
      
      setMetadata(seoItem);
      setCustomThumbPrompt(data.thumbnailPrompt);
      setThumbUrl('');

      // Save to Firebase or LocalStorage
      if (user) {
        await setDoc(doc(db, 'users', user.uid, 'seo', seoItem.id), seoItem);
      } else {
        const saved = localStorage.getItem('psycho_seo');
        const current = saved ? JSON.parse(saved) : [];
        localStorage.setItem('psycho_seo', JSON.stringify([seoItem, ...current]));
      }
    } catch (e) {
      alert("Erro ao gerar SEO.");
    } finally {
      setLoading(false);
    }
  };

  const selectFromHistory = (item: any) => {
    setMetadata(item);
    setContent(item.content);
    setThumbUrl(item.thumbUrl || '');
    setCustomThumbPrompt(item.thumbnailPrompt);
    setShowHistory(false);
  };

  const handleGenerateThumb = async () => {
    const promptToUse = customThumbPrompt || (metadata?.thumbnailPrompt);
    if (!promptToUse) return;
    
    setGeneratingThumb(true);
    try {
      const prompt = encodeURIComponent(promptToUse);
      // Use 16:9 for thumbnails
      const url = `https://image.pollinations.ai/prompt/${prompt}?nologo=true&model=flux&width=1280&height=720&seed=${Math.floor(Math.random() * 1000000)}`;
      setThumbUrl(url);
      
      // Update metadata with thumbUrl if exists
      if (metadata) {
        const updated = { ...metadata, thumbUrl: url };
        setMetadata(updated);
        
        // Sync to cloud if exists
        if (user) {
          await setDoc(doc(db, 'users', user.uid, 'seo', metadata.id), updated, { merge: true });
        }
      }
      
      // Simulating loading for AI image feedback
      await new Promise(r => setTimeout(r, 3000));
    } finally {
      setGeneratingThumb(false);
    }
  };

  const downloadThumb = async () => {
    if (!thumbUrl) return;
    try {
      const response = await fetch(`/api/proxy?url=${encodeURIComponent(thumbUrl)}`);
      const blob = await response.blob();
      saveAs(blob, `thumbnail-${Date.now()}.jpg`);
    } catch (e) {
      alert("Erro ao baixar thumbnail.");
    }
  };

  return (
    <div className="flex flex-col gap-6 h-full lg:h-[calc(100vh-3rem)] overflow-y-auto pr-2 custom-scrollbar">
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-2 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-3">
            <Tag className="text-indigo-400" />
            SEO Studio v2.1
            <span className="text-[10px] bg-indigo-500/20 text-indigo-400 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Avançado</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">Estratégias avançadas de YouTube SEO: Títulos Magneticos, Descrições Otimizadas e Capítulos.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button 
            onClick={() => setShowHistory(!showHistory)}
            className={`flex-1 sm:flex-none px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all border flex items-center justify-center gap-2 ${
              showHistory ? 'bg-indigo-500 border-indigo-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
            }`}
          >
            <History size={14} />
            {showHistory ? 'Fechar Histórico' : 'Histórico SEO'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-24 lg:pb-0">
        {showHistory ? (
          <div className="col-span-full space-y-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <History size={16} /> 
              Otimizações Salvas
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {history.length === 0 ? (
                <div className="col-span-full p-8 text-center glass border-dashed border-slate-700 rounded-3xl">
                  <p className="text-slate-500 text-sm italic">Nenhum SEO salvo ainda.</p>
                </div>
              ) : (
                history.map((item) => (
                  <motion.div 
                    key={item.id}
                    layoutId={item.id}
                    className="glass border border-slate-700/50 p-4 rounded-3xl hover:border-indigo-500/30 transition-colors cursor-pointer group flex flex-col gap-3"
                    onClick={() => selectFromHistory(item)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1 overflow-hidden">
                        <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">{new Date(item.createdAt).toLocaleDateString()}</p>
                        <h4 className="text-sm font-bold text-white truncate mt-1">
                          {item.titles?.[0] || 'Sem título'}
                        </h4>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); onDelete(item.id); }}
                        className="p-1.5 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 line-clamp-2 italic">"{item.content}"</p>
                    <div className="mt-auto pt-2 flex items-center justify-between border-t border-slate-700/30">
                      <span className="text-[8px] text-slate-500 uppercase font-bold tracking-widest">
                        {item.keywords?.length || 0} Keywords
                      </span>
                      {item.thumbUrl && (
                        <div className="w-8 h-8 rounded-lg overflow-hidden border border-indigo-500/30">
                          <img src={item.thumbUrl} alt="Thumb" className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            <section className="flex flex-col gap-6">
          <div className="glass p-6 rounded-2xl flex flex-col gap-4 border-indigo-500/10">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              Entrada de Conteúdo
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 mb-2 block uppercase font-bold tracking-widest">Roteiro ou Ideia Base</label>
                <textarea 
                  placeholder="Cole aqui seu roteiro finalizado ou uma ideia detalhada para análise de SEO..." 
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="w-full h-64 p-4 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white resize-none outline-none focus:border-indigo-500/50 transition-all font-medium custom-scrollbar"
                />
              </div>
              <button 
                onClick={handleGenerateSEO}
                disabled={loading || !content}
                className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 rounded-xl font-bold text-sm text-white transition-all shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <RefreshCw size={18} className="animate-spin" /> : <Tag size={18} />}
                {loading ? "Analisando SEO Sênior..." : "Gerar SEO Avançado v2.1"}
              </button>
            </div>
          </div>

          {metadata && (
            <div className="glass p-6 rounded-2xl flex flex-col gap-6 border-indigo-500/10">
              <div>
                <h3 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ExternalLink size={14} />
                  Resultados Meta-Data
                </h3>
                
                <div className="space-y-6">
                  {/* Titles */}
                  <div className="space-y-3">
                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest flex justify-between">
                      Opções de Títulos (High CTR)
                      <span className="text-indigo-400 lowercase font-normal italic">escolha o melhor</span>
                    </label>
                    <div className="space-y-2">
                      {metadata.titles.map((t: string, i: number) => (
                        <div key={i} className="flex items-center gap-2 group">
                          <div className="flex-1 p-3 bg-slate-950/50 border border-slate-800 rounded-xl text-sm text-slate-300 font-bold group-hover:border-indigo-500/30 transition-all">
                            {t}
                          </div>
                          <button onClick={() => copyToClipboard(t)} className="p-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 transition-colors">
                            <Copy size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Combined Description + Hashtags */}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Copiável: Descrição + Hashtags</label>
                      <button 
                        onClick={() => copyToClipboard(`${metadata.description}\n\n${metadata.hashtags.join(' ')}`)} 
                        className="text-[10px] text-indigo-400 hover:underline font-bold uppercase flex items-center gap-1"
                      >
                        <Copy size={12} /> Copiar Bloco SEO
                      </button>
                    </div>
                    <div className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl text-xs text-slate-400 leading-relaxed max-h-64 overflow-y-auto italic custom-scrollbar">
                      <p className="mb-4">{metadata.description}</p>
                      <div className="pt-4 border-t border-slate-800">
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {metadata.hashtags.map((h: string, i: number) => (
                            <span key={i} className="text-indigo-400 font-bold">
                              {h.startsWith('#') ? h : `#${h}`}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Timestamps */}
                  {metadata.timestamps && (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Sugestão de Capítulos (Timestamps)</label>
                        <button onClick={() => copyToClipboard(metadata.timestamps)} className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors">
                          <Copy size={14} />
                        </button>
                      </div>
                      <pre className="p-4 bg-slate-950/50 border border-slate-800 rounded-xl text-[11px] text-emerald-400 font-mono whitespace-pre-wrap leading-relaxed shadow-inner">
                        {metadata.timestamps}
                      </pre>
                    </div>
                  )}

                  {/* Keywords */}
                  <div className="space-y-3">
                    <label className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Mecanismo de SEO (Palavras-Chave)</label>
                    <div className="flex flex-wrap gap-2">
                      {metadata.keywords.map((k: string, i: number) => (
                        <span key={i} className="px-2 py-1 bg-slate-800 text-slate-500 rounded border border-slate-700 font-mono text-[9px] uppercase">
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="flex flex-col gap-6">
          <div className="glass p-6 rounded-2xl flex flex-col gap-5 border-indigo-500/10 h-fit sticky top-0">
             <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
              <Video size={16} className="text-indigo-400" />
              Thumb Studiov2.0 - Hyper Detailed
            </h3>

            <div className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 mb-2 block uppercase font-bold tracking-widest">Thumbnail Prompt (Customizável)</label>
                <textarea 
                  placeholder="Gere o SEO para criar o prompt automaticamente ou escreva aqui..." 
                  value={customThumbPrompt}
                  onChange={(e) => setCustomThumbPrompt(e.target.value)}
                  className="w-full h-32 p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 font-mono resize-none outline-none focus:border-indigo-500/50 transition-all italic leading-relaxed"
                />
              </div>

              <button 
                onClick={handleGenerateThumb}
                disabled={generatingThumb || (!customThumbPrompt && !metadata?.thumbnailPrompt)}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 rounded-xl font-bold text-sm text-white transition-all shadow-lg shadow-emerald-900/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {generatingThumb ? <RefreshCw size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {generatingThumb ? "Renderizando Thumbnail..." : "Gerar Thumbnail High-CTR"}
              </button>

              <div className="aspect-video relative rounded-2xl overflow-hidden border-2 border-slate-800 bg-black shadow-2xl group">
                {thumbUrl ? (
                  <>
                    <img src={thumbUrl} alt="Thumbnail preview" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                      <button onClick={downloadThumb} className="p-4 bg-white text-black rounded-full hover:scale-110 transition-transform shadow-xl">
                        <Download size={24} />
                      </button>
                      <button onClick={handleGenerateThumb} className="p-4 bg-indigo-600 text-white rounded-full hover:scale-110 transition-transform shadow-xl">
                        <RefreshCw size={24} />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-slate-700">
                    <Video size={48} className="opacity-20" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">Aguardando Geração</p>
                  </div>
                )}
                {generatingThumb && (
                  <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-4">
                    <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin" />
                    <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest animate-pulse">Processando v2.0 AI Graphics...</p>
                  </div>
                )}
              </div>

              {thumbUrl && (
                <div className="flex gap-4">
                   <button 
                    onClick={downloadThumb}
                    className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl font-bold text-xs text-white transition-all border border-slate-700 flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    Download Thumbnail
                  </button>
                  <button 
                    onClick={() => copyToClipboard(thumbUrl)}
                    className="px-4 py-3 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-400 border border-slate-700"
                    title="Copiar Link da Imagem"
                  >
                    <ExternalLink size={16} />
                  </button>
                </div>
              )}
            </div>

            <div className="p-4 glass rounded-xl border-dashed border-slate-700/50">
               <h4 className="text-[10px] font-bold text-slate-500 uppercase mb-2 tracking-widest">Dica Estratégica v2.0</h4>
               <p className="text-[11px] text-slate-500 leading-relaxed italic">
                 "O YouTube recompensa a retenção, mas o SEO garante a descoberta. Use títulos que gerem perguntas no cérebro do usuário."
               </p>
            </div>
          </div>
        </section>
          </>
        )}
      </div>
    </div>
  );
}

function LanguageTrainingTab({ 
  localPatterns, 
  globalPatterns, 
  onAdd, 
  onDelete, 
  availableNiches,
  isAdmin,
  currentNiche
}: { 
  localPatterns: LanguagePattern[], 
  globalPatterns: LanguagePattern[],
  onAdd: (pat: any, global?: boolean) => void, 
  onDelete: (id: string, global?: boolean) => void, 
  availableNiches: string[],
  isAdmin: boolean,
  currentNiche: string
}) {
  const [newContent, setNewContent] = useState('');
  const [newStyle, setNewStyle] = useState('');
  const [selectedNiche, setSelectedNiche] = useState(currentNiche || availableNiches[0] || 'Todos');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [filterNiche, setFilterNiche] = useState(currentNiche || 'Todos');
  const [saveToGlobal, setSaveToGlobal] = useState(false);
  const [justAddedId, setJustAddedId] = useState<string | null>(null);

  useEffect(() => {
    if (currentNiche) {
      setSelectedNiche(currentNiche);
      setFilterNiche(currentNiche);
    }
  }, [currentNiche]);

  const handleAutoAnalyze = async () => {
    if (!newContent.trim()) return;
    setIsAnalyzing(true);
    try {
      const result = await analyzeScriptForClassification(newContent);
      setNewStyle(result.style);
      if (availableNiches.includes(result.niche)) {
        setSelectedNiche(result.niche);
      }
    } catch (e) {
      alert("Erro ao analisar padrão de linguagem.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if(!newContent || !newStyle) return;
    const patId = crypto.randomUUID(); // We can't easily get the ID back from onAdd if it's async Firestore, but we can guess or use a temp state
    onAdd({ niche: selectedNiche, style: newStyle, content: newContent }, saveToGlobal);
    
    // UI Feedback
    setNewStyle('');
    setNewContent('');
    setSaveToGlobal(false);
    setFilterNiche(selectedNiche); // Ensure it's visible while keeping focus
    
    // Temporary highlight (we don't have the real ID yet if Firestore, but we can trigger a generic "success" pulse)
    setJustAddedId('new');
    setTimeout(() => setJustAddedId(null), 3000);
  };

  const allPatterns = [
    ...globalPatterns.map(p => ({ ...p, isGlobal: true })),
    ...localPatterns.map(p => ({ ...p, isGlobal: false }))
  ].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  const filteredPatterns = filterNiche === 'Todos' 
    ? allPatterns 
    : allPatterns.filter(p => p.niche === filterNiche || p.niche === 'Todos');

  return (
    <div className="flex flex-col gap-6 h-full lg:h-[calc(100vh-3rem)]">
      <div className="flex items-center justify-between px-2">
        <div>
          <h2 className="text-xl font-bold text-white uppercase tracking-tighter">Engine de Conexão v2.3</h2>
          <div className="flex items-center gap-2 mt-1">
            <div className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
            <p className="text-xs text-slate-400">Focado em autoridade humana e relevância. {isAdmin ? "Administrador GLOBAL." : "Sincronizado Cloud v2.1."}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50">
          <Filter size={14} className="ml-2 text-slate-500" />
          <select 
            value={filterNiche}
            onChange={(e) => setFilterNiche(e.target.value)}
            className="bg-transparent border-none text-[11px] font-bold uppercase tracking-wider text-slate-300 outline-none cursor-pointer pr-3"
          >
            <option value="Todos" className="bg-slate-900">Todos os Nichos</option>
            {availableNiches.map(n => <option key={n} value={n} className="bg-slate-900">{n}</option>)}
          </select>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        <section className="w-full lg:w-96 glass p-6 rounded-2xl flex flex-col gap-5 h-fit border-indigo-500/10">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-indigo-400 flex items-center gap-2">
              <MessageSquareQuote size={16} />
              Novo Padrão de Fala
            </h3>
            <button 
              onClick={handleAutoAnalyze}
              disabled={isAnalyzing || !newContent}
              className="text-[9px] font-bold text-indigo-400 hover:text-white flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-500/10 border border-indigo-500/20 disabled:opacity-50 transition-all uppercase"
             >
               {isAnalyzing ? <RefreshCw size={10} className="animate-spin" /> : <Sparkles size={10} />}
               Auto-Análise
             </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-[10px] text-slate-500 mb-1.5 block uppercase font-bold tracking-widest">Nicho Alvo</label>
              <select 
                value={selectedNiche}
                onChange={(e) => setSelectedNiche(e.target.value)}
                className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500/50 transition-all font-medium appearance-none"
              >
                <option value="Todos">Todos os Nichos (Global)</option>
                {availableNiches.map(n => <option key={n} value={n}>{n}</option>)}
              </select>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 mb-1.5 block uppercase font-bold tracking-widest">Estilo / Tom do Padrão</label>
              <div className="relative">
                <input 
                  placeholder="Ex: Gatilho de Atenção, Ironia..." 
                  value={newStyle}
                  onChange={(e) => setNewStyle(e.target.value)}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white outline-none focus:border-indigo-500/50 transition-all font-medium"
                />
                <Tag size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600" />
              </div>
            </div>

            <div>
              <label className="text-[10px] text-slate-500 mb-1.5 block uppercase font-bold tracking-widest">Diretriz de Linguagem</label>
              <textarea 
                placeholder="Cole um trecho de roteiro ou frase de efeito para a IA aprender o tom..." 
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                className="w-full h-40 p-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white resize-none outline-none focus:border-indigo-500/50 transition-all font-medium"
              />
            </div>

            {isAdmin && (
              <div className="flex items-center gap-3 p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/20">
                <input 
                  type="checkbox" 
                  id="global_lang_save" 
                  checked={saveToGlobal} 
                  onChange={(e) => setSaveToGlobal(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="global_lang_save" className="text-[11px] font-bold text-slate-300 cursor-pointer">
                  SALVAR NA BASE GLOBAL (ADMIN)
                </label>
              </div>
            )}

            <button 
              onClick={handleSave}
              className="w-full py-4 bg-indigo-600 rounded-xl font-bold text-sm hover:bg-indigo-500 transition-all text-white shadow-lg shadow-indigo-600/20 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={16} />
              Salvar Padrão
            </button>
          </div>
        </section>

        <section className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4 pb-24 lg:pb-0 pr-2 scrollbar-hide">
          <div className="flex items-center gap-2 mb-2 px-1">
            <Languages size={14} className="text-indigo-400" />
            <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Padrões de Linguagem Registrados</h4>
            <div className="flex-1 h-[1px] bg-slate-800/50 ml-2" />
          </div>
          {filteredPatterns.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
              <Languages size={32} className="text-slate-800 mb-2" />
              <p className="text-slate-600 text-sm font-medium">Nenhum padrão cadastrado</p>
            </div>
          ) : (
            filteredPatterns.map((pat, index) => (
              <div key={pat.id} className={`p-5 glass rounded-2xl border group hover:border-indigo-500/40 transition-all ${pat.isGlobal ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-slate-900/10 border-slate-800/50'} ${(index === 0 && justAddedId === 'new') ? 'ring-2 ring-indigo-500/50 border-indigo-500 animate-pulse' : ''}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/30">
                       <Brain size={12} className="text-indigo-400" />
                       <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest">{pat.niche}</span>
                    </div>
                    {pat.isGlobal && (
                      <div className="flex items-center gap-2 bg-emerald-500/20 px-2.5 py-1 rounded-lg border border-emerald-500/30">
                         <Globe size={11} className="text-emerald-400" />
                         <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest">Global</span>
                      </div>
                    )}
                    {(index === 0 && justAddedId === 'new') && (
                      <div className="bg-indigo-500 text-white px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase animate-bounce flex items-center gap-2">
                        <Sparkles size={10} />
                        Recém Adicionado
                      </div>
                    )}
                    <div className="flex items-center gap-2 bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-700">
                       <Tag size={12} className="text-slate-400" />
                       <h4 className="text-[10px] font-bold text-slate-300 uppercase tracking-tight">{pat.style}</h4>
                    </div>
                  </div>
                  {(isAdmin || !pat.isGlobal) && (
                    <ConfirmButton 
                      onConfirm={() => onDelete(pat.id, pat.isGlobal)}
                      icon={Trash2}
                      className="relative z-20 p-3 text-rose-500 bg-rose-500/10 rounded-xl border border-rose-500/20 flex items-center justify-center min-w-[44px] min-h-[44px] active:scale-95 touch-manipulation shadow-lg"
                      confirmText="Excluir?"
                    />
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <MessageSquareQuote size={12} className="text-slate-500" />
                    <h5 className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Roteiro Originário:</h5>
                  </div>
                  <p className="text-[13px] text-slate-300 leading-relaxed italic border-l-2 border-indigo-500/30 pl-4 bg-slate-900/40 p-4 rounded-r-xl shadow-inner">"{pat.content}"</p>
                </div>
                <div className="mt-4 flex justify-between items-center border-t border-slate-800/50 pt-3">
                   <div className="flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                     <span className="text-[9px] text-slate-600 font-mono italic uppercase tracking-tighter">ID: {pat.id.slice(0, 8)}</span>
                   </div>
                   <span className="text-[9px] text-slate-600 font-mono italic">Adicionado em {new Date(pat.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </div>
  );
}

