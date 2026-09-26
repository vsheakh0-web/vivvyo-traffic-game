import { VehicleCapacity, VehicleColor, VehicleLength } from '../game/types';

export interface ColorTheme {
  id: VehicleColor;
  name: string;
  symbol: string;
  shortCode: string;
  bodyHex: string;
  roofHex: string;
  trimHex: string;
  seatEmptyHex: string;
  textHex: string;
  glowRgba: string;
}

export const VEHICLE_COLORS: VehicleColor[] = [
  'RED',
  'BLUE',
  'GREEN',
  'AMBER',
  'PURPLE',
  'CYAN',
  'PINK',
  'ORANGE',
];

export const COLOR_PALETTE: Record<VehicleColor, ColorTheme> = {
  RED: {
    id: 'RED',
    name: 'Crimson Line',
    symbol: '★',
    shortCode: 'R',
    bodyHex: '#E11D48',
    roofHex: '#FB7185',
    trimHex: '#9F1239',
    seatEmptyHex: '#881337',
    textHex: '#FFFFFF',
    glowRgba: 'rgba(225, 29, 72, 0.45)',
  },
  BLUE: {
    id: 'BLUE',
    name: 'Cobalt Metro',
    symbol: '●',
    shortCode: 'B',
    bodyHex: '#2563EB',
    roofHex: '#60A5FA',
    trimHex: '#1E40AF',
    seatEmptyHex: '#1E3A8A',
    textHex: '#FFFFFF',
    glowRgba: 'rgba(37, 99, 235, 0.45)',
  },
  GREEN: {
    id: 'GREEN',
    name: 'Emerald Express',
    symbol: '▲',
    shortCode: 'G',
    bodyHex: '#059669',
    roofHex: '#34D399',
    trimHex: '#065F46',
    seatEmptyHex: '#064E3B',
    textHex: '#FFFFFF',
    glowRgba: 'rgba(5, 150, 105, 0.45)',
  },
  AMBER: {
    id: 'AMBER',
    name: 'Solar Shuttle',
    symbol: '◆',
    shortCode: 'Y',
    bodyHex: '#D97706',
    roofHex: '#FBBF24',
    trimHex: '#92400E',
    seatEmptyHex: '#78350F',
    textHex: '#FFFFFF',
    glowRgba: 'rgba(217, 119, 6, 0.45)',
  },
  PURPLE: {
    id: 'PURPLE',
    name: 'Violet Flyer',
    symbol: '⬡',
    shortCode: 'P',
    bodyHex: '#7C3AED',
    roofHex: '#A78BFA',
    trimHex: '#5B21B6',
    seatEmptyHex: '#4C1D95',
    textHex: '#FFFFFF',
    glowRgba: 'rgba(124, 58, 237, 0.45)',
  },
  CYAN: {
    id: 'CYAN',
    name: 'Aqua Cruiser',
    symbol: '⚡',
    shortCode: 'C',
    bodyHex: '#0891B2',
    roofHex: '#22D3EE',
    trimHex: '#155E75',
    seatEmptyHex: '#164E63',
    textHex: '#FFFFFF',
    glowRgba: 'rgba(8, 145, 178, 0.45)',
  },
  PINK: {
    id: 'PINK',
    name: 'Magenta Loop',
    symbol: '♥',
    shortCode: 'M',
    bodyHex: '#DB2777',
    roofHex: '#F472B6',
    trimHex: '#9D174D',
    seatEmptyHex: '#831843',
    textHex: '#FFFFFF',
    glowRgba: 'rgba(219, 39, 119, 0.45)',
  },
  ORANGE: {
    id: 'ORANGE',
    name: 'Tangerine Rapid',
    symbol: '■',
    shortCode: 'O',
    bodyHex: '#EA580C',
    roofHex: '#FB923C',
    trimHex: '#9A3412',
    seatEmptyHex: '#7C2D12',
    textHex: '#FFFFFF',
    glowRgba: 'rgba(234, 88, 12, 0.45)',
  },
};

export function capacityToLength(capacity: VehicleCapacity): VehicleLength {
  switch (capacity) {
    case 4:
      return 2;
    case 6:
      return 3;
    case 8:
      return 4;
  }
}

export function lengthToCapacity(length: VehicleLength): VehicleCapacity {
  switch (length) {
    case 2:
      return 4;
    case 3:
      return 6;
    case 4:
      return 8;
  }
}

export function getVehicleClassName(capacity: VehicleCapacity): string {
  switch (capacity) {
    case 4:
      return 'Mini-Shuttle (4 Seats)';
    case 6:
      return 'City Bus (6 Seats)';
    case 8:
      return 'Mega Coach (8 Seats)';
  }
}
