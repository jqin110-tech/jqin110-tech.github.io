import type { CriterionId } from './data';

export type ZoneKind = 'brief' | 'campus' | 'workshop' | 'tower' | 'observatory' | 'signal';

export interface Look {
  r: number; // planet radius in world units
  base: string;
  light: string;
  dark: string;
  glow: string;
  ring?: boolean;
  bands?: boolean;
  moon?: boolean;
  station?: boolean;
}

export interface Zone {
  id: ZoneKind;
  x: number;
  y: number;
  code: string; // catalog label shown on the map
  title: string; // room title
  section: string; // resume section
  criteria: CriterionId[];
  look: Look;
  t: number; // angle along the golden spiral
}

/** Galaxy radius: the edge of the playable map. */
export const GALAXY_R = 1500;

type Def = Omit<Zone, 'x' | 'y' | 't'>;

// The tour follows a golden spiral: radius shrinks by φ every quarter turn as it winds toward the core.
const defs: Def[] = [
  { id: 'brief', code: 'ORIGIN', title: 'About', section: 'Introduction', criteria: [],
    look: { r: 26, base: '#c9ccd6', light: '#ffffff', dark: '#3a3f52', glow: '#9fc4ff', station: true } },
  { id: 'campus', code: 'PLANET 01', title: 'Education', section: 'University of Waterloo', criteria: ['grad'],
    look: { r: 62, base: '#4f8fd6', light: '#bfe0ff', dark: '#0d1d3a', glow: '#7fb6ff', moon: true } },
  { id: 'workshop', code: 'PLANET 02', title: 'Projects', section: 'Selected work', criteria: ['webmobile', 'project', 'design'],
    look: { r: 78, base: '#d98a4e', light: '#ffd9a8', dark: '#3a160a', glow: '#ffb070', bands: true } },
  { id: 'tower', code: 'PLANET 03', title: 'Experience', section: 'Work & volunteering', criteria: ['starter'],
    look: { r: 58, base: '#5fae8c', light: '#c8f2dc', dark: '#0b2a20', glow: '#8fe0bb' } },
  { id: 'observatory', code: 'PLANET 04', title: 'Skills', section: 'Tools and interests', criteria: ['curious', 'quality'],
    look: { r: 66, base: '#c9b48a', light: '#fff1d0', dark: '#2e2410', glow: '#f0d9a0', bands: true, ring: true } },
  { id: 'signal', code: 'PLANET 05', title: 'Contact', section: 'Get in touch', criteria: [],
    look: { r: 44, base: '#e8e3d6', light: '#ffffff', dark: '#3a3a44', glow: '#e8b86b', ring: true } },
];

export const PHI = (1 + Math.sqrt(5)) / 2;
const SPIRAL_R0 = 1260; // radius where the spiral (and the tour) begins
const SPIRAL_A0 = (200 * Math.PI) / 180; // starting direction
const SPIRAL_END_R = 390; // radius of the last planet

/** Point on the golden spiral r = R0 · φ^(-2t/π), t in radians from the start. */
export function spiral(t: number) {
  const r = SPIRAL_R0 * Math.pow(PHI, (-2 * t) / Math.PI);
  const a = SPIRAL_A0 + t;
  return { x: Math.cos(a) * r, y: Math.sin(a) * r, r };
}
/** Total spiral angle from the first planet to the last. */
export const SPIRAL_SPAN = (Math.log(SPIRAL_R0 / SPIRAL_END_R) / Math.log(PHI)) * (Math.PI / 2);

export const zones: Zone[] = defs.map((z, i) => {
  // equal spacing along the curve: arc length on a log spiral grows linearly with radius
  const r = SPIRAL_R0 - (i / (defs.length - 1)) * (SPIRAL_R0 - SPIRAL_END_R);
  const t = (Math.log(SPIRAL_R0 / r) / Math.log(PHI)) * (Math.PI / 2);
  const p = spiral(t);
  return { ...z, t, x: Math.round(p.x), y: Math.round(p.y) };
});
