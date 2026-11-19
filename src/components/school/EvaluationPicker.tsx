import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MONTHS, buildEvaluationKey, type EvaluationType } from "@/lib/school";

interface Props {
  value: string | null;
  onChange: (key: string | null) => void;
}

const EvaluationPicker = ({ value, onChange }: Props) => {
  const [type, setType] = useState<EvaluationType | "">("");
  const [detail, setDetail] = useState("");

  const apply = (t: EvaluationType | "", d: string) => {
    if (t === "diagnostique") onChange(buildEvaluationKey("diagnostique"));
    else if (t && d) onChange(buildEvaluationKey(t as EvaluationType, d));
    else onChange(null);
  };

  return (
    <div className="flex flex-wrap gap-4 items-end">
      <div className="space-y-2">
        <Label>Évaluation</Label>
        <Select value={type} onValueChange={v => { setType(v as EvaluationType); setDetail(""); apply(v as EvaluationType, ""); }}>
          <SelectTrigger className="w-56"><SelectValue placeholder="Choisir une évaluation" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="diagnostique">Évaluation diagnostique</SelectItem>
            <SelectItem value="mois">Évaluation du mois</SelectItem>
            <SelectItem value="sommative">Évaluation sommative</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {type === "mois" && (
        <div className="space-y-2">
          <Label>Mois</Label>
          <Select value={detail} onValueChange={v => { setDetail(v); apply("mois", v); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Choisir le mois" /></SelectTrigger>
            <SelectContent>{MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {type === "sommative" && (
        <div className="space-y-2">
          <Label>Numéro</Label>
          <Select value={detail} onValueChange={v => { setDetail(v); apply("sommative", v); }}>
            <SelectTrigger className="w-32"><SelectValue placeholder="1, 2 ou 3" /></SelectTrigger>
            <SelectContent>{["1", "2", "3"].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {!value && <p className="text-sm text-muted-foreground pb-2">Sélectionnez d'abord une évaluation.</p>}
    </div>
  );
};

export default EvaluationPicker;
