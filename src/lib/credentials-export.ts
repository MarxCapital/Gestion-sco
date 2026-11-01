import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface CredRow { display_name?: string | null; school_name?: string | null; identifier: string; generated_password?: string | null; role: string; }

export const ROLE_LABELS: Record<string, string> = {
  center: "Centres d'examen", independent: "Centres indépendants", csbante: "CSBantè",
  school: "Écoles", prestataire: "Prestataires", admin: "Administrateurs",
};
export const roleLabel = (r: string) => ROLE_LABELS[r] ?? r;

const nameOf = (c: CredRow) => (c.school_name || c.display_name || c.identifier || "").trim();
const sortRows = (rows: CredRow[]) => [...rows].sort((a, b) => nameOf(a).localeCompare(nameOf(b), "fr", { numeric: true, sensitivity: "base" }));

/** Texte bien rangé, prêt à coller (WhatsApp, Word, e-mail…) : un bloc par compte. */
export function formatCredentialsText(rows: CredRow[], roleName: string, date = new Date()): string {
  const list = sortRows(rows);
  const head = `🔐 COMPTES GESTIONSCO — ${roleName.toUpperCase()}\n${list.length} compte(s) · ${date.toLocaleDateString("fr-FR")}\n`;
  const body = list.map((c, i) => `${String(i + 1).padStart(2, "0")}. ${nameOf(c)}\n    Identifiant : ${c.identifier}\n    Mot de passe : ${c.generated_password || "—"}`).join("\n\n");
  return `${head}\n${body}\n`;
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
const safe = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase();

export function downloadCredentialsText(rows: CredRow[], roleName: string) {
  downloadBlob(new Blob(["﻿" + formatCredentialsText(rows, roleName)], { type: "text/plain;charset=utf-8" }), `comptes-${safe(roleName)}.txt`);
}

/** Un seul document PDF : tableau N° / Nom / Identifiant / Mot de passe. */
export function downloadCredentialsPdf(rows: CredRow[], roleName: string) {
  const list = sortRows(rows);
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  doc.setFontSize(15); doc.setFont("helvetica", "bold"); doc.text(`GestionSco — Comptes : ${roleName}`, 14, 16);
  doc.setFontSize(9); doc.setFont("helvetica", "normal");
  doc.text(`${list.length} compte(s) · édité le ${new Date().toLocaleDateString("fr-FR")} · document confidentiel`, 14, 22);
  autoTable(doc, {
    startY: 27,
    head: [["N°", "Nom", "Identifiant", "Mot de passe"]],
    body: list.map((c, i) => [String(i + 1), nameOf(c), c.identifier, c.generated_password || "—"]),
    styles: { fontSize: 9.5, cellPadding: 2.2 },
    headStyles: { fillColor: [30, 64, 120], textColor: 255 },
    alternateRowStyles: { fillColor: [243, 246, 251] },
    columnStyles: { 0: { cellWidth: 12, halign: "center" }, 3: { font: "courier", fontStyle: "bold" }, 2: { font: "courier" } },
    margin: { left: 14, right: 14 },
  });
  doc.save(`comptes-${safe(roleName)}.pdf`);
}
