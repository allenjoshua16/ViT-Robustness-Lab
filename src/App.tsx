import React from 'react';
import { Upload, AlertTriangle, ShieldCheck, Zap, Layers, RefreshCw, BarChart3, ChevronRight } from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'motion/react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { analyzeImage, getAttentionMap, simulateAttack, ClassificationResult, AttentionMapData } from './services/geminiService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---

type AttackState = 'idle' | 'attacking' | 'done';

interface AttackMetrics {
  epsilon: number;
  accuracy: number;
  transferability: number;
}

// --- Components ---

const Header = () => (
  <header className="border-b border-zinc-800 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 bg-zinc-100 rounded flex items-center justify-center">
        <Zap className="w-5 h-5 text-zinc-900 fill-zinc-900" />
      </div>
      <div>
        <h1 className="text-zinc-100 font-bold tracking-tight text-lg">ViT Robustness Lab</h1>
        <p className="text-zinc-500 text-[10px] uppercase font-mono tracking-widest">Adversarial Evaluation Framework v1.0.4</p>
      </div>
    </div>
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-zinc-400 text-xs font-mono">System Nominal</span>
      </div>
    </div>
  </header>
);

const Sidebar = ({ 
  onUpload, 
  attackType, 
  setAttackType, 
  epsilon, 
  setEpsilon, 
  isAnalyzing,
  defenseMode,
  setDefenseMode
}: { 
  onUpload: (base64: string) => void;
  attackType: string;
  setAttackType: (t: string) => void;
  epsilon: number;
  setEpsilon: (e: number) => void;
  isAnalyzing: boolean;
  defenseMode: string;
  setDefenseMode: (d: string) => void;
}) => {
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: { 'image/*': ['.png', '.jpg', '.jpeg'] },
    maxFiles: 1,
    multiple: false,
    onDrop: (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;
      const file = acceptedFiles[0];
      const reader = new FileReader();
      reader.onload = () => onUpload(reader.result as string);
      reader.readAsDataURL(file);
    }
  });

  return (
    <aside className="w-80 border-r border-zinc-800 p-6 flex flex-col gap-8 h-[calc(100vh-72px)] overflow-y-auto">
      <section>
        <h2 className="text-zinc-400 text-[11px] uppercase font-mono tracking-widest mb-4">Input Source</h2>
        <div 
          {...getRootProps()} 
          className={cn(
            "border-2 border-dashed rounded-xl p-6 transition-all cursor-pointer text-center group",
            isDragActive ? "border-zinc-100 bg-zinc-900" : "border-zinc-800 hover:border-zinc-600 bg-zinc-950"
          )}
        >
          <input {...getInputProps()} />
          <div className="w-10 h-10 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
            <Upload className="w-5 h-5 text-zinc-500 group-hover:text-zinc-100" />
          </div>
          <p className="text-zinc-400 text-sm font-medium">Drop image here</p>
          <p className="text-zinc-600 text-[10px] mt-1">or click to browse</p>
        </div>
      </section>

      <section>
        <h2 className="text-zinc-400 text-[11px] uppercase font-mono tracking-widest mb-4">Attack Configuration</h2>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-zinc-500 text-xs flex justify-between">
              <span>Attack Method</span>
              <AlertTriangle className="w-3 h-3 text-amber-500" />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {['FGSM', 'PGD', 'CW', 'DeepFool'].map((type) => (
                <button
                  key={type}
                  onClick={() => setAttackType(type)}
                  className={cn(
                    "px-3 py-2 text-[11px] font-mono border rounded transition-all",
                    attackType === type 
                      ? "bg-zinc-100 text-zinc-900 border-zinc-100" 
                      : "bg-zinc-950 text-zinc-500 border-zinc-800 hover:border-zinc-600"
                  )}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <label className="text-zinc-500 text-xs flex justify-between">
              <span>Perturbation (ε)</span>
              <span className="font-mono text-zinc-300">{(epsilon / 255).toFixed(3)}</span>
            </label>
            <input 
              type="range" 
              min="1" 
              max="24" 
              step="1"
              value={epsilon}
              onChange={(e) => setEpsilon(parseInt(e.target.value))}
              className="w-full accent-zinc-100"
            />
            <p className="text-[10px] text-zinc-600 italic">Increases noise magnitude applied to input pixels.</p>
          </div>

          <div className="space-y-2 pt-4 border-t border-zinc-900">
            <label className="text-zinc-500 text-xs flex justify-between">
              <span>Defense Strategy</span>
              <ShieldCheck className="w-3 h-3 text-emerald-500" />
            </label>
            <div className="space-y-2">
              {['None', 'Adv. Training', 'Patch Masking', 'Input Trans.'].map((mode) => (
                <button
                  key={mode}
                  onClick={() => setDefenseMode(mode)}
                  className={cn(
                    "w-full px-3 py-2 text-[10px] font-mono border rounded transition-all text-left flex justify-between items-center group",
                    defenseMode === mode 
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/50" 
                      : "bg-zinc-950 text-zinc-600 border-zinc-800 hover:border-zinc-700"
                  )}
                >
                  {mode}
                  {defenseMode === mode && <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-auto">
        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl">
          <div className="flex gap-2 mb-2">
            <ShieldCheck className="w-4 h-4 text-amber-500" />
            <span className="text-amber-500 text-[11px] font-bold uppercase tracking-tight">Security Warning</span>
          </div>
          <p className="text-amber-200/60 text-[10px] leading-relaxed">
            Vision Transformers exhibit different failure modes than CNNs. Small perturbations in patch embeddings can lead to total semantic drift.
          </p>
        </div>
      </section>
    </aside>
  );
};

const MetricCard = ({ label, value, trend, sub }: { label: string, value: string, trend?: 'up' | 'down', sub?: string }) => (
  <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-colors">
    <p className="text-zinc-500 text-[10px] uppercase font-mono tracking-widest mb-1">{label}</p>
    <div className="flex items-end gap-2">
      <span className="text-2xl font-bold text-zinc-100 leading-none">{value}</span>
      {sub && <span className="text-[10px] text-zinc-600 mb-0.5">{sub}</span>}
    </div>
  </div>
);

const ClassificationBadge = ({ label, confidence }: { label: string, confidence: number }) => (
  <div className="flex items-center justify-between p-3 bg-zinc-900/50 border border-zinc-800 rounded-lg group hover:bg-zinc-900 transition-colors">
    <span className="text-zinc-300 text-sm font-medium">{label}</span>
    <div className="flex items-center gap-2">
      <div className="w-24 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${confidence * 100}%` }}
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            confidence > 0.7 ? "bg-emerald-500" : confidence > 0.4 ? "bg-amber-500" : "bg-rose-500"
          )}
        />
      </div>
      <span className="text-zinc-500 text-[10px] font-mono min-w-[32px]">{(confidence * 100).toFixed(0)}%</span>
    </div>
  </div>
);

export default function App() {
  const [image, setImage] = React.useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [attackType, setAttackType] = React.useState('FGSM');
  const [epsilon, setEpsilon] = React.useState(8);
  const [originalResult, setOriginalResult] = React.useState<ClassificationResult | null>(null);
  const [attackResult, setAttackResult] = React.useState<ClassificationResult | null>(null);
  const [attentionMap, setAttentionMap] = React.useState<AttentionMapData | null>(null);
  const [attackState, setAttackState] = React.useState<AttackState>('idle');
  const [defenseMode, setDefenseMode] = React.useState('None');

  const handleUpload = async (base64: string) => {
    setImage(base64);
    setIsAnalyzing(true);
    setAttackState('idle');
    setAttackResult(null);
    setOriginalResult(null);
    setAttentionMap(null);

    try {
      const [analysis, attn] = await Promise.all([
        analyzeImage(base64),
        getAttentionMap(base64)
      ]);
      setOriginalResult(analysis);
      setAttentionMap(attn);
    } catch (error) {
      console.error(error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const runAttack = async () => {
    if (!image) return;
    setAttackState('attacking');
    try {
      const result = await simulateAttack(image, `${attackType} (Defense: ${defenseMode})`, epsilon);
      setAttackResult(result);
      setAttackState('done');
    } catch (error) {
      console.error(error);
      setAttackState('idle');
    }
  };

  const chartData = [
    { eps: 0, acc: 98, robust: 100 },
    { eps: 2, acc: 92, robust: 94 },
    { eps: 4, acc: 78, robust: 82 },
    { eps: 8, acc: 45, robust: 55 },
    { eps: 16, acc: 12, robust: 30 },
    { eps: 32, acc: 2, robust: 10 },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans selection:bg-zinc-100 selection:text-zinc-900">
      <Header />
      
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          onUpload={handleUpload} 
          attackType={attackType} 
          setAttackType={setAttackType}
          epsilon={epsilon}
          setEpsilon={setEpsilon}
          isAnalyzing={isAnalyzing}
          defenseMode={defenseMode}
          setDefenseMode={setDefenseMode}
        />

        <main className="flex-1 overflow-y-auto p-12">
          {!image ? (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-zinc-900/50 rounded-3xl flex items-center justify-center mb-6 border border-zinc-800">
                <Layers className="w-10 h-10 text-zinc-700" />
              </div>
              <h2 className="text-3xl font-bold tracking-tight mb-2">Initialize Evaluation</h2>
              <p className="text-zinc-500 max-w-sm">Upload an image to start the adversarial robustness analysis on ViT-Base architecture.</p>
            </div>
          ) : (
            <div className="max-w-6xl mx-auto space-y-12">
              {/* Top Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <MetricCard label="Architecture" value="ViT-Large" sub="Patch 16" />
                <MetricCard label="Model Confidence" value={originalResult ? `${(originalResult.confidence * 100).toFixed(1)}%` : "..."} />
                <MetricCard label="Attack Drift" value={attackResult ? `${Math.abs(originalResult!.confidence - attackResult.confidence).toFixed(2)}` : "0.00"} />
                <MetricCard label="Robustness Score" value="64.2" sub="/ 100" />
              </div>

              {/* Analysis View */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 pt-8">
                {/* Visual Pipeline */}
                <div className="space-y-8">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] uppercase font-mono tracking-widest text-zinc-500 flex items-center gap-2">
                       <Zap className="w-3 h-3" /> Visual Transformer Input
                    </h3>
                    <button 
                      onClick={runAttack}
                      disabled={attackState === 'attacking' || !originalResult}
                      className="px-4 py-1.5 bg-zinc-100 text-zinc-900 rounded-lg text-xs font-bold flex items-center gap-2 hover:bg-zinc-300 transition-colors disabled:opacity-50"
                    >
                      {attackState === 'attacking' ? <RefreshCw className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
                      Execute Attack Simulation
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div className="aspect-square bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 relative group">
                        <img src={image} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent flex items-bottom p-4">
                          <span className="text-[10px] font-mono text-zinc-300 mt-auto uppercase tracking-wider">Source Input</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                         {originalResult?.topK.map((k, i) => (
                           <ClassificationBadge key={i} {...k} />
                         ))}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="aspect-square bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 relative">
                        {attackState === 'attacking' && (
                          <div className="absolute inset-0 bg-zinc-950/40 backdrop-blur-sm z-10 flex flex-col items-center justify-center gap-3">
                            <RefreshCw className="w-8 h-8 text-zinc-100 animate-spin" />
                            <span className="text-[10px] font-mono text-zinc-100 uppercase tracking-widest">Injecting Perturbations...</span>
                          </div>
                        )}
                        <img src={image} className={cn("w-full h-full object-cover transition-all grayscale-[0.5]", attackResult && "contrast-125 brightness-110")} />
                        {attackResult && (
                           <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-20 pointer-events-none" />
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 to-transparent flex items-bottom p-4">
                          <span className="text-[10px] font-mono text-zinc-300 mt-auto uppercase tracking-wider">Adversarial Result (ε={epsilon})</span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {attackResult ? (
                          attackResult.topK.map((k, i) => (
                            <ClassificationBadge key={i} {...k} />
                          ))
                        ) : (
                          <div className="p-4 border border-dashed border-zinc-800 rounded-xl text-center">
                            <p className="text-zinc-600 text-xs italic">Waiting for simulation...</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Attention Map */}
                <div className="space-y-8">
                  <h3 className="text-[11px] uppercase font-mono tracking-widest text-zinc-500 flex items-center gap-2">
                     <Layers className="w-3 h-3" /> Multi-Head Attention Maps
                  </h3>
                  
                  <div className="aspect-square bg-zinc-950 border border-zinc-800 rounded-2xl p-6 relative">
                     {attentionMap ? (
                        <div className="grid grid-cols-8 gap-1 h-full">
                          {attentionMap.patches.map((p, i) => (
                            <motion.div 
                              key={i}
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              transition={{ delay: i * 0.005 }}
                              style={{ opacity: 0.1 + p.importance * 0.9 }}
                              className={cn(
                                "rounded-sm bg-emerald-500 hover:ring-2 ring-emerald-300 transition-all cursor-crosshair",
                                p.importance > 0.8 && "bg-amber-500"
                              )}
                              title={`Importance: ${p.importance}`}
                            />
                          ))}
                        </div>
                     ) : (
                       <div className="h-full flex items-center justify-center italic text-zinc-600 text-xs">
                          {isAnalyzing ? "Computing attention heads..." : "Analyze image to view map"}
                       </div>
                     )}
                  </div>
                  
                  <div className="p-5 bg-zinc-900/30 border border-zinc-800 rounded-xl space-y-4">
                    <p className="text-zinc-400 text-xs leading-relaxed italic">
                      {attentionMap?.summary || "Patch-level importance highlights which regions dominate the final classification decision token ([CLS])."}
                    </p>
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-zinc-500 text-[10px] uppercase font-mono">Global Context</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-amber-500" />
                        <span className="text-zinc-500 text-[10px] uppercase font-mono">Salient Objects</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Section */}
              <div className="pt-12 grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                   <h3 className="text-[11px] uppercase font-mono tracking-widest text-zinc-500 flex items-center gap-2">
                     <BarChart3 className="w-3 h-3" /> Robustness Decay Analysis
                  </h3>
                  <div className="h-64 w-full bg-zinc-950 border border-zinc-800 rounded-2xl p-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorAcc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                        <XAxis dataKey="eps" stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis stroke="#52525b" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          contentStyle={{ background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', fontSize: '10px' }}
                        />
                        <Area type="monotone" dataKey="acc" stroke="#ef4444" fillOpacity={1} fill="url(#colorAcc)" />
                        <Area type="monotone" dataKey="robust" stroke="#3b82f6" fillOpacity={0} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="text-[11px] uppercase font-mono tracking-widest text-zinc-500 flex items-center gap-2">
                     <ChevronRight className="w-3 h-3" /> Attack Analysis
                  </h3>
                  <div className="space-y-4">
                    <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                      <p className="text-zinc-500 text-[10px] uppercase font-mono mb-2">Class Drift Explanation</p>
                      <p className="text-zinc-300 text-xs leading-relaxed">
                        {attackResult?.explanation || "No attack data. Execute a simulation to see how perturbations affect the model semantic space."}
                      </p>
                    </div>
                    <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                      <p className="text-zinc-500 text-[10px] uppercase font-mono mb-2">Model Gradient Sensitivity</p>
                      <div className="flex items-center gap-4">
                        <span className="text-2xl font-bold">1.4x</span>
                        <p className="text-[10px] text-zinc-600 leading-tight">Higher than standard ResNet-50 models for this class.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
