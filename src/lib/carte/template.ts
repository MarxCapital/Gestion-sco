/* Modèle maître de la carte d'identité scolaire (primaire) — repris à l'identique de CarteSco. Coordonnées en px sur un canevas fixe de 440×260. */
import type { CardTemplate } from "./types";
import { CARD_WIDTH_PX, CARD_HEIGHT_PX } from "./types";
import beninFlagImage from "@/assets/carte/benin-flag.jpg";
import beninCoatOfArmsImage from "@/assets/carte/benin-coat-of-arms.jpg";

export const generateId = () => Math.random().toString(36).substring(2, 11);

// ================================================================
// TEMPLATE BÉNINOIS OFFICIEL - SOURCE DE VÉRITÉ UNIQUE
// ================================================================
// Ce template est le MODÈLE MAÎTRE utilisé pour toutes les cartes.
// Dimensions fixes: 440px × 260px (88mm × 52mm à 5px/mm)
// Identique en développement, studio design et production.
// ================================================================

export const createBeninTemplate = (name: string): CardTemplate => {
  const frontId = generateId();
  const backId = generateId();
  
  return {
    id: generateId(),
    name,
    createdAt: new Date(),
    updatedAt: new Date(),
    front: {
      id: frontId,
      backgroundColor: '#ffffff',
      elements: [
        // ═══════════════════════════════════════════════════════
        // FOND - Couvre 100% du canvas (zIndex: 0)
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'shape',
          x: 0,
          y: 0,
          width: CARD_WIDTH_PX, // 440px
          height: CARD_HEIGHT_PX, // 260px
          zIndex: 0,
          locked: true,
          visible: true,
          shapeType: 'rectangle',
          backgroundColor: '#ffffff',
          borderWidth: 0,
          borderColor: 'transparent',
          borderRadius: 0,
          opacity: 1
        } as any,
        
        // ═══════════════════════════════════════════════════════
        // DRAPEAU BÉNINOIS - Haut gauche
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'image',
          x: 10,
          y: 8,
          width: 50,
          height: 32,
          zIndex: 1,
          locked: false,
          visible: true,
          src: beninFlagImage,
          objectFit: 'cover',
          opacity: 1,
          borderRadius: 2
        } as any,
        
        // ═══════════════════════════════════════════════════════
        // ARMOIRIES DU BÉNIN - Haut droite (Y=0 fixé)
        // ═══════════════════════════════════════════════════════
        // ARMOIRIES - Y=0 (fixé définitivement)
        {
          id: generateId(),
          type: 'image',
          x: 380,
          y: 0, // ✅ FIXÉ à Y=0
          width: 55,
          height: 50,
          zIndex: 2,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          src: beninCoatOfArmsImage,
          objectFit: 'contain',
          opacity: 1,
          borderRadius: 0
        } as any,
        
        // ═══════════════════════════════════════════════════════
        // 1️⃣ RÉPUBLIQUE DU BÉNIN - Taille 24, bold
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'text',
          x: 65,
          y: 6,
          width: 310,
          height: 28,
          zIndex: 3,
          locked: false,
          visible: true,
          content: 'RÉPUBLIQUE DU BÉNIN',
          fontSize: 24,
          fontFamily: 'serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#2E7D32',
          textAlign: 'center',
          isPlaceholder: false
        },
        
        // ═══════════════════════════════════════════════════════
        // 2️⃣ MINISTÈRE - Dynamique selon type d'école
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'text',
          x: 92,
          y: 32,
          width: 255,
          height: 35,
          zIndex: 4,
          locked: false,
          visible: true,
          content: '{{MINISTERE}}',
          fontSize: 12,
          fontFamily: 'sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#333333',
          textAlign: 'center',
          isPlaceholder: true
        },
        
        // ═══════════════════════════════════════════════════════
        // 3️⃣ NOM DE L'ÉCOLE - Taille 14, bold (placeholder)
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'text',
          x: 65,
          y: 62,
          width: 310,
          height: 22,
          zIndex: 5,
          locked: false,
          visible: true,
          content: '{{NOM_ECOLE}}',
          fontSize: 14,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'center',
          isPlaceholder: true
        },
        
        // ═══════════════════════════════════════════════════════
        // 4️⃣ CARTE D'IDENTITÉ SCOLAIRE 2025-2026 - Taille 18, bold
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'text',
          x: 20,
          y: 82,
          width: 400,
          height: 24,
          zIndex: 6,
          locked: false,
          visible: true,
          content: "CARTE D'IDENTITÉ SCOLAIRE {{ANNEE_SCOLAIRE}}",
          fontSize: 18,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#1565C0',
          textAlign: 'center',
          isPlaceholder: false
        },
        
        // ═══════════════════════════════════════════════════════
        // BARRE TRICOLORE
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'shape',
          x: 20,
          y: 106,
          width: 400,
          height: 4,
          zIndex: 7,
          locked: false,
          visible: true,
          shapeType: 'rectangle',
          backgroundColor: 'linear-gradient(to right, #2E7D32 33%, #FDD835 33%, #FDD835 66%, #D32F2F 66%)',
          borderWidth: 0,
          borderColor: 'transparent',
          borderRadius: 0
        } as any,
        
        // ═══════════════════════════════════════════════════════
        // PHOTO DE L'ÉLÈVE - 99x127px (fixé définitivement)
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'photo',
          x: 20,
          y: 118,
          width: 99,  // ✅ FIXÉ 99px
          height: 127, // ✅ FIXÉ 127px
          zIndex: 8,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          isPlaceholder: true,
          borderStyle: 'solid',
          borderWidth: 1,
          borderColor: '#cccccc',
          borderRadius: 6,
          src: ''
        },
        
        // ═══════════════════════════════════════════════════════
        // 5️⃣ LABELS (Taille 14, bold, noir) - X=130 (VERROUILLÉ)
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'text',
          x: 130, // ✅ X=130 FIXÉ
          y: 118,
          width: 70,
          height: 18,
          zIndex: 9,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          content: 'Nom:',
          fontSize: 14,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          isPlaceholder: false
        },
        {
          id: generateId(),
          type: 'text',
          x: 130, // ✅ X=130 FIXÉ
          y: 138,
          width: 70,
          height: 18,
          zIndex: 10,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          content: 'Prénoms:',
          fontSize: 14,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          isPlaceholder: false
        },
        {
          id: generateId(),
          type: 'text',
          x: 130, // ✅ X=130 FIXÉ
          y: 158,
          width: 70,
          height: 18,
          zIndex: 11,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          content: 'Né(e) le:',
          fontSize: 14,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          isPlaceholder: false
        },
        {
          id: generateId(),
          type: 'text',
          x: 130, // ✅ X=130 FIXÉ
          y: 178,
          width: 70,
          height: 18,
          zIndex: 12,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          content: 'Sexe:',
          fontSize: 14,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          isPlaceholder: false
        },
        {
          id: generateId(),
          type: 'text',
          x: 130, // ✅ X=130 FIXÉ
          y: 198,
          width: 70,
          height: 18,
          zIndex: 13,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          content: 'Classe:',
          fontSize: 14,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          isPlaceholder: false
        },
        
        // ═══════════════════════════════════════════════════════
        // 6️⃣ VALEURS DYNAMIQUES (Taille 12, normal, noir) - X=207 (VERROUILLÉ)
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'text',
          x: 207, // ✅ X=207 FIXÉ
          y: 118,
          width: 160,
          height: 18,
          zIndex: 14,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          content: '{{NOM}}',
          fontSize: 12,
          fontFamily: 'sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          isPlaceholder: true
        },
        {
          id: generateId(),
          type: 'text',
          x: 207, // ✅ X=207 FIXÉ
          y: 138,
          width: 220, // ✅ ÉLARGI pour prénoms longs (réduction auto police)
          height: 18,
          zIndex: 15,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          content: '{{PRENOMS}}',
          fontSize: 12,
          fontFamily: 'sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          isPlaceholder: true
        },
        {
          id: generateId(),
          type: 'text',
          x: 207, // ✅ X=207 FIXÉ
          y: 158,
          width: 160,
          height: 18,
          zIndex: 16,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          content: '{{DATE_LIEU_NAISSANCE}}',
          fontSize: 12,
          fontFamily: 'sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          isPlaceholder: true
        },
        {
          id: generateId(),
          type: 'text',
          x: 207, // ✅ X=207 FIXÉ
          y: 178,
          width: 80,
          height: 18,
          zIndex: 17,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          content: '{{SEXE}}',
          fontSize: 12,
          fontFamily: 'sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          isPlaceholder: true
        },
        {
          id: generateId(),
          type: 'text',
          x: 207, // ✅ X=207 FIXÉ
          y: 198,
          width: 80,
          height: 18,
          zIndex: 18,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          content: '{{CLASSE}}',
          fontSize: 12,
          fontFamily: 'sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          isPlaceholder: true
        },
        
        // ═══════════════════════════════════════════════════════
        // 8️⃣ MATRICULE (secondaire uniquement) - Label + Valeur
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'text',
          x: 130,
          y: 218,
          width: 70,
          height: 18,
          zIndex: 19,
          locked: true,
          visible: true,
          content: '{{MATRICULE_LABEL}}',
          fontSize: 14,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          isPlaceholder: true
        },
        {
          id: generateId(),
          type: 'text',
          x: 207,
          y: 218,
          width: 160,
          height: 18,
          zIndex: 20,
          locked: true,
          visible: true,
          content: '{{MATRICULE_VALUE}}',
          fontSize: 12,
          fontFamily: 'sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'left',
          isPlaceholder: true
        },

        // ═══════════════════════════════════════════════════════
        // 7️⃣ SIGNATURE - Y=194 (VERROUILLÉ DÉFINITIVEMENT)
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'text',
          x: 320,
          y: 194,
          width: 100,
          height: 24,
          zIndex: 21,
          locked: true,
          visible: true,
          content: 'Signature',
          fontSize: 14,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'right',
          isPlaceholder: false,
          textDecoration: 'underline'
        } as any
      ]
    },
    back: {
      id: backId,
      backgroundColor: '#ffffff',
      elements: [
        // ═══════════════════════════════════════════════════════
        // FOND VERSO - Couvre 100% du canvas (zIndex: 0)
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'shape',
          x: 0,
          y: 0,
          width: CARD_WIDTH_PX,
          height: CARD_HEIGHT_PX,
          zIndex: 0,
          locked: true,
          visible: true,
          shapeType: 'rectangle',
          backgroundColor: '#ffffff',
          borderWidth: 0,
          borderColor: 'transparent',
          borderRadius: 0,
          opacity: 1
        } as any,
        
        // ═══════════════════════════════════════════════════════
        // 1️⃣ DEVISE - FRATERNITÉ JUSTICE TRAVAIL
        // X=17, Y=13, 406x34px, fontSize=24 (fixé)
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'text',
          x: 17,
          y: 13,
          width: 406,
          height: 34,
          zIndex: 1,
          locked: true,
          visible: true,
          content: 'FRATERNITÉ - JUSTICE - TRAVAIL',
          fontSize: 24,
          fontFamily: 'serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'center',
          isPlaceholder: false
        },
        
        // ═══════════════════════════════════════════════════════
        // BARRE TRICOLORE (VERROUILLÉE)
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'shape',
          x: 70,
          y: 55,
          width: 300,
          height: 5,
          zIndex: 2,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          shapeType: 'rectangle',
          backgroundColor: 'linear-gradient(to right, #2E7D32 33%, #FDD835 33%, #FDD835 66%, #D32F2F 66%)',
          borderWidth: 0,
          borderColor: 'transparent',
          borderRadius: 0
        } as any,
        
        // ═══════════════════════════════════════════════════════
        // 2️⃣ TEXTE ATTESTATION avec nom du directeur
        // X=14, Y=68, 405x95px, fontSize=16 (fixé)
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'text',
          x: 14,
          y: 68,
          width: 405,
          height: 95,
          zIndex: 3,
          locked: true,
          visible: true,
          content: 'Je soussigné(e) {{NOM_DIRECTEUR}}, Directeur/Directrice de {{NOM_ECOLE}}, atteste que le/la titulaire de cette carte est régulièrement inscrit(e) dans mon établissement.',
          fontSize: 16,
          fontFamily: 'sans-serif',
          fontWeight: 'normal',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'center',
          isPlaceholder: true
        },
        
        // ═══════════════════════════════════════════════════════
        // 4️⃣ LE DIRECTEUR : (TEL)
        // X=175, Y=160, 241x34px, fontSize=16 (fixé)
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'text',
          x: 175,
          y: 160,
          width: 241,
          height: 34,
          zIndex: 4,
          locked: true,
          visible: true,
          content: 'Le Directeur: {{TEL_DIRECTEUR}}',
          fontSize: 16,
          fontFamily: 'sans-serif',
          fontWeight: 'bold',
          fontStyle: 'normal',
          color: '#000000',
          textAlign: 'right',
          isPlaceholder: true
        },
        
        // ═══════════════════════════════════════════════════════
        // ZONE SIGNATURE DIRECTEUR (VERROUILLÉE)
        // ═══════════════════════════════════════════════════════
        {
          id: generateId(),
          type: 'shape',
          x: 280,
          y: 195,
          width: 130,
          height: 50,
          zIndex: 5,
          locked: true, // ✅ VERROUILLÉ
          visible: true,
          shapeType: 'rectangle',
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderColor: '#cccccc',
          borderRadius: 4,
          opacity: 0.5
        } as any
      ]
    }
  };
};

// ================================================================
// FONCTIONS DÉSACTIVÉES - TEMPLATE GLOBAL UNIQUE
// ================================================================
