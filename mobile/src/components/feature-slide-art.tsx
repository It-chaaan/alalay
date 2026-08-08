import type { ReactNode } from 'react';
import Svg, { Circle, G, Path, Rect, Text as SvgText } from 'react-native-svg';
import { View } from 'react-native';

export const ART_WIDTH = 292;
export const ART_HEIGHT = 250;

export type FeaturePalette = {
  surface: string;
  ink: string;
  muted: string;
  accent: string;
  accentSoft: string;
  accentPale: string;
  line: string;
  white: string;
  bill: string;
  face: string;
};

function Canvas({ palette, label, children }: { palette: FeaturePalette; label: string; children: ReactNode }) {
  return <View accessible accessibilityLabel={label}><Svg width={ART_WIDTH} height={ART_HEIGHT} viewBox={`0 0 ${ART_WIDTH} ${ART_HEIGHT}`}>{children}</Svg></View>;
}

function Card({ palette, x, y, width, height, fill = palette.surface }: { palette: FeaturePalette; x: number; y: number; width: number; height: number; fill?: string }) {
  return <Rect x={x} y={y} width={width} height={height} rx={11} fill={fill} stroke={palette.line} strokeWidth={1} />;
}

function Label({ palette, x, y, children, fill = palette.muted, size = 8 }: { palette: FeaturePalette; x: number; y: number; children: string; fill?: string; size?: number }) {
  return <SvgText x={x} y={y} fill={fill} fontSize={size} fontWeight="700">{children}</SvgText>;
}

function Heading({ palette, eyebrow, title }: { palette: FeaturePalette; eyebrow: string; title: string }) {
  return <><Rect x={34} y={4} width={126} height={34} rx={9} fill={palette.accentPale} /><SvgText x={44} y={16} fill={palette.accent} fontSize={7} fontWeight="700">{eyebrow}</SvgText><SvgText x={44} y={31} fill={palette.ink} fontSize={17} fontWeight="800">{title}</SvgText></>;
}

export function OverviewArt({ palette }: { palette: FeaturePalette }) {
  const bars = [28, 46, 34, 62, 42];
  return <Canvas palette={palette} label="A preview of your finances in Alalay"><Circle cx="139" cy="113" r="104" fill={palette.accentPale} /><Circle cx="10" cy="100" r="9" fill={palette.accentSoft} opacity={0.75} /><Rect x="29" y="35" width="138" height="102" rx="11" fill={palette.accent} /><Label palette={palette} x={42} y={53} fill={palette.white} size={9}>Overview</Label><Circle cx="154" cy="49" r="3" fill={palette.white} opacity={0.75} /><Rect x="42" y="72" width="70" height="4" rx="2" fill={palette.white} opacity={0.92} /><Rect x="42" y="82" width="45" height="4" rx="2" fill={palette.white} opacity={0.56} /><Rect x="42" y="108" width="40" height="3" rx="2" fill={palette.white} opacity={0.55} /><Rect x="87" y="108" width="25" height="3" rx="2" fill={palette.white} opacity={0.32} /><Card palette={palette} x={151} y={51} width={123} height={108} /><Label palette={palette} x={163} y={67}>Spending</Label>{bars.map((height, index) => <Rect key={index} x={164 + index * 19} y={146 - height} width={10} height={height} rx={4} fill={index === 3 ? palette.accent : palette.accentSoft} />)}<Card palette={palette} x={15} y={133} width={141} height={88} fill={palette.bill} /><Label palette={palette} x={25} y={150} fill={palette.ink}>Upcoming bills</Label><Rect x={25} y={164} width={22} height={9} rx={3} fill={palette.accent} /><Rect x={54} y={164} width={66} height={4} rx={2} fill={palette.line} /><Rect x={54} y={172} width={39} height={4} rx={2} fill={palette.line} /><Rect x={25} y={186} width={22} height={9} rx={3} fill={palette.accentSoft} /><Rect x={54} y={186} width={66} height={4} rx={2} fill={palette.line} /><Rect x={54} y={194} width={39} height={4} rx={2} fill={palette.line} /><Card palette={palette} x={143} y={146} width={142} height={82} /><Label palette={palette} x={153} y={163}>Savings progress</Label><Rect x={153} y={174} width={79} height={7} rx={4} fill={palette.accentPale} /><Rect x={153} y={174} width={33} height={7} rx={4} fill={palette.accent} /><SvgText x={239} y={181} fill={palette.ink} fontSize={11} fontWeight="800">42%</SvgText><Rect x={153} y={199} width={82} height={4} rx={2} fill={palette.line} /><Circle cx="128" cy="164" r="34" fill={palette.accentPale} /><Circle cx="146" cy="146" r="16" fill={palette.ink} /><Circle cx="149" cy="156" r="13" fill={palette.face} /><Path d="M137 179 Q162 166 178 191 H128Z" fill={palette.accent} /><Circle cx="260" cy="34" r="16" fill={palette.surface} stroke={palette.line} /><SvgText x="254" y="40" fill={palette.accent} fontSize={15} fontWeight="800">₱</SvgText></Canvas>;
}

export function BudgetArt({ palette }: { palette: FeaturePalette }) {
  const rows = [['Needs', '₱18,400', 0.72, palette.accent], ['Wants', '₱7,200', 0.45, palette.accentSoft], ['Savings', '₱9,400', 0.58, palette.accent]] as const;
  return <Canvas palette={palette} label="A preview of budget planning"><Heading palette={palette} eyebrow="Plan with confidence" title="Budget" /><Card palette={palette} x={38} y={45} width={176} height={156} /><Label palette={palette} x={50} y={64}>Monthly plan</Label><SvgText x={50} y={91} fill={palette.ink} fontSize={23} fontWeight="800">₱35,000</SvgText><Label palette={palette} x={50} y={103}>Total budget</Label>{rows.map(([label, value, ratio, color], index) => <G key={label}><Label palette={palette} x={50} y={126 + index * 22}>{label}</Label><SvgText x={191} y={126 + index * 22} fill={palette.ink} fontSize={8} fontWeight="700" textAnchor="end">{value}</SvgText><Rect x={50} y={131 + index * 22} width={140} height={5} rx={3} fill={palette.accentPale} /><Rect x={50} y={131 + index * 22} width={140 * ratio} height={5} rx={3} fill={color} /></G>)}<Card palette={palette} x={139} y={185} width={125} height={58} /><Label palette={palette} x={151} y={203}>Actual</Label><SvgText x={151} y={223} fill={palette.ink} fontSize={16} fontWeight="800">₱25,600</SvgText><Rect x={228} y={52} width={42} height={20} rx={10} fill={palette.accent} /><SvgText x={249} y={66} fill={palette.white} fontSize={8} fontWeight="700" textAnchor="middle">On track</SvgText></Canvas>;
}

export function ReportsArt({ palette }: { palette: FeaturePalette }) {
  const bars = [42, 36, 48, 29, 40, 22, 31, 16];
  return <Canvas palette={palette} label="A preview of spending reports"><Heading palette={palette} eyebrow="See the bigger picture" title="Reports" /><Card palette={palette} x={28} y={45} width={195} height={125} /><Label palette={palette} x={40} y={64}>Daily spending trend</Label><Rect x={40} y={72} width={171} height={78} rx={9} fill={palette.accentPale} />{bars.map((height, index) => <Rect key={index} x={48 + index * 20} y={141 - height} width={11} height={height} rx={4} fill={index === 5 ? palette.accent : palette.accentSoft} />)}<Path d="M43 125 C72 118 77 93 101 110 S132 132 149 101 S181 126 211 84" fill="none" stroke={palette.accent} strokeWidth={2.5} /><Label palette={palette} x={42} y={160}>Mon</Label><Label palette={palette} x={119} y={160}>Wed</Label><Label palette={palette} x={194} y={160}>Sun</Label><Card palette={palette} x={130} y={183} width={145} height={65} /><Label palette={palette} x={141} y={201}>Category breakdown</Label><Circle cx="155" cy="224" r="14" fill={palette.accentPale} stroke={palette.accent} strokeWidth={7} /><SvgText x="146" y="227" fill={palette.ink} fontSize={6} fontWeight="800">₱14k</SvgText><Label palette={palette} x={179} y={218}>Needs 42%</Label><Label palette={palette} x={179} y={229}>Food 26%</Label><Label palette={palette} x={179} y={240}>Others 32%</Label></Canvas>;
}

export function AssistantOcrArt({ palette }: { palette: FeaturePalette }) {
  return <Canvas palette={palette} label="A preview of Ask Alalay and receipt scanning"><Heading palette={palette} eyebrow="A little help, right when you need it" title="Ask Alalay" /><Card palette={palette} x={28} y={45} width={195} height={125} /><Label palette={palette} x={40} y={64}>AI assistant</Label><Rect x={84} y={76} width={127} height={29} rx={10} fill={palette.accentPale} /><SvgText x={94} y={89} fill={palette.ink} fontSize={7}>How can I save more?</SvgText><SvgText x={94} y={99} fill={palette.ink} fontSize={7}>for my savings goal?</SvgText><Rect x={40} y={113} width={132} height={29} rx={10} fill={palette.accent} /><SvgText x={50} y={131} fill={palette.white} fontSize={7}>Let&apos;s look at your budget.</SvgText><Card palette={palette} x={118} y={183} width={155} height={65} /><Label palette={palette} x={129} y={201}>OCR scanner</Label><Rect x={129} y={210} width={133} height={27} rx={7} fill={palette.accentPale} stroke={palette.accent} strokeDasharray="4 3" /><SvgText x={139} y={225} fill={palette.accent} fontSize={8} fontWeight="700">Scan a receipt</SvgText></Canvas>;
}
