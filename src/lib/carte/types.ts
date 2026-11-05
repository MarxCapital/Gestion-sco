/* Types de la carte scolaire (primaire). Repris de CarteSco, version sans secondaire. */
export type ElementType = "text" | "image" | "shape" | "photo";

export interface BaseElement {
  id: string; type: ElementType; x: number; y: number; width: number; height: number;
  rotation?: number; zIndex: number; locked: boolean; visible?: boolean; groupId?: string;
}
export interface TextElement extends BaseElement {
  type: "text"; content: string; fontSize: number; fontFamily: string; fontWeight: string | number;
  fontStyle?: "normal" | "italic"; color: string; textAlign: "left" | "center" | "right";
  isPlaceholder: boolean; placeholderField?: string;
}
export interface ImageElement extends BaseElement {
  type: "image"; src: string; objectFit: "cover" | "contain" | "fill"; opacity: number; borderRadius: number;
}
export interface PhotoElement extends BaseElement {
  type: "photo"; src: string; borderRadius: number; borderWidth: number; borderColor: string; isPlaceholder: boolean;
}
export interface ShapeElement extends BaseElement {
  type: "shape"; shapeType: "rectangle" | "circle" | "line"; backgroundColor: string; borderColor: string;
  borderWidth: number; borderRadius: number; opacity: number;
}
export type CardElement = TextElement | ImageElement | PhotoElement | ShapeElement;

export interface CardSide {
  id: string; elements: CardElement[]; backgroundColor: string; backgroundImage?: string; backgroundOpacity?: number;
}
export interface CardTemplate {
  id: string; name: string; createdAt: Date; updatedAt: Date; front: CardSide; back: CardSide;
}

/** Élève tel qu'utilisé par la carte. `photo` est une URL (blob: ou data:) prête à afficher. */
export interface Student {
  id: string; firstName: string; lastName: string; gender: string; class: string; studentId: string;
  photo?: string; signature?: string; dateOfBirth?: string; placeOfBirth?: string; schoolYear?: string;
}
export interface SchoolInfo {
  name: string; directorName: string; directorPhone: string; directorGender?: "M" | "F";
}

export const CARD_WIDTH_MM = 88;
export const CARD_HEIGHT_MM = 52;
export const CARD_SCALE = 5;
export const CARD_WIDTH_PX = CARD_WIDTH_MM * CARD_SCALE; // 440
export const CARD_HEIGHT_PX = CARD_HEIGHT_MM * CARD_SCALE; // 260
