import React, { useState, useEffect } from "react";
import { 
  Search, 
  Plus, 
  Trash2, 
  Edit2, 
  Shield, 
  User, 
  Sparkles, 
  Loader2,
  ChevronRight,
  Info,
  X,
  Camera,
  Upload
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PokemonStatus {
  hp: number;
  attack: number;
  defense: number;
}

interface Pokemon {
  id?: number;
  nome: string;
  tipos: string[];
  status: PokemonStatus;
  descricao: string;
  image_url?: string;
}

type Profile = "Usuário" | "Gestão";

export default function App() {
  const [profile, setProfile] = useState<Profile>("Usuário");
  const [pokemons, setPokemons] = useState<Pokemon[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedPokemon, setSelectedPokemon] = useState<Pokemon | null>(null);
  const [aiDetails, setAiDetails] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Pokemon>({
    nome: "",
    tipos: [],
    status: { hp: 0, attack: 0, defense: 0 },
    descricao: "",
    image_url: ""
  });

  useEffect(() => {
    fetchPokemons();
  }, []);

  const fetchPokemons = async () => {
    const res = await fetch("/api/pokemon");
    const data = await res.json();
    setPokemons(data.pokedex_data);
  };

  const handleSearch = () => {
    return pokemons.filter(p => 
      p.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.tipos.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  };

  const getAiDetails = async (pokemon: Pokemon) => {
    setIsAiLoading(true);
    setAiDetails(null);
    try {
      const res = await fetch("/api/ai/details", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: pokemon.nome })
      });
      const data = await res.json();
      setAiDetails(data.text);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSuggest = async () => {
    if (!editForm.nome) return;
    setIsAiLoading(true);
    try {
      const res = await fetch("/api/ai/suggest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nome: editForm.nome })
      });
      const data = await res.json();
      setEditForm(prev => ({
        ...prev,
        tipos: data.tipos,
        status: data.status,
        descricao: data.descricao
      }));
    } catch (error) {
      console.error(error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result as string;
      setEditForm(prev => ({ ...prev, image_url: base64String }));
      
      setIsAiLoading(true);
      try {
        const res = await fetch("/api/ai/analyze-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64String })
        });
        const data = await res.json();
        setEditForm(prev => ({
          ...prev,
          nome: data.nome,
          tipos: data.tipos,
          status: data.status,
          descricao: data.descricao_ia
        }));
      } catch (error) {
        console.error(error);
      } finally {
        setIsAiLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const method = editForm.id ? "PUT" : "POST";
    const url = editForm.id ? `/api/pokemon/${editForm.id}` : "/api/pokemon";
    
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm)
    });
    
    const data = await res.json();
    
    if (data.action === "CLOSE_MODAL" && data.status === "SUCCESS") {
      setPokemons(data.updated_pokedex);
      setIsEditing(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (profile !== "Gestão") return;
    const res = await fetch(`/api/pokemon/${id}`, { method: "DELETE" });
    const data = await res.json();
    setPokemons(data.pokedex_data);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-900/20">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight">Pokédex <span className="text-emerald-500 italic">Inteligente</span></h1>
          </div>

          <div className="flex items-center gap-2 bg-zinc-800 p-1 rounded-full border border-zinc-700">
            <button 
              onClick={() => setProfile("Usuário")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${profile === "Usuário" ? "bg-emerald-600 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              <User className="w-4 h-4" /> Usuário
            </button>
            <button 
              onClick={() => setProfile("Gestão")}
              className={`flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${profile === "Gestão" ? "bg-emerald-600 text-white shadow-md" : "text-zinc-400 hover:text-zinc-200"}`}
            >
              <Shield className="w-4 h-4" /> Gestão
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Search & Actions */}
        <div className="flex flex-col md:flex-row gap-4 mb-8">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text"
              placeholder="Buscar por nome ou tipo..."
              className="w-full bg-zinc-900 border border-zinc-800 rounded-2xl py-3 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          {profile === "Gestão" && (
            <button 
              onClick={() => {
                setEditForm({ nome: "", tipos: [], status: { hp: 0, attack: 0, defense: 0 }, descricao: "" });
                setIsEditing(true);
              }}
              className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-3 rounded-2xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-emerald-900/20"
            >
              <Plus className="w-5 h-5" /> Novo Pokémon
            </button>
          )}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          <AnimatePresence mode="popLayout">
            {handleSearch().map((pokemon) => (
              <motion.div
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                key={pokemon.id}
                className="bg-zinc-900 border border-zinc-800 rounded-3xl overflow-hidden hover:border-emerald-500/50 transition-all group relative"
              >
                {pokemon.image_url && (
                  <div className="h-48 w-full overflow-hidden bg-zinc-950 relative">
                    <img 
                      src={pokemon.image_url} 
                      alt={pokemon.nome}
                      className="w-full h-full object-contain p-4 group-hover:scale-110 transition-transform duration-500"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 to-transparent opacity-60" />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <span className="text-xs font-mono text-zinc-500 uppercase tracking-widest">#{pokemon.id?.toString().padStart(3, '0')}</span>
                      <h3 className="text-xl font-bold text-white group-hover:text-emerald-400 transition-colors">{pokemon.nome}</h3>
                    </div>
                    <div className="flex gap-2">
                      {pokemon.tipos.map(tipo => (
                        <span key={tipo} className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded-lg text-[10px] font-bold uppercase text-zinc-400">
                          {tipo}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mb-6">
                    <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-800/50">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">HP</p>
                      <p className="text-sm font-mono text-emerald-400">{pokemon.status.hp}</p>
                    </div>
                    <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-800/50">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">ATK</p>
                      <p className="text-sm font-mono text-orange-400">{pokemon.status.attack}</p>
                    </div>
                    <div className="bg-zinc-950/50 p-2 rounded-xl border border-zinc-800/50">
                      <p className="text-[10px] text-zinc-500 uppercase font-bold mb-1">DEF</p>
                      <p className="text-sm font-mono text-blue-400">{pokemon.status.defense}</p>
                    </div>
                  </div>

                  <p className="text-sm text-zinc-400 line-clamp-2 mb-6 italic">"{pokemon.descricao}"</p>

                  <div className="flex gap-2">
                    <button 
                      onClick={() => {
                        setSelectedPokemon(pokemon);
                        getAiDetails(pokemon);
                      }}
                      className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all"
                    >
                      <Sparkles className="w-4 h-4 text-emerald-500" /> Ver Lore
                    </button>
                    {profile === "Gestão" && (
                      <>
                        <button 
                          onClick={() => {
                            setEditForm(pokemon);
                            setIsEditing(true);
                          }}
                          className="p-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-xl transition-all"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(pokemon.id!)}
                          className="p-2.5 bg-zinc-800 hover:bg-red-900/30 text-zinc-200 hover:text-red-400 rounded-xl transition-all"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Lore Modal */}
      <AnimatePresence>
        {selectedPokemon && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPokemon(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[2rem] overflow-hidden relative shadow-2xl"
            >
              <button 
                onClick={() => setSelectedPokemon(null)}
                className="absolute top-6 right-6 p-2 hover:bg-zinc-800 rounded-full transition-colors z-10"
              >
                <X className="w-6 h-6" />
              </button>
              
              <div className="p-8 md:p-12">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-emerald-600/20 rounded-2xl flex items-center justify-center">
                    <Sparkles className="w-8 h-8 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-3xl font-bold text-white">{selectedPokemon.nome}</h2>
                    <p className="text-zinc-500 font-mono">Lore Inteligente via Gemini AI</p>
                  </div>
                </div>

                <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl p-6 min-h-[200px] relative">
                  {isAiLoading ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                      <Loader2 className="w-8 h-8 text-emerald-500 animate-spin" />
                      <p className="text-zinc-500 text-sm animate-pulse">Consultando o lore oficial...</p>
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none text-zinc-300 leading-relaxed">
                      {aiDetails?.split('\n').map((line, i) => (
                        <p key={i} className="mb-4 last:mb-0">{line}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Admin Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsEditing(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-[2rem] overflow-hidden relative shadow-2xl"
            >
              <div className="p-8">
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  {editForm.id ? <Edit2 className="w-6 h-6 text-emerald-500" /> : <Plus className="w-6 h-6 text-emerald-500" />}
                  {editForm.id ? "Editar Pokémon" : "Novo Pokémon"}
                </h2>

                <div className="space-y-4">
                  <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-950/50 hover:border-emerald-500/50 transition-colors relative group">
                    {editForm.image_url ? (
                      <div className="relative w-full aspect-video rounded-xl overflow-hidden">
                        <img src={editForm.image_url} className="w-full h-full object-contain" alt="Preview" referrerPolicy="no-referrer" />
                        <button 
                          onClick={() => setEditForm(prev => ({ ...prev, image_url: "" }))}
                          className="absolute top-2 right-2 p-1 bg-black/50 rounded-full hover:bg-red-500 transition-colors"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center gap-2 cursor-pointer w-full py-4">
                        <Upload className="w-8 h-8 text-zinc-500 group-hover:text-emerald-500 transition-colors" />
                        <span className="text-sm text-zinc-500 font-medium">Upload de Imagem (Visão IA)</span>
                        <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                      </label>
                    )}
                    {isAiLoading && (
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-2 rounded-2xl">
                        <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
                        <span className="text-xs text-emerald-500 font-bold animate-pulse">Analisando Pokémon...</span>
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Nome do Pokémon</label>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        value={editForm.nome}
                        onChange={(e) => setEditForm({ ...editForm, nome: e.target.value })}
                      />
                      <button 
                        onClick={handleSuggest}
                        disabled={!editForm.nome || isAiLoading}
                        className="bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-emerald-500 px-4 rounded-xl transition-all flex items-center gap-2 font-semibold"
                      >
                        {isAiLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Sparkles className="w-5 h-5" />}
                        Sugerir
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">HP</label>
                      <input 
                        type="number"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        value={editForm.status.hp}
                        onChange={(e) => setEditForm({ ...editForm, status: { ...editForm.status, hp: parseInt(e.target.value) || 0 } })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Ataque</label>
                      <input 
                        type="number"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        value={editForm.status.attack}
                        onChange={(e) => setEditForm({ ...editForm, status: { ...editForm.status, attack: parseInt(e.target.value) || 0 } })}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Defesa</label>
                      <input 
                        type="number"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                        value={editForm.status.defense}
                        onChange={(e) => setEditForm({ ...editForm, status: { ...editForm.status, defense: parseInt(e.target.value) || 0 } })}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Tipos (separados por vírgula)</label>
                    <input 
                      type="text"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      value={editForm.tipos.join(", ")}
                      onChange={(e) => setEditForm({ ...editForm, tipos: e.target.value.split(",").map(t => t.trim()).filter(t => t) })}
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-zinc-500 uppercase mb-2">Descrição</label>
                    <textarea 
                      rows={3}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl py-3 px-4 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                      value={editForm.descricao}
                      onChange={(e) => setEditForm({ ...editForm, descricao: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-4 mt-8">
                  <button 
                    onClick={() => setIsEditing(false)}
                    className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 py-3 rounded-xl font-semibold transition-all"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSave}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-3 rounded-xl font-semibold transition-all shadow-lg shadow-emerald-900/20"
                  >
                    Salvar Pokémon
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
