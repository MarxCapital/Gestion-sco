import ExcelJS from 'exceljs';
import { SCHOOL_SUBJECTS, evaluationSheetName, perfectionnementNote, type Student, type StudentNote } from './school';

/**
 * Génère le fichier Excel "notes EducMaster" au format exact du modèle fourni :
 *   ligne 1 : Matricule | Nom | Prénoms | <matière fusionnée sur 2 colonnes> ...
 *   ligne 2 : Note obtenue | Note perfectionnement (pour chaque matière)
 * La feuille porte le nom de l'évaluation choisie.
 */
export async function downloadEducmasterNotes(
  students: Student[],
  notes: StudentNote[],
  evaluationKey: string,
  fileLabel: string,
) {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(evaluationSheetName(evaluationKey));

  const noteOf = (studentId: string, subject: string): number | null => {
    const found = notes.find(n => n.student_id === studentId && n.subject_key === subject);
    return found && found.note !== null && found.note !== undefined ? Number(found.note) : null;
  };

  // --- En-têtes ---
  ws.getCell('A1').value = 'Matricule';
  ws.getCell('B1').value = 'Nom';
  ws.getCell('C1').value = 'Prénoms';
  ws.mergeCells('A1:A2');
  ws.mergeCells('B1:B2');
  ws.mergeCells('C1:C2');

  SCHOOL_SUBJECTS.forEach((sub, i) => {
    const col = 4 + i * 2; // D, F, H...
    ws.getRow(1).getCell(col).value = sub.excel;
    ws.mergeCells(1, col, 1, col + 1);
    ws.getRow(2).getCell(col).value = 'Note obtenue';
    ws.getRow(2).getCell(col + 1).value = 'Note perfectionnement';
  });

  [1, 2].forEach(r => {
    const row = ws.getRow(r);
    row.font = { bold: true, name: 'Arial', size: 10 };
    row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    row.height = 28;
  });

  // --- Lignes élèves ---
  students.forEach((s, idx) => {
    const row = ws.getRow(3 + idx);
    row.getCell(1).value = s.matricule ?? '';
    row.getCell(1).numFmt = '@';
    row.getCell(2).value = s.nom;
    row.getCell(3).value = s.prenoms ?? '';
    SCHOOL_SUBJECTS.forEach((sub, i) => {
      const col = 4 + i * 2;
      const note = noteOf(s.id, sub.key);
      row.getCell(col).value = note ?? '';
      row.getCell(col + 1).value = perfectionnementNote(note);
    });
    row.font = { name: 'Arial', size: 10 };
  });

  ws.getColumn(1).width = 18;
  ws.getColumn(2).width = 20;
  ws.getColumn(3).width = 26;
  for (let c = 4; c <= 3 + SCHOOL_SUBJECTS.length * 2; c++) ws.getColumn(c).width = 12;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileLabel}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
