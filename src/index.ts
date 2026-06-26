interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * INEGI DENUE MCP — Mexico's directory of economic units (~6M businesses).
 *
 * API: https://www.inegi.org.mx/servicios/api_denue.html
 * Auth: token as last path segment. Register at https://www.inegi.org.mx/app/api/denue/registro/
 *
 * State codes (cve_ent) are two-digit "01"-"32" or "00" for all of Mexico:
 *   01 Aguascalientes, 02 Baja California, 03 Baja California Sur, 04 Campeche,
 *   05 Coahuila, 06 Colima, 07 Chiapas, 08 Chihuahua, 09 Ciudad de México,
 *   10 Durango, 11 Guanajuato, 12 Guerrero, 13 Hidalgo, 14 Jalisco,
 *   15 México (Estado), 16 Michoacán, 17 Morelos, 18 Nayarit, 19 Nuevo León,
 *   20 Oaxaca, 21 Puebla, 22 Querétaro, 23 Quintana Roo, 24 San Luis Potosí,
 *   25 Sinaloa, 26 Sonora, 27 Tabasco, 28 Tamaulipas, 29 Tlaxcala,
 *   30 Veracruz, 31 Yucatán, 32 Zacatecas.
 */


const BASE = 'https://www.inegi.org.mx/app/api/denue/v1/consulta';

const tools: McpToolExport['tools'] = [
  {
    name: 'denue_search_nearby',
    description:
      'Find businesses near a coordinate. Returns establishments matching the keyword within the given radius (max 5000m).',
    inputSchema: {
      type: 'object',
      properties: {
        condition: {
          type: 'string',
          description:
            'Search keyword — business name, brand, or activity (e.g., "oxxo", "cafe", "farmacia"). Use "todos" for all establishments in radius.',
        },
        lat: { type: 'number', description: 'Latitude (decimal degrees)' },
        lng: { type: 'number', description: 'Longitude (decimal degrees)' },
        radius_m: { type: 'number', description: 'Search radius in meters (1-5000, default 500)' },
      },
      required: ['condition', 'lat', 'lng'],
    },
  },
  {
    name: 'denue_search_by_name',
    description:
      'Search businesses by name or brand across Mexico or a single state. Paginated — set page_size and page_start to walk results.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Business name or brand (e.g., "walmart", "cemex")' },
        state_code: {
          type: 'string',
          description: 'Two-digit state code "01"-"32", or "00" for all Mexico. Default "00".',
        },
        page_start: { type: 'number', description: 'First record (1-based, default 1)' },
        page_end: { type: 'number', description: 'Last record (default page_start + 24, max ~1000 per request)' },
      },
      required: ['name'],
    },
  },
  {
    name: 'denue_search_in_state',
    description:
      'Search businesses in a single Mexican state by keyword — matches against name, activity, or address. Use this for state-scoped queries that need more than just business name (e.g., "panaderia", "ferreteria"). Returns paginated results.',
    inputSchema: {
      type: 'object',
      properties: {
        keyword: {
          type: 'string',
          description: 'Search term — matches name, economic activity description, or address text.',
        },
        state_code: { type: 'string', description: 'Two-digit state code "01"-"32" (required — use denue_search_by_name with "00" for nationwide).' },
        page_start: { type: 'number', description: 'First record (1-based, default 1)' },
        page_end: { type: 'number', description: 'Last record (default page_start + 24)' },
      },
      required: ['keyword', 'state_code'],
    },
  },
  {
    name: 'denue_establishment',
    description: 'Get full details for a single establishment by DENUE ID (the "Id" field from search results).',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Establishment Id (numeric string, e.g., "9988845")' },
      },
      required: ['id'],
    },
  },
  {
    name: 'denue_count',
    description:
      'Count establishments by economic activity + geography + size stratum. Returns totals — no detail records. Use for market-sizing questions like "how many pharmacies are in Jalisco".',
    inputSchema: {
      type: 'object',
      properties: {
        activity_code: {
          type: 'string',
          description:
            'SCIAN economic activity code(s), comma-separated. 2-6 digits (sector → branch → class). Use "0" for any activity. Examples: "46" (retail), "722" (food services), "464111" (pharmacies).',
        },
        area_code: {
          type: 'string',
          description:
            'Geography code(s), comma-separated. "00" = all Mexico; 2 digits = state; 5 digits = municipality (state+mun). Examples: "09" (CDMX), "14039" (Guadalajara).',
        },
        stratum: {
          type: 'string',
          description:
            'Employee-size stratum: 0=any, 1=0-5, 2=6-10, 3=11-30, 4=31-50, 5=51-100, 6=101-250, 7=251+. Default "0".',
        },
      },
      required: ['activity_code', 'area_code'],
    },
  },
];

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = (args._apiKey as string | undefined)?.trim();
  if (!apiKey) {
    throw new Error(
      'DENUE requires an INEGI API token. Contact the operator about platform credentials, or BYO via ?_apiKey=<token> after registering at https://www.inegi.org.mx/app/api/denue/registro/ (allow ~3 days for INEGI to email the token).',
    );
  }

  switch (name) {
    case 'denue_search_nearby':
      return searchNearby(apiKey, args);
    case 'denue_search_by_name':
      return searchByName(apiKey, args);
    case 'denue_search_in_state':
      return searchInState(apiKey, args);
    case 'denue_establishment':
      return establishment(apiKey, args);
    case 'denue_count':
      return count(apiKey, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

async function searchNearby(token: string, args: Record<string, unknown>) {
  const condition = reqStr(args, 'condition', '"oxxo"');
  const lat = reqNum(args, 'lat');
  const lng = reqNum(args, 'lng');
  const radius = clamp(numArg(args, 'radius_m', 500), 1, 5000);
  return denueGet(`/Buscar/${encodeURIComponent(condition)}/${lat},${lng}/${radius}/${token}`);
}

async function searchByName(token: string, args: Record<string, unknown>) {
  const name = reqStr(args, 'name', '"walmart"');
  const stateCode = validateStateCode((args.state_code as string | undefined) ?? '00');
  const start = Math.max(1, numArg(args, 'page_start', 1));
  const end = Math.max(start, numArg(args, 'page_end', start + 24));
  return denueGet(`/Nombre/${encodeURIComponent(name)}/${stateCode}/${start}/${end}/${token}`);
}

async function searchInState(token: string, args: Record<string, unknown>) {
  const keyword = reqStr(args, 'keyword', '"panaderia"');
  const stateCode = validateStateCode(reqStr(args, 'state_code', '"09"'), { allowAll: false });
  const start = Math.max(1, numArg(args, 'page_start', 1));
  const end = Math.max(start, numArg(args, 'page_end', start + 24));
  return denueGet(`/BuscarEntidad/${encodeURIComponent(keyword)}/${stateCode}/${start}/${end}/${token}`);
}

async function establishment(token: string, args: Record<string, unknown>) {
  const id = reqStr(args, 'id', '"9988845"');
  return denueGet(`/Ficha/${encodeURIComponent(id)}/${token}`);
}

async function count(token: string, args: Record<string, unknown>) {
  const activity = reqStr(args, 'activity_code', '"46"');
  const area = reqStr(args, 'area_code', '"09"');
  const stratum = (args.stratum as string | undefined)?.trim() || '0';
  return denueGet(`/Cuantificar/${encodeURIComponent(activity)}/${encodeURIComponent(area)}/${encodeURIComponent(stratum)}/${token}`);
}

async function denueGet(path: string): Promise<unknown> {
  const url = `${BASE}${path}`;
  const res = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': 'pipeworx-mcp-denue/1.0 (+https://pipeworx.io)' },
  });
  if (res.status === 401 || res.status === 403) {
    throw new Error('DENUE: token rejected (HTTP ' + res.status + '). Verify the token is active at https://www.inegi.org.mx/app/api/denue/');
  }
  if (res.status === 404) {
    // DENUE returns 404 with a JSON-encoded message when a query has no matches —
    // bubble it back as data rather than an error so agents can handle empty sets.
    const text = await res.text();
    return { results: [], note: text.slice(0, 200) || 'No results' };
  }
  if (res.status === 429) throw new Error('DENUE: rate-limit (HTTP 429)');
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DENUE error: ${res.status} ${text.slice(0, 200)}`);
  }
  return res.json();
}

function reqStr(args: Record<string, unknown>, key: string, example: string): string {
  const v = args[key];
  if (typeof v !== 'string' || !v.trim()) {
    throw new Error(`Required argument "${key}" is missing. Pass a string like ${example}.`);
  }
  return v.trim();
}

function reqNum(args: Record<string, unknown>, key: string): number {
  const v = args[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) {
    throw new Error(`Required argument "${key}" is missing or not a number.`);
  }
  return v;
}

function numArg(args: Record<string, unknown>, key: string, fallback: number): number {
  const v = args[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function validateStateCode(raw: string, opts?: { allowAll?: boolean }): string {
  const code = raw.trim().padStart(2, '0');
  if (!/^\d{2}$/.test(code)) {
    throw new Error(`state_code must be 2 digits "01"-"32" (or "00" for nationwide). Got "${raw}".`);
  }
  const n = Number(code);
  const allowAll = opts?.allowAll !== false;
  if (n === 0 && !allowAll) {
    throw new Error('state_code "00" (nationwide) is not supported here — pass a specific state ("01"-"32").');
  }
  if (n > 32) {
    throw new Error(`state_code out of range — Mexico has 32 states. Got "${raw}".`);
  }
  return code;
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
