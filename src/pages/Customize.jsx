import { useState } from "react";
import { Volume2, VolumeX, Play } from "lucide-react";
import { getSoundState, saveSoundState, playSound } from "../lib/gameState";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";

const soundProfiles = [
  { key: "minimal_pop", label: "Minimal Pop", desc: "Sons curtos e discretos" },
  { key: "soft_glass", label: "Soft Glass", desc: "Tons cristalinos e suaves" },
  { key: "clean_tap", label: "Clean Tap", desc: "Toques rápidos e precisos" },
];

const interactionLabels = {
  selection: "Som de seleção",
  correct: "Som de acerto",
  incorrect: "Som de erro",
  advance: "Som de avanço",
  flip: "Som de virar carta",
  completion: "Som de conclusão",
  import_done: "Importação concluída",
  admin_action: "Ação administrativa",
  critical_action: "Exclusão / ação crítica",
};

export default function Customize() {
  const [sound, setSound] = useState(() => getSoundState());

  const update = (changes) => {
    const newState = { ...sound, ...changes };
    setSound(newState);
    saveSoundState(newState);
  };

  const updateInteraction = (key, value) => {
    const interactions = { ...sound.interactions, [key]: value };
    update({ interactions });
  };

  const previewSound = (type) => {
    // Temporarily enable for preview
    const original = getSoundState();
    saveSoundState({ ...sound, enabled: true, interactions: { ...sound.interactions, [type]: true } });
    playSound(type);
    saveSoundState(original);
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-bold text-foreground mb-1">Personalização do Sistema</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Configure sons e preferências de interação do sistema.
      </p>

      {/* Master toggle */}
      <div className="bg-card border border-border/60 rounded-xl p-5 mb-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {sound.enabled ? (
              <Volume2 className="w-5 h-5 text-primary" />
            ) : (
              <VolumeX className="w-5 h-5 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-semibold text-foreground">Som do sistema</p>
              <p className="text-xs text-muted-foreground">{sound.enabled ? "Ativado" : "Desativado"}</p>
            </div>
          </div>
          <Switch
            checked={sound.enabled}
            onCheckedChange={(checked) => update({ enabled: checked })}
          />
        </div>
      </div>

      {/* Volume */}
      <div className="bg-card border border-border/60 rounded-xl p-5 mb-5">
        <p className="text-sm font-semibold text-foreground mb-3">Volume geral</p>
        <Slider
          value={[sound.volume * 100]}
          onValueChange={([v]) => update({ volume: v / 100 })}
          max={100}
          step={1}
          className="w-full"
        />
        <p className="text-xs text-muted-foreground mt-2 text-right">{Math.round(sound.volume * 100)}%</p>
      </div>

      {/* Sound profiles */}
      <div className="bg-card border border-border/60 rounded-xl p-5 mb-5">
        <p className="text-sm font-semibold text-foreground mb-3">Perfil sonoro</p>
        <div className="space-y-2">
          {soundProfiles.map(p => (
            <button
              key={p.key}
              onClick={() => update({ profile: p.key })}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm transition-all duration-200 border ${
                sound.profile === p.key
                  ? "bg-primary/5 border-primary/30 text-foreground"
                  : "bg-background border-border/40 text-foreground hover:border-primary/20"
              }`}
            >
              <div className="text-left">
                <p className="font-medium">{p.label}</p>
                <p className="text-xs text-muted-foreground">{p.desc}</p>
              </div>
              {sound.profile === p.key && (
                <span className="text-xs font-semibold text-primary">Ativo</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Interaction sounds */}
      <div className="bg-card border border-border/60 rounded-xl p-5">
        <p className="text-sm font-semibold text-foreground mb-3">Sons por interação</p>
        <div className="space-y-2">
          {Object.entries(interactionLabels).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between py-2">
              <span className="text-sm text-foreground">{label}</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => previewSound(key)}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                  title="Prévia"
                >
                  <Play className="w-3 h-3 text-muted-foreground" />
                </button>
                <Switch
                  checked={sound.interactions[key] !== false}
                  onCheckedChange={(checked) => updateInteraction(key, checked)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}