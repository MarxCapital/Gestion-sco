/**
 * Card Design Variants
 * 
 * Each design is a visual skin applied ON TOP of the master Benin template.
 * All designs share the EXACT same element positions, fonts, sizes, and spacing.
 * Only backgrounds, accent colors, and decorative elements differ.
 */

import { CardTemplate, CardSide, CARD_WIDTH_PX, CARD_HEIGHT_PX } from "./types";

export interface CardDesignConfig {
  key: string;
  name: string;
  description: string;
  front: {
    backgroundColor: string;
    backgroundGradient?: string;
    backgroundImage?: string;
    backgroundOpacity?: number;
    accentColor?: string;
    titleColor: string;
    subtitleColor: string;
    labelColor: string;
    valueColor: string;
    cardTitleColor: string;
    tricolorBar: string;
  };
  back: {
    backgroundColor: string;
    backgroundGradient?: string;
    backgroundImage?: string;
    backgroundOpacity?: number;
    mottoColor: string;
    textColor: string;
    directorColor: string;
    tricolorBar: string;
  };
}

// All built-in design variants
export const CARD_DESIGNS: CardDesignConfig[] = [
  // Design 1: Original (Classique Blanc)
  {
    key: 'classic-white',
    name: 'Classique Blanc',
    description: 'Le design original officiel sur fond blanc',
    front: {
      backgroundColor: '#ffffff',
      titleColor: '#2E7D32',
      subtitleColor: '#333333',
      labelColor: '#000000',
      valueColor: '#000000',
      cardTitleColor: '#1565C0',
      tricolorBar: 'linear-gradient(to right, #2E7D32 33%, #FDD835 33%, #FDD835 66%, #D32F2F 66%)',
    },
    back: {
      backgroundColor: '#ffffff',
      mottoColor: '#000000',
      textColor: '#000000',
      directorColor: '#000000',
      tricolorBar: 'linear-gradient(to right, #2E7D32 33%, #FDD835 33%, #FDD835 66%, #D32F2F 66%)',
    },
  },

  // Design 2: Vert Émeraude
  {
    key: 'emerald-green',
    name: 'Vert Émeraude',
    description: 'Design élégant avec fond vert émeraude subtil',
    front: {
      backgroundColor: '#f0fdf4',
      backgroundGradient: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.15) 50%, rgba(4,120,87,0.08) 100%)',
      backgroundOpacity: 0.3,
      titleColor: '#065f46',
      subtitleColor: '#1e3a2f',
      labelColor: '#064e3b',
      valueColor: '#1a1a1a',
      cardTitleColor: '#047857',
      tricolorBar: 'linear-gradient(to right, #059669 33%, #fbbf24 33%, #fbbf24 66%, #dc2626 66%)',
    },
    back: {
      backgroundColor: '#f0fdf4',
      backgroundGradient: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(5,150,105,0.15) 50%, rgba(4,120,87,0.08) 100%)',
      backgroundOpacity: 0.3,
      mottoColor: '#065f46',
      textColor: '#1a1a1a',
      directorColor: '#064e3b',
      tricolorBar: 'linear-gradient(to right, #059669 33%, #fbbf24 33%, #fbbf24 66%, #dc2626 66%)',
    },
  },

  // Design 3: Bleu Royal
  {
    key: 'royal-blue',
    name: 'Bleu Royal',
    description: 'Fond bleu royal avec accents dorés',
    front: {
      backgroundColor: '#eff6ff',
      backgroundGradient: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(29,78,216,0.12) 50%, rgba(30,64,175,0.06) 100%)',
      backgroundOpacity: 0.3,
      titleColor: '#1e40af',
      subtitleColor: '#1e3a5f',
      labelColor: '#1e3a5f',
      valueColor: '#1a1a1a',
      cardTitleColor: '#1d4ed8',
      tricolorBar: 'linear-gradient(to right, #16a34a 33%, #eab308 33%, #eab308 66%, #dc2626 66%)',
    },
    back: {
      backgroundColor: '#eff6ff',
      backgroundGradient: 'linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(29,78,216,0.12) 50%, rgba(30,64,175,0.06) 100%)',
      backgroundOpacity: 0.3,
      mottoColor: '#1e40af',
      textColor: '#1a1a1a',
      directorColor: '#1e3a5f',
      tricolorBar: 'linear-gradient(to right, #16a34a 33%, #eab308 33%, #eab308 66%, #dc2626 66%)',
    },
  },

  // Design 4: Or & Crème
  {
    key: 'gold-cream',
    name: 'Or & Crème',
    description: 'Design chaud avec des teintes dorées et crème',
    front: {
      backgroundColor: '#fffbeb',
      backgroundGradient: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(217,119,6,0.12) 50%, rgba(180,83,9,0.06) 100%)',
      backgroundOpacity: 0.25,
      titleColor: '#92400e',
      subtitleColor: '#451a03',
      labelColor: '#78350f',
      valueColor: '#1a1a1a',
      cardTitleColor: '#b45309',
      tricolorBar: 'linear-gradient(to right, #15803d 33%, #d97706 33%, #d97706 66%, #b91c1c 66%)',
    },
    back: {
      backgroundColor: '#fffbeb',
      backgroundGradient: 'linear-gradient(135deg, rgba(245,158,11,0.06) 0%, rgba(217,119,6,0.12) 50%, rgba(180,83,9,0.06) 100%)',
      backgroundOpacity: 0.25,
      mottoColor: '#92400e',
      textColor: '#1a1a1a',
      directorColor: '#78350f',
      tricolorBar: 'linear-gradient(to right, #15803d 33%, #d97706 33%, #d97706 66%, #b91c1c 66%)',
    },
  },

  // Design 5: Bordeaux
  {
    key: 'burgundy',
    name: 'Bordeaux Prestige',
    description: 'Design raffiné avec des nuances bordeaux',
    front: {
      backgroundColor: '#fdf2f8',
      backgroundGradient: 'linear-gradient(135deg, rgba(190,24,93,0.06) 0%, rgba(157,23,77,0.12) 50%, rgba(131,24,67,0.06) 100%)',
      backgroundOpacity: 0.2,
      titleColor: '#831843',
      subtitleColor: '#4a044e',
      labelColor: '#701a40',
      valueColor: '#1a1a1a',
      cardTitleColor: '#9d174d',
      tricolorBar: 'linear-gradient(to right, #16a34a 33%, #eab308 33%, #eab308 66%, #be185d 66%)',
    },
    back: {
      backgroundColor: '#fdf2f8',
      backgroundGradient: 'linear-gradient(135deg, rgba(190,24,93,0.06) 0%, rgba(157,23,77,0.12) 50%, rgba(131,24,67,0.06) 100%)',
      backgroundOpacity: 0.2,
      mottoColor: '#831843',
      textColor: '#1a1a1a',
      directorColor: '#701a40',
      tricolorBar: 'linear-gradient(to right, #16a34a 33%, #eab308 33%, #eab308 66%, #be185d 66%)',
    },
  },

  // Design 6: Gris Acier
  {
    key: 'steel-gray',
    name: 'Gris Acier',
    description: 'Design moderne et professionnel avec des teintes grises',
    front: {
      backgroundColor: '#f8fafc',
      backgroundGradient: 'linear-gradient(135deg, rgba(100,116,139,0.06) 0%, rgba(71,85,105,0.1) 50%, rgba(51,65,85,0.06) 100%)',
      backgroundOpacity: 0.25,
      titleColor: '#1e293b',
      subtitleColor: '#334155',
      labelColor: '#1e293b',
      valueColor: '#0f172a',
      cardTitleColor: '#334155',
      tricolorBar: 'linear-gradient(to right, #22c55e 33%, #facc15 33%, #facc15 66%, #ef4444 66%)',
    },
    back: {
      backgroundColor: '#f8fafc',
      backgroundGradient: 'linear-gradient(135deg, rgba(100,116,139,0.06) 0%, rgba(71,85,105,0.1) 50%, rgba(51,65,85,0.06) 100%)',
      backgroundOpacity: 0.25,
      mottoColor: '#1e293b',
      textColor: '#0f172a',
      directorColor: '#1e293b',
      tricolorBar: 'linear-gradient(to right, #22c55e 33%, #facc15 33%, #facc15 66%, #ef4444 66%)',
    },
  },

  // Design 7: Turquoise Tropical
  {
    key: 'tropical-teal',
    name: 'Turquoise Tropical',
    description: 'Design frais avec des teintes turquoise tropicales',
    front: {
      backgroundColor: '#f0fdfa',
      backgroundGradient: 'linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(13,148,136,0.14) 50%, rgba(15,118,110,0.08) 100%)',
      backgroundOpacity: 0.3,
      titleColor: '#134e4a',
      subtitleColor: '#115e59',
      labelColor: '#0f766e',
      valueColor: '#1a1a1a',
      cardTitleColor: '#0d9488',
      tricolorBar: 'linear-gradient(to right, #0d9488 33%, #fbbf24 33%, #fbbf24 66%, #ef4444 66%)',
    },
    back: {
      backgroundColor: '#f0fdfa',
      backgroundGradient: 'linear-gradient(135deg, rgba(20,184,166,0.08) 0%, rgba(13,148,136,0.14) 50%, rgba(15,118,110,0.08) 100%)',
      backgroundOpacity: 0.3,
      mottoColor: '#134e4a',
      textColor: '#1a1a1a',
      directorColor: '#0f766e',
      tricolorBar: 'linear-gradient(to right, #0d9488 33%, #fbbf24 33%, #fbbf24 66%, #ef4444 66%)',
    },
  },

  // Design 8: Violet Nuit
  {
    key: 'night-violet',
    name: 'Violet Nuit',
    description: 'Design mystérieux avec des tons violet profond',
    front: {
      backgroundColor: '#faf5ff',
      backgroundGradient: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(124,58,237,0.12) 50%, rgba(109,40,217,0.06) 100%)',
      backgroundOpacity: 0.25,
      titleColor: '#5b21b6',
      subtitleColor: '#4c1d95',
      labelColor: '#6d28d9',
      valueColor: '#1a1a1a',
      cardTitleColor: '#7c3aed',
      tricolorBar: 'linear-gradient(to right, #22c55e 33%, #eab308 33%, #eab308 66%, #dc2626 66%)',
    },
    back: {
      backgroundColor: '#faf5ff',
      backgroundGradient: 'linear-gradient(135deg, rgba(139,92,246,0.06) 0%, rgba(124,58,237,0.12) 50%, rgba(109,40,217,0.06) 100%)',
      backgroundOpacity: 0.25,
      mottoColor: '#5b21b6',
      textColor: '#1a1a1a',
      directorColor: '#4c1d95',
      tricolorBar: 'linear-gradient(to right, #22c55e 33%, #eab308 33%, #eab308 66%, #dc2626 66%)',
    },
  },
];

/**
 * Apply a design config to the master template.
 * This modifies ONLY visual properties (colors, backgrounds) 
 * while preserving ALL positions, sizes, fonts, and content.
 */
export const applyDesignToTemplate = (
  template: CardTemplate,
  design: CardDesignConfig
): CardTemplate => {
  const newTemplate = JSON.parse(JSON.stringify(template)) as CardTemplate;

  // Apply front design
  applyDesignToSide(newTemplate.front, design.front, 'front');
  // Apply back design  
  applyDesignToSide(newTemplate.back, design.back, 'back');

  newTemplate.name = design.name;
  
  return newTemplate;
};

const applyDesignToSide = (
  side: CardSide,
  designSide: CardDesignConfig['front'] | CardDesignConfig['back'],
  sideType: 'front' | 'back'
) => {
  // Update background color
  side.backgroundColor = designSide.backgroundColor;

  // Apply background gradient as backgroundImage if present
  if (designSide.backgroundGradient) {
    // We store the gradient info but render it via the background shape
  }

  side.elements.forEach(el => {
    // Background shape (zIndex 0)
    if (el.type === 'shape' && el.zIndex === 0 && el.x === 0 && el.y === 0) {
      (el as any).backgroundColor = designSide.backgroundColor;
    }

    // Tricolor bar
    if (el.type === 'shape' && (el as any).backgroundColor?.includes('linear-gradient') && el.height <= 6) {
      (el as any).backgroundColor = designSide.tricolorBar;
    }

    if (sideType === 'front') {
      const frontDesign = designSide as CardDesignConfig['front'];
      
      if (el.type === 'text') {
        const textEl = el as any;
        // RÉPUBLIQUE DU BÉNIN (zIndex 3)
        if (textEl.content === 'RÉPUBLIQUE DU BÉNIN') {
          textEl.color = frontDesign.titleColor;
        }
        // Ministère (zIndex 4)
        else if (textEl.content === '{{MINISTERE}}') {
          textEl.color = frontDesign.subtitleColor;
        }
        // Nom école (zIndex 5)
        else if (textEl.content === '{{NOM_ECOLE}}') {
          textEl.color = frontDesign.labelColor;
        }
        // Carte titre (zIndex 6)
        else if (textEl.content?.includes("CARTE D'IDENTITÉ")) {
          textEl.color = frontDesign.cardTitleColor;
        }
        // Labels (bold, x=130)
        else if (textEl.x === 130 && textEl.fontWeight === 'bold' && !textEl.isPlaceholder) {
          textEl.color = frontDesign.labelColor;
        }
        // Placeholder labels at x=130
        else if (textEl.x === 130 && textEl.isPlaceholder) {
          textEl.color = frontDesign.labelColor;
        }
        // Values (x=207)
        else if (textEl.x === 207) {
          textEl.color = frontDesign.valueColor;
        }
        // Signature
        else if (textEl.content === 'Signature') {
          textEl.color = frontDesign.labelColor;
        }
      }
    } else {
      const backDesign = designSide as CardDesignConfig['back'];
      
      if (el.type === 'text') {
        const textEl = el as any;
        // Devise
        if (textEl.content?.includes('FRATERNITÉ')) {
          textEl.color = backDesign.mottoColor;
        }
        // Attestation text
        else if (textEl.content?.includes('soussigné')) {
          textEl.color = backDesign.textColor;
        }
        // Directeur
        else if (textEl.content?.includes('Directeur')) {
          textEl.color = backDesign.directorColor;
        }
      }
    }
  });

  // Add gradient overlay shape if design has gradient (at zIndex 0.5, just above bg)
  if (designSide.backgroundGradient) {
    const existingGradient = side.elements.find(
      el => el.type === 'shape' && (el as any)._isDesignGradient
    );
    
    if (!existingGradient) {
      side.elements.push({
        id: Math.random().toString(36).substring(2, 11),
        type: 'shape',
        x: 0,
        y: 0,
        width: CARD_WIDTH_PX,
        height: CARD_HEIGHT_PX,
        zIndex: 0,
        locked: true,
        visible: true,
        shapeType: 'rectangle',
        backgroundColor: designSide.backgroundGradient.replace(/rgba?\([^)]+\)/g, (match) => {
          // Ensure max 30% opacity
          return match;
        }),
        borderWidth: 0,
        borderColor: 'transparent',
        borderRadius: 0,
        opacity: designSide.backgroundOpacity ?? 0.3,
        _isDesignGradient: true,
      } as any);
    } else {
      (existingGradient as any).backgroundColor = designSide.backgroundGradient;
      (existingGradient as any).opacity = designSide.backgroundOpacity ?? 0.3;
    }
  }
};

export const getDesignByKey = (key: string): CardDesignConfig | undefined => {
  return CARD_DESIGNS.find(d => d.key === key);
};
