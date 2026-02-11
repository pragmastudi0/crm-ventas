// Utilidades de normalización para importación de ventas

export function normalizeDate(dateString) {
  if (!dateString) return { value: null, error: "Fecha vacía" };

  let str = String(dateString).trim();

  // Intentar convertir número de serie de Excel a fecha si se parece a uno.
  // Los números de serie de Excel son generalmente enteros positivos.
  const serialNum = parseFloat(str);
  if (!isNaN(serialNum) && serialNum > 0 && serialNum < 60000 && String(serialNum) === str) {
    // La fecha de origen de Excel es el 1 de enero de 1900 (serial 1).
    // Sin embargo, Excel tiene un bug y considera 1900 como año bisiesto (añadiendo un 29 de febrero de 1900).
    // Esto hace que todas las fechas a partir del 1 de marzo de 1900 estén un día desfasadas.
    
    // Empezamos con el 1 de enero de 1900 (que es el día 1 en Excel)
    const excelEpoch = new Date('1900-01-01T00:00:00.000Z'); // Usar UTC para evitar problemas de zona horaria
    let daysToAdd = serialNum - 1; // El serial 1 es el día 0 relativo a nuestro epoch

    // Corregir el bug del año bisiesto de 1900 en Excel.
    // Si el número de serie es 60 o más (es decir, 1 de marzo de 1900 o posterior),
    // debemos restar un día para compensar el 29 de febrero de 1900 inexistente.
    if (serialNum >= 60) {
      daysToAdd--;
    }

    const date = new Date(excelEpoch.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    if (!isNaN(date.getTime()) && date.getFullYear() >= 1900 && date.getFullYear() < 2100) {
      return { value: date.toISOString().split('T')[0], error: null }; // Formato YYYY-MM-DD
    } else {
      return { value: dateString, error: "Número de serie de Excel inválido o fuera de rango razonable" };
    }
  }

  // Intentar formato YYYY-MM-DD
  if (/^\\d{4}-\\d{2}-\\d{2}$/.test(str)) {
    const date = new Date(str + 'T00:00:00'); // Añadir T00:00:00 para asegurar el parsing correcto
    if (!isNaN(date.getTime())) {
      return { value: str, error: null };
    }
  }

  // Intentar formato DD/MM/YYYY o DD-MM-YYYY (ej. Argentina)
  const ddmmyyyyMatch = str.match(/^(\\d{1,2})[\\/\\-](\\d{1,2})[\\/\\-](\\d{4})$/);
  if (ddmmyyyyMatch) {
    const [, day, month, year] = ddmmyyyyMatch;
    // Asumir DD/MM/YYYY. Añadir T00:00:00 para asegurar el parsing correcto.
    const date = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00`);
    if (!isNaN(date.getTime())) {
      return {
        value: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`,
        error: null,
        // Advertencia si el formato es ambiguo y podría interpretarse como MM/DD/YYYY
        warning: (parseInt(day) > 12 && parseInt(month) <= 12) ? "Formato ambiguo (asumido DD/MM/YYYY)" : null
      };
    }
  }

  return { value: str, error: "Formato de fecha inválido" };
}

export function normalizeNumber(numString) {
  if (!numString && numString !== 0) return { value: 0, error: null };
  
  let str = String(numString).trim();
  
  // Limpiar símbolos de moneda
  str = str.replace(/[$€US\s]/gi, '');
  
  // Manejar formatos: 1,400.50 o 1.400,50
  const hasComma = str.includes(',');
  const hasDot = str.includes('.');
  
  if (hasComma && hasDot) {
    // Detectar cuál es el separador decimal (el último)
    const lastComma = str.lastIndexOf(',');
    const lastDot = str.lastIndexOf('.');
    
    if (lastComma > lastDot) {
      // Formato europeo: 1.400,50
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      // Formato americano: 1,400.50
      str = str.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Solo coma: podría ser decimal o miles
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      // Probablemente decimal: 1400,50
      str = str.replace(',', '.');
    } else {
      // Miles: 1,400
      str = str.replace(/,/g, '');
    }
  }
  
  const num = parseFloat(str);
  
  if (isNaN(num)) {
    return { value: str, error: "No es un número válido" };
  }
  
  return { value: num, error: null };
}

export function normalizeMarketplace(marketString) {
  if (!marketString) return { value: "Otro", error: null };
  
  const str = String(marketString).toLowerCase().trim().replace(/\s+/g, '');
  
  const mapping = {
    'ml': 'MercadoLibre',
    'mercadolibre': 'MercadoLibre',
    'mercado libre': 'MercadoLibre',
    'ig': 'Instagram',
    'instagram': 'Instagram',
    'wa': 'WhatsApp',
    'whatsapp': 'WhatsApp',
    'local': 'Local',
    'tienda': 'Local'
  };
  
  const normalized = mapping[str] || mapping[marketString.toLowerCase().trim()] || "Otro";
  
  return { value: normalized, error: null };
}

export function normalizeProveedor(proveedorString) {
  if (!proveedorString) return { value: "", error: null };
  
  const str = String(proveedorString).trim().replace(/\s\s+/g, ' ');
  
  return { value: str, error: null };
}

export function extractProductDetails(modeloString, capacidadString, colorString) {
  let modelo = String(modeloString || "").trim();
  let capacidad = String(capacidadString || "").trim();
  let color = String(colorString || "").trim();
  
  // Si capacidad y color ya están, usar esos valores
  if (capacidad && color) {
    return { modelo, capacidad, color, error: null };
  }
  
  // Extraer capacidad del modelo si no está
  if (!capacidad && modelo) {
    const capacidadMatch = modelo.match(/\b(\d+)\s?(GB|TB)\b/i);
    if (capacidadMatch) {
      capacidad = capacidadMatch[1] + capacidadMatch[2].toUpperCase();
      modelo = modelo.replace(capacidadMatch[0], '').trim();
    }
  }
  
  // Extraer color del modelo si no está
  if (!color && modelo) {
    const coloresConocidos = [
      'Negro', 'Blanco', 'Azul', 'Rojo', 'Verde', 'Amarillo', 
      'Rosa', 'Morado', 'Gris', 'Oro', 'Plata', 'Titanio',
      'Grafito', 'Midnight', 'Starlight', 'Purple', 'Blue',
      'Black', 'White', 'Red', 'Green', 'Pink', 'Gold', 'Silver',
      'Natural', 'Desert', 'Alpine'
    ];
    
    for (const colorConocido of coloresConocidos) {
      const regex = new RegExp(`\\b${colorConocido}\\b`, 'i');
      if (regex.test(modelo)) {
        color = colorConocido;
        modelo = modelo.replace(regex, '').trim();
        break;
      }
    }
  }
  
  // Limpiar espacios múltiples
  modelo = modelo.replace(/\s\s+/g, ' ').trim();
  
  return { modelo, capacidad, color, error: null };
}

export function calculateGanancia(venta, costo, comision, canje = 0) {
  const v = typeof venta === 'number' ? venta : 0;
  const c = typeof costo === 'number' ? costo : 0;
  const com = typeof comision === 'number' ? comision : 0;
  const can = typeof canje === 'number' ? canje : 0;
  
  return v - c - com + can;
}

export function validateGanancia(gananciaImportada, gananciaCalculada, umbral = 0.01) {
  const diff = Math.abs(gananciaImportada - gananciaCalculada);
  
  if (diff > umbral) {
    return {
      valid: false,
      warning: `Ganancia importada (${gananciaImportada}) difiere de la calculada (${gananciaCalculada.toFixed(2)})`
    };
  }
  
  return { valid: true, warning: null };
}

export function normalizeRow(row, columnMapping) {
  const normalized = {};
  const errors = [];
  const warnings = [];
  
  // Mapear columnas
  for (const [fileColumn, ventaField] of Object.entries(columnMapping)) {
    if (ventaField === 'ignore' || !ventaField) continue;
    
    const value = row[fileColumn];
    
    switch (ventaField) {
      case 'fecha':
        const dateResult = normalizeDate(value);
        normalized.fecha = dateResult.value;
        if (dateResult.error) errors.push(`Fecha: ${dateResult.error}`);
        if (dateResult.warning) warnings.push(dateResult.warning);
        break;
        
      case 'costo':
      case 'comision':
      case 'venta':
        const numResult = normalizeNumber(value);
        normalized[ventaField] = numResult.value;
        if (numResult.error) errors.push(`${ventaField}: ${numResult.error}`);
        break;
        
      case 'marketplace':
        const marketResult = normalizeMarketplace(value);
        normalized.marketplace = marketResult.value;
        break;
        
      case 'proveedorTexto':
        const provResult = normalizeProveedor(value);
        normalized.proveedorTexto = provResult.value;
        break;
        
      default:
        normalized[ventaField] = value;
    }
  }
  
  // Extraer detalles de producto
  const productResult = extractProductDetails(
    normalized.modelo,
    normalized.capacidad,
    normalized.color
  );
  normalized.modelo = productResult.modelo;
  normalized.capacidad = productResult.capacidad;
  normalized.color = productResult.color;
  
  // Calcular ganancia si no existe
  if (!normalized.ganancia || normalized.ganancia === 0) {
    normalized.ganancia = calculateGanancia(
      normalized.venta,
      normalized.costo,
      normalized.comision,
      normalized.canje
    );
  } else {
    // Validar ganancia importada
    const calculada = calculateGanancia(
      normalized.venta,
      normalized.costo,
      normalized.comision,
      normalized.canje
    );
    const validation = validateGanancia(normalized.ganancia, calculada, 1);
    if (!validation.valid) {
      warnings.push(validation.warning);
    }
  }
  
  return {
    ...normalized,
    _errors: errors,
    _warnings: warnings,
    _hasErrors: errors.length > 0
  };
}