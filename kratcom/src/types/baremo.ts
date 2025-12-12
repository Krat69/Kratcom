// Tipos para el Baremo de Tráfico Español

export interface BaremoData {
  year: number;
  fallecimiento: FallecimientoBaremo;
  lesionesTemporales: LesionesTemporalesBaremo;
  secuelas: SecuelasBaremo;
  factoresCorrectores: FactoresCorrectores;
}

export interface FallecimientoBaremo {
  perjuicioPersonalBasico: {
    [categoria: string]: number; // victima, conyuge, hijos, padres, hermanos, allegados
  };
  perjuicioPersonalParticular: {
    embarazo: number;
    familiaNumerosa: number;
    unico: number; // hijo o padre único
    convivencia: number;
  };
}

export interface LesionesTemporalesBaremo {
  hospitalizacion: {
    diario: number;
  };
  impeditivoBaja: {
    diario: number;
  };
  noImpeditivoBaja: {
    diario: number;
  };
  moderadoBaja: {
    diario: number;
  };
  basicoBaja: {
    diario: number;
  };
}

export interface SecuelasBaremo {
  puntosSecuela: {
    [puntos: number]: number; // puntos de secuela -> indemnización base
  };
  perjuicioMoralSecuela: {
    muy_grave: { min: number; max: number; valor: number };
    grave: { min: number; max: number; valor: number };
    moderado: { min: number; max: number; valor: number };
    leve: { min: number; max: number; valor: number };
  };
}

export interface FactoresCorrectores {
  edadVictima: {
    [rango: string]: number; // multiplicador según edad
  };
  perjuiciosEconomicos: {
    lucrosCesantes: boolean;
    dañosEmergentes: boolean;
  };
}

// Tipos para casos de clientes
export interface Caso {
  id: string;
  fecha: Date;
  cliente: Cliente;
  tipoAccidente: 'lesiones' | 'fallecimiento';
  lesiones?: LesionesData;
  fallecimiento?: FallecimientoData;
  resultado?: ResultadoCalculo;
  notas: string;
}

export interface Cliente {
  nombre: string;
  apellidos: string;
  dni: string;
  edad: number;
  fechaNacimiento: Date;
  direccion: string;
  telefono: string;
  email: string;
}

export interface LesionesData {
  diasHospitalizacion: number;
  diasImpeditivoBaja: number;
  diasNoImpeditivoBaja: number;
  diasModeradoBaja: number;
  diasBasicoBaja: number;
  puntosSecuela: number;
  gravedadSecuela?: 'muy_grave' | 'grave' | 'moderado' | 'leve';
  descripcionLesiones: string;
}

export interface FallecimientoData {
  familiares: Familiar[];
  circunstancias: {
    embarazoVictima: boolean;
    familiaNumerosa: boolean;
    hijoUnico: boolean;
    padreUnico: boolean;
  };
}

export interface Familiar {
  id: string;
  tipo: 'conyuge' | 'hijo' | 'padre' | 'hermano' | 'allegado';
  nombre: string;
  edad: number;
  convivencia: boolean;
}

export interface ResultadoCalculo {
  indemnizacionBasica: number;
  perjuiciosParticulares: number;
  lesionesTemporales: number;
  secuelas: number;
  perjuicioMoral: number;
  factorCorrector: number;
  total: number;
  desglose: DesgloseMonto[];
}

export interface DesgloseMonto {
  concepto: string;
  cantidad: number;
  descripcion: string;
}
