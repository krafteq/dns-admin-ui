import './network-bg.css';

/**
 * Network abstraction background — pure CSS + SVG, fully static.
 * Combines: connected node mesh, circuit traces with 90° turns,
 * floating device blocks, magenta junction nodes, depth glow.
 */

// --- Mesh nodes (dots scattered across the scene) --------------------
interface MeshNode { x: number; y: number; r: number; bright?: boolean }

const MESH_NODES: MeshNode[] = [
  // Dense center cluster
  { x: 480, y: 280, r: 2.5, bright: true }, { x: 520, y: 310, r: 2.5, bright: true },
  { x: 500, y: 260, r: 2, bright: true }, { x: 500, y: 340, r: 2 },
  { x: 460, y: 310, r: 1.8 }, { x: 540, y: 280, r: 1.8 },
  // Mid-range spread
  { x: 350, y: 200, r: 2, bright: true }, { x: 650, y: 180, r: 2, bright: true },
  { x: 300, y: 350, r: 1.8 }, { x: 700, y: 380, r: 2 },
  { x: 400, y: 150, r: 1.5 }, { x: 600, y: 420, r: 1.5 },
  { x: 250, y: 250, r: 1.8, bright: true }, { x: 750, y: 280, r: 1.8, bright: true },
  { x: 380, y: 400, r: 1.5 }, { x: 620, y: 140, r: 1.5 },
  { x: 320, y: 120, r: 1.3 }, { x: 680, y: 450, r: 1.3 },
  { x: 450, y: 450, r: 1.5 }, { x: 550, y: 100, r: 1.5 },
  // Far edges
  { x: 150, y: 180, r: 1.5 }, { x: 850, y: 200, r: 1.5 },
  { x: 120, y: 350, r: 1.3 }, { x: 880, y: 400, r: 1.3 },
  { x: 200, y: 450, r: 1 }, { x: 800, y: 120, r: 1 },
  { x: 100, y: 100, r: 1 }, { x: 900, y: 500, r: 1 },
  { x: 180, y: 500, r: 1.2 }, { x: 820, y: 80, r: 1.2 },
  { x: 50, y: 250, r: 0.8 }, { x: 950, y: 300, r: 0.8 },
  { x: 70, y: 420, r: 0.8 }, { x: 930, y: 150, r: 0.8 },
  { x: 280, y: 500, r: 1 }, { x: 720, y: 60, r: 1 },
  { x: 420, y: 80, r: 1.2 }, { x: 580, y: 500, r: 1.2 },
  { x: 160, y: 280, r: 1 }, { x: 840, y: 330, r: 1 },
];

// --- Mesh connections (pairs of node indices) ------------------------
const MESH_LINKS: [number, number, boolean?][] = [
  // Center mesh
  [0, 1], [0, 2], [1, 3], [2, 4], [1, 5], [0, 4], [2, 5], [3, 4],
  // Center to mid
  [4, 6, true], [5, 7, true], [3, 8], [1, 9], [2, 10], [3, 11],
  [0, 12, true], [1, 13, true], [4, 14], [5, 15],
  // Mid to mid
  [6, 10], [7, 15], [8, 14], [9, 11], [6, 12], [7, 13],
  [12, 16], [13, 17], [14, 18], [15, 19],
  [10, 16], [11, 17],
  // Mid to far
  [6, 20], [7, 21], [8, 22], [9, 23], [12, 20], [13, 21],
  [16, 26], [17, 27], [18, 28], [19, 29],
  [20, 30], [21, 31], [22, 32], [23, 33],
  [14, 34], [15, 35], [10, 36], [11, 37],
  [20, 38], [21, 39],
  [12, 38], [13, 39],
];

// --- Circuit traces (90° turn paths) --------------------------------
const TRACES: { points: string; accent?: boolean }[] = [
  // Right-spreading
  { points: '500,290 600,290 600,200 720,200 720,130 830,130' },
  { points: '510,310 580,310 580,380 700,380 700,440 790,440' },
  { points: '520,300 590,300 590,240 710,240 710,170 800,170', accent: true },
  { points: '500,300 560,300 560,350 660,350 660,280 780,280' },
  // Left-spreading
  { points: '490,290 400,290 400,200 280,200 280,130 170,130' },
  { points: '480,310 420,310 420,380 300,380 300,440 210,440' },
  { points: '490,300 410,300 410,240 290,240 290,170 200,170', accent: true },
  { points: '500,300 440,300 440,350 340,350 340,280 220,280' },
  // Vertical
  { points: '500,280 500,200 560,200 560,120 620,120' },
  { points: '500,320 500,400 440,400 440,480 380,480' },
  { points: '490,270 490,180 430,180 430,90', accent: true },
  { points: '510,330 510,420 570,420 570,510', accent: true },
];

// --- Magenta junction nodes ------------------------------------------
interface JNode { x: number; y: number; size: 'sm' | 'md' | 'lg' }

const JNODES: JNode[] = [
  // Trace turns — right
  { x: 60, y: 33.3, size: 'sm' }, { x: 72, y: 20, size: 'md' }, { x: 83, y: 13, size: 'lg' },
  { x: 70, y: 38, size: 'sm' }, { x: 79, y: 44, size: 'md' },
  { x: 71, y: 24, size: 'sm' }, { x: 80, y: 17, size: 'md' },
  { x: 66, y: 35, size: 'sm' }, { x: 78, y: 28, size: 'lg' },
  // Trace turns — left
  { x: 40, y: 33.3, size: 'sm' }, { x: 28, y: 20, size: 'md' }, { x: 17, y: 13, size: 'lg' },
  { x: 30, y: 38, size: 'sm' }, { x: 21, y: 44, size: 'md' },
  { x: 29, y: 24, size: 'sm' }, { x: 20, y: 17, size: 'md' },
  { x: 34, y: 35, size: 'sm' }, { x: 22, y: 28, size: 'lg' },
  // Trace turns — vertical
  { x: 56, y: 20, size: 'sm' }, { x: 62, y: 12, size: 'md' },
  { x: 44, y: 40, size: 'sm' }, { x: 38, y: 48, size: 'md' },
  { x: 43, y: 18, size: 'sm' }, { x: 43, y: 9, size: 'lg' },
  { x: 57, y: 42, size: 'sm' }, { x: 57, y: 51, size: 'md' },
  // Center
  { x: 50, y: 30, size: 'lg' },
];

// --- Floating device blocks ------------------------------------------
interface Device { x: number; y: number; w: number; h: number; filled?: boolean }

const DEVICES: Device[] = [
  { x: 140, y: 140, w: 16, h: 12 }, { x: 830, y: 160, w: 14, h: 10, filled: true },
  { x: 200, y: 380, w: 12, h: 10 }, { x: 780, y: 420, w: 16, h: 12, filled: true },
  { x: 110, y: 280, w: 10, h: 8 }, { x: 870, y: 300, w: 12, h: 10 },
  { x: 300, y: 80, w: 14, h: 10, filled: true }, { x: 700, y: 500, w: 14, h: 10 },
  { x: 60, y: 180, w: 10, h: 8 }, { x: 920, y: 240, w: 10, h: 8, filled: true },
  { x: 240, y: 460, w: 12, h: 10 }, { x: 760, y: 80, w: 12, h: 10, filled: true },
  { x: 170, y: 60, w: 10, h: 8 }, { x: 850, y: 470, w: 10, h: 8 },
  { x: 380, y: 500, w: 12, h: 8, filled: true }, { x: 620, y: 50, w: 12, h: 8 },
];

export function NetworkBackground() {
  return (
    <div className="net-bg" aria-hidden="true">
      {/* Glow layers */}
      <div className="net-bg__center-glow" />
      <div className="net-bg__edge-glow net-bg__edge-glow--tl" />
      <div className="net-bg__edge-glow net-bg__edge-glow--br" />

      {/* All SVG elements in one layer */}
      <svg className="net-bg__svg" viewBox="0 0 1000 560" preserveAspectRatio="xMidYMid slice">
        {/* Mesh connection lines */}
        {MESH_LINKS.map(([a, b, bright], i) => {
          const na = MESH_NODES[a], nb = MESH_NODES[b];
          if (!na || !nb) return null;
          return (
            <line
              key={`ml${i}`}
              className={`net-bg__mesh-line${bright ? ' net-bg__mesh-line--bright' : ''}`}
              x1={na.x} y1={na.y} x2={nb.x} y2={nb.y}
            />
          );
        })}

        {/* Circuit traces */}
        {TRACES.map((t, i) => (
          <polyline
            key={`tr${i}`}
            className={`net-bg__trace${t.accent ? ' net-bg__trace--accent' : ''}`}
            points={t.points}
          />
        ))}

        {/* Floating device blocks */}
        {DEVICES.map((d, i) => (
          <rect
            key={`dv${i}`}
            className={`net-bg__device${d.filled ? ' net-bg__device--filled' : ''}`}
            x={d.x} y={d.y} width={d.w} height={d.h} rx={1}
          />
        ))}

        {/* Mesh nodes (dots) */}
        {MESH_NODES.map((n, i) => (
          <circle
            key={`mn${i}`}
            className={`net-bg__mesh-node${n.bright ? '' : ' net-bg__mesh-node--dim'}`}
            cx={n.x} cy={n.y} r={n.r}
          />
        ))}
      </svg>

      {/* Magenta junction nodes (CSS for glow box-shadow) */}
      {JNODES.map((n, i) => (
        <div
          key={`jn${i}`}
          className={`net-bg__node net-bg__node--${n.size}`}
          style={{ left: `${n.x}%`, top: `${n.y}%` }}
        />
      ))}
    </div>
  );
}
