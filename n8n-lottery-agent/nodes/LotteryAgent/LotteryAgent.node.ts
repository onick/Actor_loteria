import { IExecuteFunctions } from 'n8n-core';
import {
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
  NodeOperationError,
} from 'n8n-workflow';
import puppeteer from 'puppeteer';

export class LotteryAgent implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Lottery Agent',
    name: 'lotteryAgent',
    icon: 'file:lottery.svg',
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Extrae resultados de lotería desde loterianacional.gob.do',
    defaults: {
      name: 'Lottery Agent',
    },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      {
        displayName: 'Operación',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          {
            name: 'Extraer Resultados',
            value: 'extractResults',
            description: 'Extrae los resultados de lotería más recientes',
            action: 'Extraer resultados de lotería',
          },
        ],
        default: 'extractResults',
      },
      {
        displayName: 'URL',
        name: 'url',
        type: 'string',
        default: 'https://loterianacional.gob.do/',
        description: 'URL del sitio web de la lotería',
        displayOptions: {
          show: {
            operation: ['extractResults'],
          },
        },
      },
      {
        displayName: 'Tiempo de Espera (ms)',
        name: 'timeout',
        type: 'number',
        default: 30000,
        description: 'Tiempo máximo de espera para cargar la página',
        displayOptions: {
          show: {
            operation: ['extractResults'],
          },
        },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const returnData: INodeExecutionData[] = [];

    // Para cada item (normalmente solo uno en este caso)
    for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
      try {
        const operation = this.getNodeParameter('operation', itemIndex) as string;

        if (operation === 'extractResults') {
          const url = this.getNodeParameter('url', itemIndex) as string;
          const timeout = this.getNodeParameter('timeout', itemIndex) as number;

          // Iniciar Puppeteer
          const browser = await puppeteer.launch({
            headless: true,
            defaultViewport: { width: 1280, height: 720 },
          });

          try {
            const page = await browser.newPage();
            await page.goto(url, { waitUntil: 'networkidle2' });

            // Esperar a que la página cargue completamente
            await page.waitForSelector('.container', { timeout })
              .catch(() => console.log('No se encontró el contenedor principal'));

            // Extraer datos de los sorteos (similar al código existente)
            const results = await page.evaluate(() => {
              const bancas = {
                tarde: [],
                noche: []
              };
              const billetesYQuinielas = [];
              
              // Función para determinar si es un sorteo de bancas
              const esSorteoBancas = (titulo: string) => {
                return titulo.toLowerCase().includes('banca') || 
                       titulo.toLowerCase().includes('loteka') || 
                       titulo.toLowerCase().includes('leidsa');
              };
              
              // Función para determinar si es sorteo de tarde o noche
              const esSorteoTarde = (titulo: string) => {
                return titulo.toLowerCase().includes('tarde') || 
                       titulo.toLowerCase().includes('primera') || 
                       titulo.toLowerCase().includes('1ra');
              };
              
              // Buscar secciones de resultados en la página
              const sorteoSections = document.querySelectorAll('.sorteo-section, .resultados-section, .numeros-section, table');
              
              sorteoSections.forEach(section => {
                const tituloElement = section.querySelector('h2, h3, .titulo-sorteo, .titulo, caption') || 
                                      section.closest('section')?.querySelector('h2, h3, .titulo-sorteo');
                const titulo = tituloElement ? tituloElement.innerText.trim() : 'Sorteo';
                
                const fechaElement = section.querySelector('.fecha-sorteo, .date') || 
                                    section.closest('section')?.querySelector('.fecha-sorteo, .date');
                const fecha = fechaElement ? fechaElement.innerText.trim() : new Date().toLocaleDateString();
                
                // Extraer números y premios
                const numerosElements = section.querySelectorAll('.numero-ganador, .bola, .numero, td');
                const numeros: string[] = [];
                let primerPremio = 'No disponible';
                let segundoPremio = 'No disponible';
                let tercerPremio = 'No disponible';
                
                numerosElements.forEach((element, index) => {
                  const numero = element.textContent?.trim() || '';
                  if (numero.match(/\d+/)) {
                    if (esSorteoBancas(titulo)) {
                      numeros.push(numero);
                    } else {
                      switch(index) {
                        case 0: primerPremio = numero; break;
                        case 1: segundoPremio = numero; break;
                        case 2: tercerPremio = numero; break;
                        default: numeros.push(numero);
                      }
                    }
                  }
                });
                
                // Si no hay números específicos, intentar extraer del texto
                if (numeros.length === 0) {
                  const texto = section.textContent || '';
                  const numerosMatch = texto.match(/\d+/g);
                  if (numerosMatch) {
                    numeros.push(...numerosMatch);
                  }
                }
                
                // Crear el objeto de resultado según el tipo de sorteo
                if (esSorteoBancas(titulo)) {
                  const resultado = {
                    fecha: fecha,
                    tipoSorteo: titulo,
                    numero: numeros.join(', ') || 'No disponible'
                  };
                  
                  if (esSorteoTarde(titulo)) {
                    bancas.tarde.push(resultado);
                  } else {
                    bancas.noche.push(resultado);
                  }
                } else {
                  billetesYQuinielas.push({
                    fecha: fecha,
                    sorteo: titulo,
                    primerPremio: primerPremio,
                    segundoPremio: segundoPremio,
                    tercerPremio: tercerPremio
                  });
                }
              });
              
              // Si no se encontró ningún dato, crear registros genéricos
              if (bancas.tarde.length === 0 && bancas.noche.length === 0 && billetesYQuinielas.length === 0) {
                bancas.tarde.push({
                  fecha: new Date().toLocaleDateString(),
                  tipoSorteo: 'Bancas (Tarde)',
                  numero: 'No disponible'
                });
                bancas.noche.push({
                  fecha: new Date().toLocaleDateString(),
                  tipoSorteo: 'Bancas (Noche)',
                  numero: 'No disponible'
                });
                billetesYQuinielas.push({
                  fecha: new Date().toLocaleDateString(),
                  sorteo: 'Lotería Nacional',
                  primerPremio: 'No disponible',
                  segundoPremio: 'No disponible',
                  tercerPremio: 'No disponible'
                });
              }
              
              return { bancas, billetesYQuinielas };
            });

            // Agregar los resultados a los datos de retorno
            returnData.push({
              json: results,
              pairedItem: { item: itemIndex },
            });
          } finally {
            // Cerrar el navegador
            await browser.close();
          }
        }
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error.message,
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error, {
          itemIndex,
        });
      }
    }

    return [returnData];
  }
}