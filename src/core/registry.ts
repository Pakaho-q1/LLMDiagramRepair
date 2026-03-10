import type { DiagramKind, DiagramTypeEntry } from "../types/index.js";
export const DIAGRAM_REGISTRY: DiagramTypeEntry[] = [
  {
    keyword: "flowchart",
    aliases: [
      "graph",
      "flowChart",
      "flow_chart",
      "flow-chart",
      "Flow Chart",
      "diagram",
      "flowDiagram",
      "systemDiagram",
      "system_diagram",

      "networkDiagram",
      "network_diagram",
      "processDiagram",
      "process_diagram",
      "dataFlowDiagram",
      "data_flow_diagram",
    ],
  },
  {
    keyword: "sequenceDiagram",
    aliases: [
      "sequence",
      "sequencediagram",
      "sequence_diagram",
      "sequence-diagram",
      "SequenceDiagram",
      "Sequence Diagram",
      "seq",
      "seqDiagram",
    ],
  },
  {
    keyword: "classDiagram",
    aliases: [
      "classDiagram-v2",
      "classdiagram",
      "class_diagram",
      "class-diagram",
      "ClassDiagram",
      "Class Diagram",
      "class",
      "uml",
      "umlClass",
    ],
  },
  {
    keyword: "stateDiagram-v2",
    aliases: [
      "stateDiagram",
      "statediagram",
      "state_diagram",
      "state-diagram",
      "StateDiagram",
      "State Diagram",
      "fsm",
      "statemachine",
      "state_machine",
    ],
  },
  {
    keyword: "erDiagram",
    aliases: [
      "er",
      "erdDiagram",
      "er_diagram",
      "er-diagram",
      "ERDiagram",
      "ER Diagram",
      "entity",
      "entityRelationship",
      "entityRelationshipDiagram",
      "entity_relationship",
      "dbDiagram",
      "db_diagram",
      "databaseDiagram",
      "schematicDiagram",
      "dataModel",
      "data_model",
    ],
  },
  {
    keyword: "journey",
    aliases: [
      "userJourney",
      "user_journey",
      "user-journey",
      "User Journey",
      "customerJourney",
      "customer_journey",
      "experienceMap",
      "experience_map",
      "serviceBlueprint",
      "service_blueprint",
    ],
  },
  {
    keyword: "gantt",
    aliases: ["ganttChart", "gantt_chart", "Gantt", "Gantt Chart"],
  },
  {
    keyword: "pie",
    aliases: [
      "pieChart",
      "pie_chart",
      "pie-chart",
      "PieChart",
      "Pie Chart",
      "donut",
      "donutChart",
    ],
  },
  {
    keyword: "quadrantChart",
    aliases: [
      "quadrant",
      "quadrant_chart",
      "quadrant-chart",
      "Quadrant Chart",
      "quadrantChart-beta",
      "quadrant-beta",
      "QuadrantChart",
      "bcgMatrix",
      "bcg_matrix",
      "BCG Matrix",
      "matrixDiagram",
      "matrix_diagram",
      "priorityMatrix",
      "priority_matrix",
      "scatterPlot",
      "scatter_plot",
    ],
  },
  {
    keyword: "requirementDiagram",
    aliases: ["requirement", "requirements", "req", "requirementdiagram"],
  },
  {
    keyword: "gitGraph",
    aliases: [
      "gitgraph",
      "git",
      "git_graph",
      "git-graph",
      "GitGraph",
      "Git Graph",
      "gitflow",
    ],
  },
  {
    keyword: "C4Context",
    aliases: [
      "C4Container",
      "C4Component",
      "C4Dynamic",
      "C4Deployment",
      "c4context",
      "c4container",
      "c4component",
      "c4",
      "C4",
      "C4 Context",
      "C4 Diagram",
    ],
  },
  {
    keyword: "mindmap",
    aliases: ["mindMap", "mind_map", "mind-map", "MindMap", "Mind Map", "mm"],
  },
  {
    keyword: "timeline",
    aliases: ["Timeline", "time_line", "time-line"],
  },
  {
    keyword: "zenuml",
    aliases: ["ZenUML", "zen_uml", "zen-uml", "zenUml"],
  },
  {
    keyword: "sankey-beta",
    betaSuffix: true,
    aliases: [
      "sankey",
      "Sankey",
      "sankey_chart",
      "sankey-chart",
      "sankeyDiagram",
    ],
  },
  {
    keyword: "xychart-beta",
    betaSuffix: true,
    aliases: [
      "xychart",
      "XYChart",
      "xy_chart",
      "xy-chart",
      "lineChart",
      "line_chart",
      "line-chart",
      "linechart",
      "LineChart",
      "lineGraph",
      "line_graph",
      "line-graph",
      "LineGraph",
      "barChart",
      "bar_chart",
      "bar-chart",
      "barchart",
      "BarChart",
      "barGraph",
      "bar_graph",
      "bar-graph",
      "BarGraph",
      "columnChart",
      "column_chart",
      "column-chart",
      "ColumnChart",
      "chartLine",
      "chart_line",
      "chartBar",
      "chart_bar",
      "areaChart",
      "area_chart",
      "area-chart",
    ],
  },
  {
    keyword: "block-beta",
    betaSuffix: true,
    aliases: [
      "block",
      "Block",
      "blockDiagram",
      "block_diagram",
      "block-diagram",
      "layeredDiagram",
      "layered_diagram",
      "packet-beta",
      "stackDiagram",
      "stack_diagram",
      "packetDiagram",
      "packet_layout",
      "layerStack",
      "layer_stack",
    ],
  },
  {
    keyword: "packet-beta",
    betaSuffix: true,
    aliases: ["packet", "Packet", "packetDiagram", "network_packet"],
  },
  {
    keyword: "kanban",
    aliases: ["Kanban", "kanban_board", "kanban-board", "KanbanBoard"],
  },
  {
    keyword: "architecture-beta",
    betaSuffix: true,
    aliases: [
      "architecture",
      "Architecture",
      "arch",
      "archDiagram",
      "arch-diagram",
      "arch_diagram",
      "systemArchitecture",
      "system_architecture",
      "infraDiagram",
      "infra",

      "cloudArchitecture",
      "cloud_architecture",
      "microserviceDiagram",
      "microservice_diagram",
      "deploymentDiagram",
      "deployment_diagram",
      "infrastructureDiagram",
      "infrastructure",
      "awsDiagram",
      "gcpDiagram",
      "azureDiagram",
    ],
  },
  {
    keyword: "radar-beta",
    betaSuffix: true,
    aliases: [
      "radar",
      "Radar",
      "radarChart",
      "radar_chart",
      "radar-chart",
      "spiderChart",
      "spider_chart",
      "spider-chart",

      "spiderWeb",
      "spider_web",
      "polarChart",
      "polar_chart",
      "performanceRadar",
      "skillRadar",
      "competencyChart",
      "competency_chart",
    ],
  },
  {
    keyword: "treemap-beta",
    betaSuffix: true,
    aliases: ["treemap", "Treemap", "tree_map", "tree-map", "TreeMap"],
  },
  {
    keyword: "venn-beta",
    betaSuffix: true,
    aliases: [
      "venn",
      "Venn",
      "vennDiagram",
      "venn_diagram",
      "venn-diagram",
      "Venn Diagram",
      "VennDiagram",
      "overlap",
      "setDiagram",
      "set_diagram",

      "eulerDiagram",
      "euler_diagram",
      "circleOverlap",
      "circle_overlap",
      "intersectionDiagram",
      "intersection_diagram",
      "setIntersection",
      "set_intersection",
    ],
  },
];

export const ALIAS_TO_CANONICAL = new Map<string, string>();
export const CANONICAL_MAP = new Map<string, DiagramTypeEntry>();
export const XY_CHART_ALIASES = new Set<string>();
for (const entry of DIAGRAM_REGISTRY) {
  CANONICAL_MAP.set(entry.keyword.toLowerCase(), entry);
  ALIAS_TO_CANONICAL.set(entry.keyword.toLowerCase(), entry.keyword);
  for (const alias of entry.aliases) {
    ALIAS_TO_CANONICAL.set(alias.toLowerCase(), entry.keyword);
    if (entry.keyword === "xychart-beta") {
      XY_CHART_ALIASES.add(alias.toLowerCase());
    }
  }
}

export function resolveCanonical(raw: string): string | null {
  return ALIAS_TO_CANONICAL.get(raw.trim().toLowerCase()) ?? null;
}
export function getEntry(canonical: string): DiagramTypeEntry | null {
  return CANONICAL_MAP.get(canonical.toLowerCase()) ?? null;
}

export function isXYChartAlias(keyword: string): boolean {
  return XY_CHART_ALIASES.has(keyword.toLowerCase());
}
export function allAliasesFor(canonical: string): string[] {
  const entry = getEntry(canonical);
  if (!entry) return [];
  return [entry.keyword, ...entry.aliases];
}

export function toKind(canonical: string): DiagramKind {
  return canonical as DiagramKind;
}
