import type { Caso, ResultadoCalculo, DesgloseMonto } from '../types/baremo';
import { BAREMO_2024, getFactorEdad, getGravedadSecuela, getIndemnizacionSecuela } from '../data/baremo2024';

/**
 * Calculadora de indemnizaciones según el Baremo de Tráfico Español
 */
export class CalculadoraBaremo {
  private baremo = BAREMO_2024;

  /**
   * Calcula la indemnización total para un caso
   */
  calcularIndemnizacion(caso: Caso): ResultadoCalculo {
    if (caso.tipoAccidente === 'fallecimiento') {
      return this.calcularFallecimiento(caso);
    } else {
      return this.calcularLesiones(caso);
    }
  }

  /**
   * Calcula indemnización por fallecimiento
   */
  private calcularFallecimiento(caso: Caso): ResultadoCalculo {
    const data = caso.fallecimiento;
    if (!data) {
      throw new Error('Datos de fallecimiento no proporcionados');
    }

    const desglose: DesgloseMonto[] = [];
    let total = 0;

    // Indemnización básica de la víctima
    const indemnizacionVictima = this.baremo.fallecimiento.perjuicioPersonalBasico.victima;
    desglose.push({
      concepto: 'Indemnización básica víctima',
      cantidad: indemnizacionVictima,
      descripcion: 'Perjuicio personal básico del fallecido',
    });
    total += indemnizacionVictima;

    // Indemnizaciones de familiares
    data.familiares.forEach((familiar) => {
      let clave = '';

      if (familiar.tipo === 'conyuge') {
        clave = 'conyuge';
      } else if (familiar.tipo === 'hijo') {
        if (familiar.edad < 14) clave = 'hijo_menor_14';
        else if (familiar.edad <= 20) clave = 'hijo_14_20';
        else if (familiar.edad <= 30) clave = 'hijo_20_30';
        else clave = 'hijo_mayor_30';
      } else if (familiar.tipo === 'padre') {
        clave = familiar.edad <= 65 ? 'padre_hasta_65' : 'padre_mayor_65';
      } else if (familiar.tipo === 'hermano') {
        clave = 'hermano';
      } else if (familiar.tipo === 'allegado') {
        clave = 'allegado';
      }

      const cantidad = this.baremo.fallecimiento.perjuicioPersonalBasico[clave] || 0;
      desglose.push({
        concepto: `${this.getNombreTipoFamiliar(familiar.tipo)} - ${familiar.nombre}`,
        cantidad,
        descripcion: `Perjuicio personal básico (${familiar.edad} años)`,
      });
      total += cantidad;

      // Perjuicio por convivencia
      if (familiar.convivencia) {
        const convivencia = this.baremo.fallecimiento.perjuicioPersonalParticular.convivencia;
        desglose.push({
          concepto: `Convivencia - ${familiar.nombre}`,
          cantidad: convivencia,
          descripcion: 'Perjuicio personal particular por convivencia',
        });
        total += convivencia;
      }
    });

    // Perjuicios particulares
    if (data.circunstancias.embarazoVictima) {
      const embarazo = this.baremo.fallecimiento.perjuicioPersonalParticular.embarazo;
      desglose.push({
        concepto: 'Embarazo de la víctima',
        cantidad: embarazo,
        descripcion: 'Perjuicio particular por embarazo',
      });
      total += embarazo;
    }

    if (data.circunstancias.familiaNumerosa) {
      const famNumerosa = this.baremo.fallecimiento.perjuicioPersonalParticular.familiaNumerosa;
      desglose.push({
        concepto: 'Familia numerosa',
        cantidad: famNumerosa,
        descripcion: 'Perjuicio particular por familia numerosa',
      });
      total += famNumerosa;
    }

    if (data.circunstancias.hijoUnico || data.circunstancias.padreUnico) {
      const unico = this.baremo.fallecimiento.perjuicioPersonalParticular.unico;
      const concepto = data.circunstancias.hijoUnico ? 'Hijo único' : 'Padre único';
      desglose.push({
        concepto,
        cantidad: unico,
        descripcion: 'Perjuicio particular por hijo/padre único',
      });
      total += unico;
    }

    // Factor corrector por edad
    const factorEdad = getFactorEdad(caso.cliente.edad);
    const incrementoEdad = total * (factorEdad - 1);
    if (incrementoEdad > 0) {
      desglose.push({
        concepto: 'Factor corrector por edad',
        cantidad: incrementoEdad,
        descripcion: `Multiplicador x${factorEdad} por edad ${caso.cliente.edad} años`,
      });
      total += incrementoEdad;
    }

    return {
      indemnizacionBasica: indemnizacionVictima,
      perjuiciosParticulares: total - indemnizacionVictima - incrementoEdad,
      lesionesTemporales: 0,
      secuelas: 0,
      perjuicioMoral: 0,
      factorCorrector: incrementoEdad,
      total,
      desglose,
    };
  }

  /**
   * Calcula indemnización por lesiones
   */
  private calcularLesiones(caso: Caso): ResultadoCalculo {
    const data = caso.lesiones;
    if (!data) {
      throw new Error('Datos de lesiones no proporcionados');
    }

    const desglose: DesgloseMonto[] = [];
    let totalLesionesTemporales = 0;
    let totalSecuelas = 0;
    let perjuicioMoral = 0;

    // Lesiones temporales
    if (data.diasHospitalizacion > 0) {
      const cantidad = data.diasHospitalizacion * this.baremo.lesionesTemporales.hospitalizacion.diario;
      desglose.push({
        concepto: 'Días de hospitalización',
        cantidad,
        descripcion: `${data.diasHospitalizacion} días × ${this.baremo.lesionesTemporales.hospitalizacion.diario.toFixed(2)}€`,
      });
      totalLesionesTemporales += cantidad;
    }

    if (data.diasImpeditivoBaja > 0) {
      const cantidad = data.diasImpeditivoBaja * this.baremo.lesionesTemporales.impeditivoBaja.diario;
      desglose.push({
        concepto: 'Días impeditivos (baja)',
        cantidad,
        descripcion: `${data.diasImpeditivoBaja} días × ${this.baremo.lesionesTemporales.impeditivoBaja.diario.toFixed(2)}€`,
      });
      totalLesionesTemporales += cantidad;
    }

    if (data.diasNoImpeditivoBaja > 0) {
      const cantidad = data.diasNoImpeditivoBaja * this.baremo.lesionesTemporales.noImpeditivoBaja.diario;
      desglose.push({
        concepto: 'Días no impeditivos (baja)',
        cantidad,
        descripcion: `${data.diasNoImpeditivoBaja} días × ${this.baremo.lesionesTemporales.noImpeditivoBaja.diario.toFixed(2)}€`,
      });
      totalLesionesTemporales += cantidad;
    }

    if (data.diasModeradoBaja > 0) {
      const cantidad = data.diasModeradoBaja * this.baremo.lesionesTemporales.moderadoBaja.diario;
      desglose.push({
        concepto: 'Días moderados (baja)',
        cantidad,
        descripcion: `${data.diasModeradoBaja} días × ${this.baremo.lesionesTemporales.moderadoBaja.diario.toFixed(2)}€`,
      });
      totalLesionesTemporales += cantidad;
    }

    if (data.diasBasicoBaja > 0) {
      const cantidad = data.diasBasicoBaja * this.baremo.lesionesTemporales.basicoBaja.diario;
      desglose.push({
        concepto: 'Días básicos (baja)',
        cantidad,
        descripcion: `${data.diasBasicoBaja} días × ${this.baremo.lesionesTemporales.basicoBaja.diario.toFixed(2)}€`,
      });
      totalLesionesTemporales += cantidad;
    }

    // Secuelas permanentes
    if (data.puntosSecuela > 0) {
      const indemnizacionSecuela = getIndemnizacionSecuela(data.puntosSecuela);
      desglose.push({
        concepto: 'Secuelas permanentes',
        cantidad: indemnizacionSecuela,
        descripcion: `${data.puntosSecuela} puntos de secuela`,
      });
      totalSecuelas += indemnizacionSecuela;

      // Perjuicio moral por secuela
      const gravedad = data.gravedadSecuela || getGravedadSecuela(data.puntosSecuela);
      const perjuicioMoralSecuela = this.baremo.secuelas.perjuicioMoralSecuela[gravedad];
      perjuicioMoral = perjuicioMoralSecuela.valor;

      desglose.push({
        concepto: 'Perjuicio moral',
        cantidad: perjuicioMoral,
        descripcion: `Secuela ${this.getNombreGravedad(gravedad)} (${perjuicioMoralSecuela.min}-${perjuicioMoralSecuela.max} puntos)`,
      });
    }

    // Factor corrector por edad
    const total = totalLesionesTemporales + totalSecuelas + perjuicioMoral;
    const factorEdad = getFactorEdad(caso.cliente.edad);
    const incrementoEdad = total * (factorEdad - 1);

    if (incrementoEdad > 0) {
      desglose.push({
        concepto: 'Factor corrector por edad',
        cantidad: incrementoEdad,
        descripcion: `Multiplicador x${factorEdad} por edad ${caso.cliente.edad} años`,
      });
    }

    const totalFinal = total + incrementoEdad;

    return {
      indemnizacionBasica: 0,
      perjuiciosParticulares: 0,
      lesionesTemporales: totalLesionesTemporales,
      secuelas: totalSecuelas,
      perjuicioMoral,
      factorCorrector: incrementoEdad,
      total: totalFinal,
      desglose,
    };
  }

  private getNombreTipoFamiliar(tipo: string): string {
    const nombres: { [key: string]: string } = {
      conyuge: 'Cónyuge',
      hijo: 'Hijo',
      padre: 'Padre',
      hermano: 'Hermano',
      allegado: 'Allegado',
    };
    return nombres[tipo] || tipo;
  }

  private getNombreGravedad(gravedad: string): string {
    const nombres: { [key: string]: string } = {
      muy_grave: 'muy grave',
      grave: 'grave',
      moderado: 'moderada',
      leve: 'leve',
    };
    return nombres[gravedad] || gravedad;
  }
}

// Instancia singleton de la calculadora
export const calculadora = new CalculadoraBaremo();
