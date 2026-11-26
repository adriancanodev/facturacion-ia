import { describe, expect, it } from "vitest";

import {
  CLIENT_SEARCH_MAX_LENGTH,
  buildClientSearchFilter,
  quotePostgrestValue,
  readClientSearchQuery,
  toContainsLikePattern,
} from "@/lib/domain/client-search";

describe("readClientSearchQuery", () => {
  it("devuelve el término sin espacios alrededor", () => {
    expect(readClientSearchQuery("  Talleres  ")).toBe("Talleres");
  });

  it("conserva los espacios interiores", () => {
    expect(readClientSearchQuery("Talleres del Norte")).toBe(
      "Talleres del Norte",
    );
  });

  it("devuelve vacío si no hay parámetro", () => {
    expect(readClientSearchQuery(undefined)).toBe("");
  });

  it("devuelve vacío con una cadena vacía o solo espacios", () => {
    expect(readClientSearchQuery("")).toBe("");
    expect(readClientSearchQuery("   \t  ")).toBe("");
  });

  it("usa el primer valor si el parámetro se repite", () => {
    expect(readClientSearchQuery(["acme", "otro"])).toBe("acme");
  });

  it("devuelve vacío con un array vacío", () => {
    expect(readClientSearchQuery([])).toBe("");
  });

  it("cambia los caracteres de control (como el byte nulo) por espacios", () => {
    expect(readClientSearchQuery("ac\u0000me\n")).toBe("ac me");
  });

  it("recorta a la longitud máxima", () => {
    const long = "a".repeat(CLIENT_SEARCH_MAX_LENGTH + 50);
    expect(readClientSearchQuery(long)).toHaveLength(CLIENT_SEARCH_MAX_LENGTH);
  });

  it("deja intacto un término con la longitud máxima exacta", () => {
    const exact = "b".repeat(CLIENT_SEARCH_MAX_LENGTH);
    expect(readClientSearchQuery(exact)).toBe(exact);
  });

  it("no parte un emoji al recortar", () => {
    const long = "😀".repeat(CLIENT_SEARCH_MAX_LENGTH + 1);
    const result = readClientSearchQuery(long);
    expect(Array.from(result)).toHaveLength(CLIENT_SEARCH_MAX_LENGTH);
    expect(result).toBe("😀".repeat(CLIENT_SEARCH_MAX_LENGTH));
  });

  it("quita el espacio que queda al final tras recortar", () => {
    const text = `${"a".repeat(CLIENT_SEARCH_MAX_LENGTH - 1)} b`;
    expect(readClientSearchQuery(text)).toBe(
      "a".repeat(CLIENT_SEARCH_MAX_LENGTH - 1),
    );
  });
});

describe("toContainsLikePattern", () => {
  it("rodea el texto con % para buscar 'contiene'", () => {
    expect(toContainsLikePattern("acme")).toBe("%acme%");
  });

  it("escapa el comodín %", () => {
    expect(toContainsLikePattern("50%")).toBe("%50\\%%");
  });

  it("escapa el comodín _", () => {
    expect(toContainsLikePattern("a_b")).toBe("%a\\_b%");
  });

  it("escapa la barra invertida", () => {
    expect(toContainsLikePattern("a\\b")).toBe("%a\\\\b%");
  });

  it("cambia * por _ (PostgREST convierte * en %)", () => {
    expect(toContainsLikePattern("a*b")).toBe("%a_b%");
  });

  it("no toca comas, paréntesis ni comillas (eso lo hace el entrecomillado)", () => {
    expect(toContainsLikePattern('a,(b)"c')).toBe('%a,(b)"c%');
  });
});

describe("quotePostgrestValue", () => {
  it("entrecomilla el valor", () => {
    expect(quotePostgrestValue("acme")).toBe('"acme"');
  });

  it("escapa las comillas dobles", () => {
    expect(quotePostgrestValue('di "hola"')).toBe('"di \\"hola\\""');
  });

  it("escapa la barra invertida", () => {
    expect(quotePostgrestValue("a\\b")).toBe('"a\\\\b"');
  });

  it("no necesita escapar comas, puntos, dos puntos ni paréntesis", () => {
    expect(quotePostgrestValue("a,b.c:d(e)")).toBe('"a,b.c:d(e)"');
  });

  it("entrecomilla también el valor vacío", () => {
    expect(quotePostgrestValue("")).toBe('""');
  });
});

describe("buildClientSearchFilter", () => {
  it("no filtra si el término está vacío", () => {
    expect(buildClientSearchFilter("")).toBeNull();
  });

  it("no filtra si solo había espacios (tras leer el parámetro)", () => {
    expect(buildClientSearchFilter(readClientSearchQuery("    "))).toBeNull();
  });

  it("busca en nombre, NIF/CIF y email con un término normal", () => {
    expect(buildClientSearchFilter("acme")).toBe(
      'name.ilike."%acme%",tax_id.ilike."%acme%",email.ilike."%acme%"',
    );
  });

  it("no añade la búsqueda normalizada si solo cambian las mayúsculas", () => {
    expect(buildClientSearchFilter("b765")).toBe(
      'name.ilike."%b765%",tax_id.ilike."%b765%",email.ilike."%b765%"',
    );
  });

  it("añade el NIF normalizado si el usuario lo escribe con guiones", () => {
    expect(buildClientSearchFilter("b-765")).toBe(
      'name.ilike."%b-765%",tax_id.ilike."%b-765%",email.ilike."%b-765%",' +
        'tax_id.ilike."%B765%"',
    );
  });

  it("añade el NIF normalizado si lleva espacios o puntos", () => {
    expect(buildClientSearchFilter("12.345 678")).toContain(
      'tax_id.ilike."%12345678%"',
    );
  });

  it("no añade la búsqueda normalizada si el NIF queda vacío", () => {
    expect(buildClientSearchFilter("-.-")).toBe(
      'name.ilike."%-.-%",tax_id.ilike."%-.-%",email.ilike."%-.-%"',
    );
  });

  it("mantiene las comas dentro de las comillas", () => {
    expect(buildClientSearchFilter("Acme, S.L.")).toBe(
      'name.ilike."%Acme, S.L.%",tax_id.ilike."%Acme, S.L.%",' +
        'email.ilike."%Acme, S.L.%",tax_id.ilike."%ACME,SL%"',
    );
  });

  it("mantiene los paréntesis dentro de las comillas", () => {
    const filter = buildClientSearchFilter("x),id.eq.(1");
    expect(filter?.startsWith('name.ilike."%x),id.eq.(1%",')).toBe(true);
  });

  it("escapa las comillas dobles para que no cierren el valor", () => {
    expect(buildClientSearchFilter('a"b')).toBe(
      'name.ilike."%a\\"b%",tax_id.ilike."%a\\"b%",email.ilike."%a\\"b%"',
    );
  });

  it("escapa % y _ como literales de LIKE", () => {
    expect(buildClientSearchFilter("5%_x")).toBe(
      'name.ilike."%5\\\\%\\\\_x%",tax_id.ilike."%5\\\\%\\\\_x%",' +
        'email.ilike."%5\\\\%\\\\_x%"',
    );
  });

  it("escapa la barra invertida dos veces (LIKE y PostgREST)", () => {
    // Usuario: a\b → LIKE: a\\b → entre comillas de PostgREST: a\\\\b
    expect(buildClientSearchFilter("a\\b")).toBe(
      'name.ilike."%a\\\\\\\\b%",tax_id.ilike."%a\\\\\\\\b%",' +
        'email.ilike."%a\\\\\\\\b%"',
    );
  });

  it("cambia * por _ para que no actúe como comodín de PostgREST", () => {
    expect(buildClientSearchFilter("a*")).toBe(
      'name.ilike."%a_%",tax_id.ilike."%a_%",email.ilike."%a_%"',
    );
  });

  it("con un término muy largo, ya recortado, genera un filtro acotado", () => {
    const query = readClientSearchQuery("z".repeat(10_000));
    const filter = buildClientSearchFilter(query);
    expect(filter).toBe(
      `name.ilike."%${query}%",tax_id.ilike."%${query}%",email.ilike."%${query}%"`,
    );
  });

  it("cada condición queda separada solo por las comas de fuera de comillas", () => {
    // El guion fuerza la cuarta condición (NIF normalizado).
    const filter = buildClientSearchFilter('a-b,"c(d)e\\f') ?? "";
    const parts = splitOutsideQuotes(filter);
    expect(parts).toHaveLength(4);
    expect(parts.map((part) => part.split(".")[0])).toEqual([
      "name",
      "tax_id",
      "email",
      "tax_id",
    ]);
  });
});

// Reproduce cómo PostgREST separa las condiciones de `or=(…)`: por comas que
// no estén dentro de comillas, saltando lo escapado con `\`.
function splitOutsideQuotes(filter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < filter.length; i++) {
    const char = filter[i];
    if (quoted && char === "\\") {
      current += char + filter[i + 1];
      i++;
      continue;
    }
    if (char === '"') quoted = !quoted;
    if (char === "," && !quoted) {
      parts.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  parts.push(current);
  return parts;
}
