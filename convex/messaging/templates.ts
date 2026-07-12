const VARIABLE_RE = /\{([a-zA-Z][a-zA-Z0-9_]*)\}/g;

export function renderSmsTemplate(template: string, variables: Record<string, string | number>) {
  const missing = new Set<string>();
  const body = template.replace(VARIABLE_RE, (_, key: string) => {
    const value = variables[key];
    if (value === undefined || value === null || String(value).trim() === "") {
      missing.add(key);
      return `{${key}}`;
    }
    return String(value);
  });
  return { body, missingVariables: [...missing] };
}

export function estimateSmsSegments(body: string) {
  const usesUnicode = /[^\x00-\x7F]/.test(body);
  const length = [...body].length;
  const singleLimit = usesUnicode ? 70 : 160;
  const multipartLimit = usesUnicode ? 67 : 153;
  return { encoding: usesUnicode ? "ucs2" as const : "gsm" as const, characterCount: length, segmentCount: length <= singleLimit ? 1 : Math.ceil(length / multipartLimit) };
}
