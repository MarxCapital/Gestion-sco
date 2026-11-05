/* Rendu HTML de la carte — source de vérité unique (aperçu, PNG, PDF). Repris de CarteSco, primaire uniquement.
   Canevas fixe 440×260 px (88×52 mm à 5 px/mm), styles en ligne, aucun responsive. */
import type { CardSide, CardElement, TextElement, ImageElement, PhotoElement, ShapeElement, Student, SchoolInfo } from "./types";
import { CARD_WIDTH_PX, CARD_HEIGHT_PX } from "./types";

export const UNIFIED_CARD_DIMENSIONS = {
  width: CARD_WIDTH_PX,  // 440px
  height: CARD_HEIGHT_PX, // 260px
  borderRadius: 8,
} as const;

export const getCanvasBaseStylesCSS = (backgroundColor: string = '#ffffff'): string => `
  width: ${UNIFIED_CARD_DIMENSIONS.width}px;
  height: ${UNIFIED_CARD_DIMENSIONS.height}px;
  min-width: ${UNIFIED_CARD_DIMENSIONS.width}px;
  min-height: ${UNIFIED_CARD_DIMENSIONS.height}px;
  max-width: ${UNIFIED_CARD_DIMENSIONS.width}px;
  max-height: ${UNIFIED_CARD_DIMENSIONS.height}px;
  position: relative;
  overflow: hidden;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  transform: none;
  flex-shrink: 0;
  flex-grow: 0;
  border-radius: ${UNIFIED_CARD_DIMENSIONS.borderRadius}px;
  background-color: ${backgroundColor};
  font-family: Arial, sans-serif;
`;

// ============================================
// REMPLACEMENT DES PLACEHOLDERS
// ============================================

export const esc = (s: string): string =>
  String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export const replacePlaceholders = (content: string, student?: Student, schoolInfo?: SchoolInfo, annee = "2025-2026"): string => {
  let result = content;
  // Primaire uniquement : pas de matricule affiché sur la carte
  result = result.replace(/\{\{MINISTERE\}\}/g, "Ministère des Enseignements Maternel et Primaire");
  result = result.replace(/\{\{MATRICULE_LABEL\}\}/g, "").replace(/\{\{MATRICULE_VALUE\}\}/g, "");
  result = result.replace(/\{\{ANNEE_SCOLAIRE\}\}/g, esc(student?.schoolYear || annee));
  if (student) {
    result = result
      .replace(/\{\{NOM\}\}/g, () => esc(student.lastName || "NOM"))
      .replace(/\{\{PRENOMS\}\}/g, () => esc(student.firstName || "PRÉNOMS"))
      .replace(/\{\{DATE_LIEU_NAISSANCE\}\}/g, () => `${esc(student.dateOfBirth || "JJ/MM/AAAA")} à ${esc(student.placeOfBirth || "LIEU")}`)
      .replace(/\{\{DATE_NAISSANCE\}\}/g, () => esc(student.dateOfBirth || "JJ/MM/AAAA"))
      .replace(/\{\{LIEU_NAISSANCE\}\}/g, () => esc(student.placeOfBirth || "LIEU"))
      .replace(/\{\{CLASSE\}\}/g, () => esc(student.class || "CM2"))
      .replace(/\{\{SEXE\}\}/g, () => esc(student.gender || "M/F"))
      .replace(/\{\{MATRICULE\}\}/g, () => esc(student.studentId || ""));
  } else {
    result = result
      .replace(/\{\{NOM\}\}/g, "EXEMPLE").replace(/\{\{PRENOMS\}\}/g, "Jean Pierre")
      .replace(/\{\{DATE_LIEU_NAISSANCE\}\}/g, "01/01/2015 à Porto-Novo")
      .replace(/\{\{DATE_NAISSANCE\}\}/g, "01/01/2015").replace(/\{\{LIEU_NAISSANCE\}\}/g, "Porto-Novo")
      .replace(/\{\{CLASSE\}\}/g, "CM2").replace(/\{\{SEXE\}\}/g, "M").replace(/\{\{MATRICULE\}\}/g, "");
  }
  if (schoolInfo) {
    const isF = schoolInfo.directorGender === "F";
    const titre = isF ? "Directrice" : "Directeur";
    const soussigne = isF ? "soussignée" : "soussigné";
    result = result
      .replace(/\{\{NOM_ECOLE\}\}/g, () => esc(schoolInfo.name || "NOM ÉCOLE"))
      .replace(/\{\{NOM_DIRECTEUR\}\}/g, () => esc(schoolInfo.directorName || (isF ? "Mme Directrice" : "M. Directeur")))
      .replace(/\{\{TEL_DIRECTEUR\}\}/g, () => esc(schoolInfo.directorPhone || "00 00 00 00"))
      .replace(/\{\{TITRE_DIRECTEUR\}\}/g, titre)
      .replace(/Je soussigné\(e\)/g, `Je ${soussigne}`)
      .replace(/Directeur\/Directrice/g, titre)
      .replace(/Le Directeur:/g, isF ? "La Directrice:" : "Le Directeur:");
  } else {
    result = result.replace(/\{\{NOM_ECOLE\}\}/g, "Nom de l'École").replace(/\{\{NOM_DIRECTEUR\}\}/g, "M./Mme Directeur")
      .replace(/\{\{TEL_DIRECTEUR\}\}/g, "00 00 00 00").replace(/\{\{TITRE_DIRECTEUR\}\}/g, "Directeur");
  }
  return result;
};

// ============================================
// STYLES D'ÉLÉMENTS UNIFIÉS
// ============================================

export const getElementBaseStylesCSS = (element: CardElement): string => `
  position: absolute;
  left: ${element.x}px;
  top: ${element.y}px;
  width: ${element.width}px;
  height: ${element.height}px;
  transform: rotate(${element.rotation || 0}deg);
  z-index: ${element.zIndex};
  box-sizing: border-box;
  margin: 0;
  padding: 0;
`;

// ============================================
// RENDU HTML POUR EXPORT (Génération d'images)
// ============================================

// Fonction de calcul auto de la taille de police pour Prénoms
const calculateAutoFontSizeForExport = (
  text: string, 
  containerWidth: number, 
  baseFontSize: number
): number => {
  const charWidthRatio = 0.55;
  const estimatedTextWidth = text.length * baseFontSize * charWidthRatio;
  
  if (estimatedTextWidth <= containerWidth) {
    return baseFontSize;
  }
  
  const scaleFactor = containerWidth / estimatedTextWidth;
  const newFontSize = Math.floor(baseFontSize * scaleFactor);
  
  return Math.max(8, newFontSize);
};

export const renderElementToHTML = (
  element: CardElement, 
  student?: Student, 
  schoolInfo?: SchoolInfo,
  annee?: string
): string => {
  if (element.visible === false) {
    return '';
  }

  const baseStyle = getElementBaseStylesCSS(element);

  switch (element.type) {
    case 'text': {
      const textEl = element as TextElement;
      const content = (textEl.isPlaceholder || textEl.content.includes('{{'))
        ? replacePlaceholders(textEl.content, student, schoolInfo, annee)
        : textEl.content;
      
      // Détecter si c'est le champ Prénoms pour la réduction auto
      const isFirstNamesField = textEl.content.includes('PRENOMS');
      const autoFontSize = isFirstNamesField 
        ? calculateAutoFontSizeForExport(content, textEl.width, textEl.fontSize)
        : textEl.fontSize;
      
      // Le champ Prénoms reste sur une seule ligne, les autres peuvent wrapper
      const whiteSpaceStyle = isFirstNamesField ? 'nowrap' : 'normal';
      const wordWrapStyle = isFirstNamesField ? 'normal' : 'break-word';
      const alignItems = isFirstNamesField ? 'center' : 'flex-start';
      
      return `
        <div style="${baseStyle}
          font-size: ${autoFontSize}px;
          font-family: ${textEl.fontFamily}, Arial, sans-serif;
          font-weight: ${textEl.fontWeight};
          font-style: ${textEl.fontStyle || 'normal'};
          color: ${textEl.color};
          text-align: ${textEl.textAlign};
          display: flex;
          align-items: ${alignItems};
          justify-content: ${textEl.textAlign === 'center' ? 'center' : textEl.textAlign === 'right' ? 'flex-end' : 'flex-start'};
          overflow: hidden;
          white-space: ${whiteSpaceStyle};
          word-wrap: ${wordWrapStyle};
          line-height: 1.2;
        ">${content}</div>
      `;
    }

    case 'image': {
      const imgEl = element as ImageElement;
      if (!imgEl.src) {
        return `
          <div style="${baseStyle}
            background-color: #f3f4f6;
            border: 2px dashed #9ca3af;
            border-radius: ${imgEl.borderRadius}px;
            opacity: ${imgEl.opacity};
            display: flex;
            align-items: center;
            justify-content: center;
          "><span style="font-size: 12px; color: #6b7280;">Image</span></div>
        `;
      }
      return `
        <div style="${baseStyle}
          border-radius: ${imgEl.borderRadius}px;
          opacity: ${imgEl.opacity};
          overflow: hidden;
        ">
          <img src="${imgEl.src}" style="width: 100%; height: 100%; object-fit: ${imgEl.objectFit}; display: block;" crossorigin="anonymous" />
        </div>
      `;
    }

    case 'photo': {
      const photoEl = element as PhotoElement;
      const photoSrc = student?.photo || '';
      
      return `
        <div style="${baseStyle}
          border-radius: ${photoEl.borderRadius}px;
          border: ${photoEl.borderWidth}px solid ${photoEl.borderColor};
          overflow: hidden;
          background-color: #f3f4f6;
          display: flex;
          align-items: center;
          justify-content: center;
          box-sizing: border-box;
        ">
          ${photoSrc 
            ? `<img src="${photoSrc}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />`
            : `<div style="display: flex; flex-direction: column; align-items: center; justify-content: center; color: #9ca3af;">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              </div>`
          }
        </div>
      `;
    }

    case 'shape': {
      const shapeEl = element as ShapeElement;
      const borderRadius = shapeEl.shapeType === 'circle' ? '50%' : `${shapeEl.borderRadius}px`;
      
      return `
        <div style="${baseStyle}
          background: ${shapeEl.backgroundColor};
          border-radius: ${borderRadius};
          border: ${shapeEl.borderWidth > 0 ? `${shapeEl.borderWidth}px solid ${shapeEl.borderColor}` : 'none'};
          opacity: ${shapeEl.opacity};
        "></div>
      `;
    }

    default:
      return '';
  }
};

export const renderCardSideToHTML = (
  side: CardSide,
  student?: Student,
  schoolInfo?: SchoolInfo,
  annee?: string
): string => {
  const sortedElements = [...side.elements].sort((a, b) => a.zIndex - b.zIndex);
  
  let backgroundStyle = '';
  if (side.backgroundImage) {
    backgroundStyle = `
      background-image: url('${side.backgroundImage}');
      background-size: cover;
      background-position: center;
      background-repeat: no-repeat;
      opacity: ${side.backgroundOpacity ?? 1};
    `;
  }

  return `
    <div style="${getCanvasBaseStylesCSS(side.backgroundColor || '#ffffff')}">
      ${side.backgroundImage ? `<div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; ${backgroundStyle} pointer-events: none; z-index: 0;"></div>` : ''}
      ${sortedElements.map(el => renderElementToHTML(el, student, schoolInfo, annee)).join('')}
    </div>
  `;
};

