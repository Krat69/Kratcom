import type { BaremoData } from '../types/baremo';

/**
 * Baremo de Tráfico Español - Año 2024
 * Basado en la Ley 35/2015 sobre valoración de daños y perjuicios
 * causados a las personas en accidentes de circulación
 * Actualizado anualmente según tabla de valoración
 */
export const BAREMO_2024: BaremoData = {
  year: 2024,

  // Indemnizaciones por fallecimiento
  fallecimiento: {
    perjuicioPersonalBasico: {
      victima: 86811.12, // Indemnización básica por fallecimiento
      conyuge: 105000.00,
      hijo_menor_14: 105000.00,
      hijo_14_20: 95000.00,
      hijo_20_30: 75000.00,
      hijo_mayor_30: 42000.00,
      padre_hasta_65: 42000.00,
      padre_mayor_65: 21000.00,
      hermano: 21000.00,
      allegado: 10500.00,
    },
    perjuicioPersonalParticular: {
      embarazo: 15730.32,
      familiaNumerosa: 26217.20,
      unico: 26217.20, // hijo único o padre único
      convivencia: 15730.32,
    }
  },

  // Lesiones temporales (por día)
  lesionesTemporales: {
    hospitalizacion: {
      diario: 104.39,
    },
    impeditivoBaja: {
      diario: 78.29,
    },
    noImpeditivoBaja: {
      diario: 52.20,
    },
    moderadoBaja: {
      diario: 35.00,
    },
    basicoBaja: {
      diario: 31.25,
    }
  },

  // Secuelas permanentes
  secuelas: {
    // Tabla simplificada - en producción debe incluir todos los puntos del 1 al 100
    puntosSecuela: {
      1: 1563.07,
      2: 1969.08,
      3: 2469.62,
      4: 3076.98,
      5: 3804.46,
      6: 4667.13,
      7: 5681.78,
      8: 6867.67,
      9: 8246.43,
      10: 9842.12,
      11: 11681.17,
      12: 13792.62,
      13: 16208.33,
      14: 18963.14,
      15: 22095.03,
      16: 25645.22,
      17: 29658.24,
      18: 34181.99,
      19: 39268.69,
      20: 44974.96,
      21: 51361.08,
      22: 58491.34,
      23: 66434.38,
      24: 75263.32,
      25: 85057.06,
      26: 95900.58,
      27: 107884.96,
      28: 121107.52,
      29: 135672.00,
      30: 151689.00,
      31: 169275.55,
      32: 188556.19,
      33: 209663.08,
      34: 232735.32,
      35: 257920.15,
      36: 285373.17,
      37: 315258.51,
      38: 347749.69,
      39: 383029.66,
      40: 421291.64,
      41: 462739.27,
      42: 507587.39,
      43: 556062.09,
      44: 608401.70,
      45: 664857.87,
      46: 725695.60,
      47: 791194.31,
      48: 861648.65,
      49: 937368.79,
      50: 1018680.40,
      51: 1105926.60,
      52: 1199469.01,
      53: 1299688.46,
      54: 1406986.48,
      55: 1521785.09,
      56: 1644527.00,
      57: 1775676.19,
      58: 1915718.81,
      59: 2065163.58,
      60: 2224542.92,
      61: 2394413.16,
      62: 2575355.97,
      63: 2767979.60,
      64: 2972918.58,
      65: 3190835.23,
      66: 3422420.16,
      67: 3668393.37,
      68: 3929505.34,
      69: 4206537.60,
      70: 4500302.48,
      71: 4811643.60,
      72: 5141437.29,
      73: 5490593.15,
      74: 5860055.81,
      75: 6250804.60,
      76: 6663854.83,
      77: 7100258.57,
      78: 7561104.50,
      79: 8047519.72,
      80: 8560670.71,
      81: 9101765.94,
      82: 9672065.24,
      83: 10272882.50,
      84: 10905586.62,
      85: 11571602.95,
      86: 12272415.10,
      87: 13009575.85,
      88: 13784707.64,
      89: 14599503.02,
      90: 15455724.17,
      91: 16355205.38,
      92: 17299854.65,
      93: 18291655.38,
      94: 19332668.15,
      95: 20425034.56,
      96: 21570979.29,
      97: 22772812.25,
      98: 24032933.86,
      99: 25353835.55,
      100: 26738103.33,
    },
    perjuicioMoralSecuela: {
      muy_grave: { min: 76, max: 100, valor: 104390.40 },
      grave: { min: 61, max: 75, valor: 62634.24 },
      moderado: { min: 25, max: 60, valor: 31317.12 },
      leve: { min: 1, max: 24, valor: 15730.32 },
    }
  },

  // Factores correctores
  factoresCorrectores: {
    edadVictima: {
      '0-14': 1.5,
      '15-25': 1.4,
      '26-40': 1.3,
      '41-55': 1.2,
      '56-65': 1.1,
      '66-100': 1.0,
    },
    perjuiciosEconomicos: {
      lucrosCesantes: true,
      dañosEmergentes: true,
    }
  }
};

/**
 * Función auxiliar para obtener el factor corrector por edad
 */
export function getFactorEdad(edad: number): number {
  if (edad <= 14) return 1.5;
  if (edad <= 25) return 1.4;
  if (edad <= 40) return 1.3;
  if (edad <= 55) return 1.2;
  if (edad <= 65) return 1.1;
  return 1.0;
}

/**
 * Función auxiliar para obtener la gravedad de la secuela según puntos
 */
export function getGravedadSecuela(puntos: number): 'muy_grave' | 'grave' | 'moderado' | 'leve' {
  if (puntos >= 76) return 'muy_grave';
  if (puntos >= 61) return 'grave';
  if (puntos >= 25) return 'moderado';
  return 'leve';
}

/**
 * Función para obtener indemnización por puntos de secuela
 * Interpola valores si el punto exacto no está en la tabla
 */
export function getIndemnizacionSecuela(puntos: number): number {
  const tabla = BAREMO_2024.secuelas.puntosSecuela;

  // Si existe el valor exacto, retornarlo
  if (tabla[puntos]) {
    return tabla[puntos];
  }

  // Interpolar entre el valor inferior y superior más cercano
  const puntosInferior = Math.floor(puntos);
  const puntosSuperior = Math.ceil(puntos);

  if (tabla[puntosInferior] && tabla[puntosSuperior]) {
    const valorInferior = tabla[puntosInferior];
    const valorSuperior = tabla[puntosSuperior];
    const factor = puntos - puntosInferior;
    return valorInferior + (valorSuperior - valorInferior) * factor;
  }

  // Si no hay valores para interpolar, retornar el más cercano disponible
  return tabla[puntosInferior] || tabla[puntosSuperior] || 0;
}
