import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "@/integrations/supabase/client";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, Lock } from "lucide-react";
import logo from "@/assets/brand";
import { useAppSettings } from "@/hooks/use-app-settings";

interface CandidateResult {
  nom: string;
  prenoms: string;
  sexe: string;
  ecole_provenance: string;
  is_absent: boolean;
  has_notes: boolean;
  notes: Record<string, number | null> | null;
  total: number | null;
  moyenne: number | null;
  rang_centre: number | null;
  rang_global: number | null;
  seuilAtteint: boolean;
}

const Resultats = () => {
  const { settings, loading: settingsLoading } = useAppSettings();
  const [searchType, setSearchType] = useState<"numero" | "nom">("numero");
  const [numeroTable, setNumeroTable] = useState("");
  const [nom, setNom] = useState("");
  const [prenoms, setPrenoms] = useState("");
  const [result, setResult] = useState<CandidateResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    setResult(null);
    setSearched(true);

    try {
      const resp = await fetch(`${SUPABASE_URL}/functions/v1/lookup-result`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          search_type: searchType,
          numero_table: numeroTable,
          nom,
          prenoms,
        }),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);

      if (!data.found) {
        toast.error("Aucun candidat trouvé avec ces informations");
        return;
      }

      setResult(data.candidate);
    } catch (e: any) {
      toast.error(e.message || "Erreur de recherche");
    } finally {
      setLoading(false);
    }
  };

  if (!settingsLoading && !settings.public_results_enabled) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <Lock className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold">Portail temporairement fermé</h1>
          <p className="text-sm text-muted-foreground">La consultation publique des résultats est actuellement désactivée. Merci de réessayer plus tard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <img src={logo} alt="Gestion Sco" className="w-10 h-10 rounded-xl object-contain" />
          <div>
            <h1 className="text-lg font-bold">Consultation des Résultats</h1>
            <p className="text-xs text-muted-foreground">Examen Blanc Départemental - Session de Mai 2026</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="w-4 h-4" />
              Rechercher un candidat
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex gap-4">
                <Button
                  variant={searchType === "numero" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSearchType("numero")}
                >
                  Par N° de table
                </Button>
                <Button
                  variant={searchType === "nom" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSearchType("nom")}
                >
                  Par nom et prénom
                </Button>
              </div>

              {searchType === "numero" ? (
                <div className="space-y-2">
                  <Label>Numéro de table</Label>
                  <Input
                    value={numeroTable}
                    onChange={e => setNumeroTable(e.target.value)}
                    placeholder="Entrez votre numéro de table"
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nom</Label>
                    <Input
                      value={nom}
                      onChange={e => setNom(e.target.value)}
                      placeholder="Nom de famille"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Prénom(s)</Label>
                    <Input
                      value={prenoms}
                      onChange={e => setPrenoms(e.target.value)}
                      placeholder="Prénom(s)"
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    />
                  </div>
                </div>
              )}

              <Button onClick={handleSearch} disabled={loading} className="w-full">
                {loading ? "Recherche..." : "Rechercher"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {searched && !loading && !result && (
          <Card className="border-destructive/50">
            <CardContent className="py-6 text-center text-destructive">
              Aucun candidat trouvé avec ces informations. Vérifiez et réessayez.
            </CardContent>
          </Card>
        )}

        {result && (
          <Card>
            <CardContent className="py-6 space-y-6">
              {/* Identity */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-muted-foreground">Nom :</span> <strong>{result.nom}</strong></div>
                <div><span className="text-muted-foreground">Prénom(s) :</span> <strong>{result.prenoms}</strong></div>
                <div><span className="text-muted-foreground">Sexe :</span> <strong>{result.sexe}</strong></div>
                <div><span className="text-muted-foreground">École :</span> <strong>{result.ecole_provenance}</strong></div>
              </div>

              {result.is_absent ? (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-center font-bold">
                  ABSENT(E)
                </div>
              ) : (
                <>
                  {/* Notes table */}
                  {result.notes && (
                    <div className="overflow-x-auto border rounded-lg">
                      <table className="w-full text-sm">
                        <thead className="bg-muted">
                          <tr>
                            <th className="p-2 text-left">Matière</th>
                            <th className="p-2 text-center">Note / 20</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(result.notes).map(([subject, note]) => (
                            <tr key={subject} className="border-t">
                              <td className="p-2">{subject}</td>
                              <td className={`p-2 text-center font-semibold ${!result.has_notes ? 'text-muted-foreground italic' : ''}`}>
                                {!result.has_notes ? 'Pas encore composé' : note !== null ? note.toFixed(2) : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {result.has_notes ? (
                    <>
                      {/* Summary */}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-muted rounded-lg p-3 text-center">
                          <div className="text-muted-foreground text-xs">Moyenne</div>
                          <div className="text-2xl font-bold">{result.moyenne?.toFixed(2) ?? '-'}</div>
                          <div className="text-xs text-muted-foreground">/ 20</div>
                        </div>
                        <div className="bg-muted rounded-lg p-3 text-center">
                          <div className="text-muted-foreground text-xs">Total</div>
                          <div className="text-2xl font-bold">{result.total?.toFixed(2) ?? '-'}</div>
                          <div className="text-xs text-muted-foreground">/ 180</div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="bg-blue-50 rounded-lg p-3 text-center">
                          <div className="text-muted-foreground text-xs">Rang (Centre)</div>
                          <div className="text-xl font-bold text-blue-700">{result.rang_centre ? (result.rang_centre === 1 ? `1${result.sexe === 'F' ? 'ère' : 'er'}` : `${result.rang_centre}ième`) : '-'}</div>
                        </div>
                        <div className="bg-indigo-50 rounded-lg p-3 text-center">
                          <div className="text-muted-foreground text-xs">Rang (Circonscription Scolaire)</div>
                          <div className="text-xl font-bold text-indigo-700">{result.rang_global ? (result.rang_global === 1 ? `1${result.sexe === 'F' ? 'ère' : 'er'}` : `${result.rang_global}ième`) : '-'}</div>
                        </div>
                      </div>

                      <div className={`rounded-lg p-4 text-center font-bold text-white ${result.seuilAtteint ? 'bg-green-500' : 'bg-red-500'}`}>
                        {result.seuilAtteint
                          ? 'A atteint le seuil de réussite'
                          : 'N\'a pas atteint le seuil de réussite'
                        }
                      </div>
                    </>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-center text-amber-800 font-medium">
                      Les notes n'ont pas encore été saisies pour ce candidat.
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
};

export default Resultats;
