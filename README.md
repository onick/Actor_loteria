# Scraper de Lotería Dominicana

Este repositorio contiene herramientas para extraer y procesar resultados de lotería desde el sitio web oficial de la Lotería Nacional de República Dominicana (https://loterianacional.gob.do/).

## Estructura del Proyecto

El proyecto está organizado en dos componentes principales:

### 1. lottery-scraper

Un scraper basado en Apify que extrae los resultados de lotería del sitio web oficial.

- Utiliza Puppeteer para la navegación y extracción de datos
- Diseñado para ejecutarse como un Actor de Apify

### 2. n8n-lottery-agent

Un nodo personalizado para la plataforma n8n que permite integrar la extracción de resultados de lotería en flujos de trabajo automatizados.

- Implementa la misma funcionalidad de scraping en un formato compatible con n8n
- Permite procesar y transformar los datos extraídos utilizando otros nodos de n8n

## Requisitos

- Node.js (versión 14 o superior)
- npm o yarn
- Para el nodo n8n: una instalación de n8n

## Instalación

Cada componente tiene sus propias instrucciones de instalación. Consulte los archivos README.md en los directorios correspondientes para obtener más detalles.

## Licencia

ISC