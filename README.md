# Calculadora Baremo de Tráfico Español 2024

Aplicación web profesional para el cálculo de indemnizaciones por accidentes de tráfico según el Baremo Español actualizado (Ley 35/2015).

## Características

### Funcionalidades Principales

- **Cálculo de Indemnizaciones por Lesiones**
  - Lesiones temporales (días de baja con diferentes niveles)
  - Secuelas permanentes (puntos de secuela según tabla oficial)
  - Perjuicio moral según gravedad de secuela
  - Factores correctores por edad

- **Cálculo de Indemnizaciones por Fallecimiento**
  - Perjuicios personales básicos para familiares
  - Perjuicios personales particulares (embarazo, familia numerosa, etc.)
  - Gestión de múltiples familiares perjudicados
  - Cálculo de perjuicios por convivencia

- **Gestión de Casos**
  - Almacenamiento local de casos
  - Listado y búsqueda de casos guardados
  - Edición y eliminación de casos
  - Estadísticas de casos

- **Exportación de Informes**
  - Generación de informes detallados en PDF
  - Desglose completo de indemnizaciones
  - Formato profesional para presentación a clientes

### Baremo 2024

La aplicación implementa las tablas oficiales del Baremo de Tráfico 2024, incluyendo:

- Indemnizaciones básicas por fallecimiento
- Perjuicios personales básicos y particulares
- Tabla completa de lesiones temporales (5 categorías)
- Tabla de secuelas permanentes (1-100 puntos)
- Perjuicio moral según gravedad de secuela
- Factores correctores por edad

## Instalación

### Requisitos Previos

- Node.js 16 o superior
- npm o yarn

### Pasos de Instalación

1. Clonar el repositorio:
```bash
git clone <url-del-repositorio>
cd Kratcom
```

2. Navegar al directorio de la aplicación:
```bash
cd kratcom
```

3. Instalar dependencias:
```bash
npm install
```

4. Iniciar en modo desarrollo:
```bash
npm run dev
```

5. Compilar para producción:
```bash
npm run build
```

## Uso de la Aplicación

### 1. Crear un Nuevo Caso

1. Haz clic en "Nuevo Caso"
2. Selecciona el tipo de accidente (Lesiones o Fallecimiento)
3. Completa los datos del cliente:
   - Nombre y apellidos
   - DNI/NIE
   - Edad
   - Datos de contacto

### 2. Configurar Detalles

#### Para Casos de Lesiones:

- **Lesiones Temporales:**
  - Días de hospitalización
  - Días impeditivos (baja completa)
  - Días no impeditivos
  - Días moderados
  - Días básicos

- **Secuelas Permanentes:**
  - Puntos de secuela (1-100)
  - Descripción de lesiones

#### Para Casos de Fallecimiento:

- **Familiares Perjudicados:**
  - Añadir cada familiar (cónyuge, hijos, padres, hermanos, allegados)
  - Especificar edad y convivencia

- **Circunstancias Particulares:**
  - Embarazo de la víctima
  - Familia numerosa
  - Hijo único / Padre único

### 3. Calcular Indemnización

Una vez completados todos los datos, haz clic en "Calcular Indemnización" para ver:

- **Indemnización total** destacada
- **Resumen** con categorías principales
- **Desglose detallado** con todos los conceptos

### 4. Guardar y Exportar

- **Guardar Caso:** Almacena el caso en el navegador para consultas futuras
- **Exportar PDF:** Genera un informe profesional imprimible
- **Nuevo Caso:** Comienza un nuevo cálculo

## Estructura del Proyecto

```
kratcom/
├── src/
│   ├── components/          # Componentes React
│   │   ├── CasoForm.tsx            # Formulario de datos básicos
│   │   ├── LesionesForm.tsx        # Formulario de lesiones
│   │   ├── FallecimientoForm.tsx   # Formulario de fallecimiento
│   │   ├── ResultadoView.tsx       # Vista de resultados
│   │   └── CasosList.tsx           # Lista de casos guardados
│   ├── data/                # Datos del baremo
│   │   └── baremo2024.ts           # Tablas oficiales 2024
│   ├── types/               # Definiciones TypeScript
│   │   └── baremo.ts               # Tipos e interfaces
│   ├── utils/               # Utilidades
│   │   └── calculadora.ts          # Lógica de cálculo
│   ├── hooks/               # React hooks
│   │   └── useCasos.ts             # Gestión de casos
│   └── App.tsx              # Componente principal
├── public/                  # Archivos estáticos
└── package.json            # Dependencias
```

## Tecnologías Utilizadas

- **React 18** - Framework de UI
- **TypeScript** - Tipado estático
- **Tailwind CSS** - Estilos y diseño
- **Vite** - Build tool y dev server
- **LocalStorage** - Persistencia de datos

## Actualizaciones del Baremo

El baremo de tráfico se actualiza anualmente. Para actualizar los valores:

1. Edita el archivo `src/data/baremo2024.ts`
2. Actualiza las tablas con los nuevos valores oficiales
3. Cambia el año en `BAREMO_2024.year`
4. Recompila la aplicación

## Notas Legales

**IMPORTANTE:** Esta aplicación es una herramienta de cálculo orientativo basada en la Ley 35/2015 sobre valoración de daños y perjuicios causados a las personas en accidentes de circulación.

- Los cálculos son orientativos y no sustituyen el asesoramiento legal profesional
- No incluye gastos de asistencia sanitaria futura
- No incluye lucros cesantes específicos
- Se recomienda revisión legal profesional antes de presentar reclamaciones
- Las circunstancias específicas de cada caso pueden afectar las indemnizaciones

## Soporte para Móvil y Escritorio

La aplicación está diseñada con un enfoque "responsive" que se adapta a:

- **Navegadores de escritorio** (Chrome, Firefox, Safari, Edge)
- **Tablets** (iPad, Android tablets)
- **Smartphones** (iOS, Android)

### Para uso como aplicación móvil:

La aplicación incluye un Service Worker y manifest.json para funcionalidad PWA (Progressive Web App). Los usuarios pueden:

1. Abrir la app en el navegador móvil
2. Añadir a pantalla de inicio
3. Usar como aplicación nativa

## Licencia

Este proyecto es de uso privado para despachos de abogados.

## Contacto y Soporte

Para dudas o soporte técnico, contactar con el desarrollador del proyecto.
